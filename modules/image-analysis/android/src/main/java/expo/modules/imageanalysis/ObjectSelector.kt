package expo.modules.imageanalysis

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.FloatBuffer
import java.util.UUID
import java.util.zip.CRC32
import java.util.zip.Deflater
import java.util.zip.DeflaterOutputStream
import kotlin.math.exp
import kotlin.math.roundToInt

// The encoder's input is this square, with the image at its top left,
// resized to fill its width or height.
private const val SIDE = 1024

// ImageNet's mean, which the encoder subtracts, so padding with it reads as
// nothing, as the encoder's own padding would.
private val MEAN = floatArrayOf(123.675f, 116.28f, 103.53f)

// Masks whose areas are this close to a smaller one's add nothing to grow to.
private const val SAME_AREA = 0.05

// A logit's sigmoid as coverage from 0 to 255, looked up rather than worked
// out for each of a mask's pixels, which takes most of a second: logits past
// ±LOGIT_REACH are all but 0 or 255, and steps of 1/LOGIT_STEPS between are
// at most a level apart.
private const val LOGIT_REACH = 8f
private const val LOGIT_STEPS = 64
private val COVERAGE = ByteArray((2 * LOGIT_REACH * LOGIT_STEPS).toInt() + 1) { index ->
	(255 / (1 + exp(LOGIT_REACH - index.toFloat() / LOGIT_STEPS))).toInt().toByte()
}

// Segment Anything (MobileSAM), for selecting any object under a tap, as
// `mobileSamWorker.js` does on web: the encoder reads one image, once, and
// the decoder answers each tap from what it read. Not thread-safe: the module
// calls it from one thread.
internal class ObjectSelector(private val context: Context) {
	private class Sessions(val encoder: OrtSession, val decoder: OrtSession)

	// The encoder's output, which owns the embeddings until it's closed.
	private class Encoded(
		val uri: String,
		val result: OrtSession.Result,
		val embeddings: OnnxTensor,
		val width: Int,
		val height: Int,
	)

	// Nothing about what the app does leaves the device, ONNX Runtime's
	// telemetry included.
	private val env = OrtEnvironment.getEnvironment().apply { setTelemetry(false) }
	private var sessions: Sessions? = null
	private var encoded: Encoded? = null

	// Reads the image at `uri`, which `load` decodes upright, for taps,
	// replacing the one read before.
	fun prepare(uri: String, load: () -> Bitmap) {
		if (encoded?.uri == uri) return
		forgetImage()
		val (pixels, width, height) = encoderInput(load())
		val sessions = loadSessions()
		OnnxTensor.createTensor(env, pixels, longArrayOf(SIDE.toLong(), SIDE.toLong(), 3)).use { input ->
			val result = sessions.encoder.run(mapOf("input_image" to input), setOf("image_embeddings"))
			encoded = Encoded(uri, result, result.get(0) as OnnxTensor, width, height)
		}
		// The decoder's first run sets up much of what later runs reuse.
		decode(width / 2f, height / 2f).close()
	}

	// Masks of what's at `point` in the image at `uri`, from a part to the
	// whole, as grayscale PNG files, or null while that image isn't read.
	fun masks(uri: String, point: PointRecord): ObjectMasksRecord? {
		val encoded = encoded?.takeIf { it.uri == uri } ?: return null
		val (width, height) = encoded.width to encoded.height
		val size = width * height
		val masks = mutableListOf<Triple<ByteArray, Int, Float>>()
		decode((point.x * width).toFloat(), (point.y * height).toFloat()).use { result ->
			val buffer = (result.get("masks").get() as OnnxTensor).floatBuffer
			val logits = FloatArray(buffer.remaining()).also { buffer.get(it) }
			val scores = (result.get("iou_predictions").get() as OnnxTensor).floatBuffer
			val count = logits.size / size
			// The first is the single mask the decoder gives when told not to
			// guess, which the others cover.
			for (index in 1 until count) {
				// Their sigmoid, so edges stay soft.
				val values = ByteArray(size)
				var area = 0
				for (i in 0 until size) {
					val logit = logits[index * size + i]
					if (logit > 0) area++
					values[i] = COVERAGE[((logit.coerceIn(-LOGIT_REACH, LOGIT_REACH) + LOGIT_REACH) * LOGIT_STEPS).toInt()]
				}
				if (area > 0) masks.add(Triple(values, area, scores.get(index)))
			}
		}
		masks.sortBy { it.second }
		val distinct = masks.filterIndexed { index, mask ->
			index == 0 || mask.second > masks[index - 1].second * (1 + SAME_AREA)
		}
		var likeliest = 0
		distinct.forEachIndexed { index, mask -> if (mask.third > distinct[likeliest].third) likeliest = index }
		return ObjectMasksRecord(distinct.map { writePng(it.first, width, height) }, likeliest)
	}

	// Lets go of the models and the image, until they're needed again.
	fun release() {
		forgetImage()
		sessions?.let {
			it.encoder.close()
			it.decoder.close()
		}
		sessions = null
	}

	private fun forgetImage() {
		encoded?.result?.close()
		encoded = null
	}

	private fun decode(x: Float, y: Float): OrtSession.Result {
		val encoded = encoded ?: throw ObjectSelectionException("No image is read")
		fun tensor(values: FloatArray, vararg shape: Long) = OnnxTensor.createTensor(env, FloatBuffer.wrap(values), shape)
		val inputs = mapOf(
			// The point, and the padding point the decoder expects without a box.
			"point_coords" to tensor(floatArrayOf(x, y, 0f, 0f), 1, 2, 2),
			"point_labels" to tensor(floatArrayOf(1f, -1f), 1, 2),
			"mask_input" to tensor(FloatArray(256 * 256), 1, 1, 256, 256),
			"has_mask_input" to tensor(floatArrayOf(0f), 1),
			"orig_im_size" to tensor(floatArrayOf(encoded.height.toFloat(), encoded.width.toFloat()), 2),
		)
		try {
			return loadSessions().decoder.run(
				inputs + ("image_embeddings" to encoded.embeddings),
				setOf("masks", "iou_predictions"),
			)
		} finally {
			inputs.values.forEach { it.close() }
		}
	}

	private fun loadSessions(): Sessions {
		sessions?.let { return it }
		fun model(name: String) = context.assets.open("mobile-sam/$name.onnx").use { it.readBytes() }
		// Without an arena, ONNX Runtime frees what a run allocated once it's
		// done: with one, the encoder kept half a gigabyte, and ran no faster.
		fun options() = OrtSession.SessionOptions().apply { setCPUArenaAllocator(false) }
		return Sessions(
			env.createSession(model("mobile_sam_image_encoder"), options()),
			env.createSession(model("sam_mask_decoder_multi"), options()),
		).also { sessions = it }
	}

	// A grayscale PNG of `values`, one byte a pixel. Android's own encoder
	// takes only color bitmaps and is slow at this size, so the rows are
	// deflated here, quickly: the file lives only until the editor reads it.
	private fun writePng(values: ByteArray, width: Int, height: Int): SubjectMaskRecord {
		// Each row starts with its filter, none.
		val rows = ByteArray((width + 1) * height)
		for (row in 0 until height) System.arraycopy(values, row * width, rows, row * (width + 1) + 1, width)
		val deflater = Deflater(Deflater.BEST_SPEED)
		val compressed = ByteArrayOutputStream()
		DeflaterOutputStream(compressed, deflater).use { it.write(rows) }
		deflater.end()
		val file = File(context.cacheDir, "object-${UUID.randomUUID()}.png")
		DataOutputStream(BufferedOutputStream(FileOutputStream(file))).use { out ->
			out.write(byteArrayOf(-119, 80, 78, 71, 13, 10, 26, 10))
			fun chunk(type: String, data: ByteArray) {
				val name = type.toByteArray(Charsets.US_ASCII)
				out.writeInt(data.size)
				out.write(name)
				out.write(data)
				out.writeInt(CRC32().apply { update(name); update(data) }.value.toInt())
			}
			// 8 bits of gray, no interlacing.
			chunk("IHDR", ByteBuffer.allocate(13).putInt(width).putInt(height).put(byteArrayOf(8, 0, 0, 0, 0)).array())
			chunk("IDAT", compressed.toByteArray())
			chunk("IEND", ByteArray(0))
		}
		return SubjectMaskRecord(Uri.fromFile(file).toString(), width.toDouble(), height.toDouble())
	}
}

// `upright` resized to the encoder's side on its longer side, as floats from
// 0 to 255 in RGB order, padded to a square. Recycles `upright`.
private fun encoderInput(upright: Bitmap): Triple<FloatBuffer, Int, Int> {
	val scale = SIDE.toDouble() / maxOf(upright.width, upright.height)
	val width = (upright.width * scale).roundToInt().coerceAtLeast(1)
	val height = (upright.height * scale).roundToInt().coerceAtLeast(1)
	// Halving first keeps a big photo from aliasing, which one bilinear step would.
	var bitmap = upright
	while (bitmap.width >= width * 2 && bitmap.height >= height * 2) {
		val half = Bitmap.createScaledBitmap(bitmap, bitmap.width / 2, bitmap.height / 2, true)
		if (half !== bitmap) bitmap.recycle()
		bitmap = half
	}
	val sized = Bitmap.createScaledBitmap(bitmap, width, height, true)
	if (sized !== bitmap) bitmap.recycle()
	val argb = IntArray(width * height)
	sized.getPixels(argb, 0, width, 0, 0, width, height)
	sized.recycle()
	val floats = FloatArray(SIDE * SIDE * 3)
	for (i in 0 until SIDE * SIDE) MEAN.copyInto(floats, i * 3)
	for (row in 0 until height) {
		for (column in 0 until width) {
			val color = argb[row * width + column]
			val to = (row * SIDE + column) * 3
			floats[to] = ((color shr 16) and 0xFF).toFloat()
			floats[to + 1] = ((color shr 8) and 0xFF).toFloat()
			floats[to + 2] = (color and 0xFF).toFloat()
		}
	}
	return Triple(FloatBuffer.wrap(floats), width, height)
}

class ObjectMasksRecord(
	@Field val masks: List<SubjectMaskRecord> = emptyList(),
	@Field val likeliest: Int = 0,
) : Record

private class ObjectSelectionException(reason: String) :
	CodedException("Couldn't select objects: $reason")
