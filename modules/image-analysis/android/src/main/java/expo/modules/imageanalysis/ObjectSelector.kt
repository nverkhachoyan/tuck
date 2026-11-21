package expo.modules.imageanalysis

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
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
import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.roundToInt

// The encoder's input is this square, with the image at its top left,
// resized to fill its width or height.
private const val SIDE = 1024

// ImageNet's mean, which the encoder subtracts, so padding with it reads as
// nothing, as the encoder's own padding would.
private val MEAN = floatArrayOf(123.675f, 116.28f, 103.53f)

// Masks whose areas are this close to a smaller one's add nothing to grow to.
private const val SAME_AREA = 0.05

// How much steeper than its sigmoid a mask's coverage rises across its edge.
// A box's mask can be unsure all through (logits under 3 inside), and at its
// sigmoid an object taken out after being added left a ghost of itself.
private const val SHARPNESS = 8f

// Small-box crop re-encoding parameters, matching `objectCrop.ts`.
private const val CROP_PAD = 0.1
private const val MAX_CROP_SHARE = 0.5
private const val MIN_CROP_PIXELS = 16.0
private const val REFINED_MASK_MAX_SIDE = 2048

// A steepened logit's sigmoid as coverage from 0 to 255, looked up rather
// than worked out for each of a mask's pixels, which takes most of a second:
// steepened logits past ±LOGIT_REACH are all but 0 or 255, and steps of
// 1/LOGIT_STEPS between are at most a level apart.
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
		val sourceWidth: Int,
		val sourceHeight: Int,
	)

	private class CropPlan(
		val outputWidth: Int,
		val outputHeight: Int,
		val pasteX: Int,
		val pasteY: Int,
		val pasteWidth: Int,
		val pasteHeight: Int,
		val sourceX: Double,
		val sourceY: Double,
		val sourceWidth: Double,
		val sourceHeight: Double,
		val intSourceRect: Rect,
		val encodeWidth: Int,
		val encodeHeight: Int,
		val boxLeft: Float,
		val boxTop: Float,
		val boxRight: Float,
		val boxBottom: Float,
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
		val upright = load()
		val sourceWidth = upright.width
		val sourceHeight = upright.height
		val (pixels, width, height) = encoderInput(upright)
		val sessions = loadSessions()
		OnnxTensor.createTensor(env, pixels, longArrayOf(SIDE.toLong(), SIDE.toLong(), 3)).use { input ->
			val result = sessions.encoder.run(mapOf("input_image" to input), setOf("image_embeddings"))
			encoded = Encoded(uri, result, result.get(0) as OnnxTensor, width, height, sourceWidth, sourceHeight)
		}
		// The decoder's first run sets up much of what later runs reuse.
		decode(encoded!!.embeddings, width, height, pointPrompt(width / 2f, height / 2f)).close()
	}

	// Masks of the object `prompt` points at, from a part to the whole, or
	// boxes, just the one, in the image at `uri`, as grayscale PNG files, or
	// null while that image isn't read.
	fun masks(uri: String, prompt: ObjectPromptRecord, loadCrop: (Rect) -> Bitmap): ObjectMasksRecord? {
		val encoded = encoded?.takeIf { it.uri == uri } ?: return null
		val box = prompt.box
		if (box != null) {
			val plan = planCrop(encoded.sourceWidth, encoded.sourceHeight, box)
			if (plan != null) {
				val refined = refinedBoxMask(plan, loadCrop)
				if (refined != null) return ObjectMasksRecord(listOf(refined), 0)
			}
		}
		val (width, height) = encoded.width to encoded.height
		val point = prompt.point
		val decoderPrompt = when {
			box != null -> boxPrompt(
				(box.x * width).toFloat(),
				(box.y * height).toFloat(),
				((box.x + box.width) * width).toFloat(),
				((box.y + box.height) * height).toFloat(),
			)
			point != null -> pointPrompt((point.x * width).toFloat(), (point.y * height).toFloat())
			else -> throw ObjectSelectionException("A prompt needs a point or a box")
		}
		val size = width * height
		val masks = mutableListOf<Triple<ByteArray, Int, Float>>()
		decode(encoded.embeddings, width, height, decoderPrompt).use { result ->
			val buffer = (result.get("masks").get() as OnnxTensor).floatBuffer
			val logits = FloatArray(buffer.remaining()).also { buffer.get(it) }
			val scores = (result.get("iou_predictions").get() as OnnxTensor).floatBuffer
			val count = logits.size / size
			// The first is the single mask the decoder gives when told not to
			// guess, which the others cover: a box, which says which object it
			// means, gets that one alone, and a point the others.
			for (index in if (box != null) 0 until 1 else 1 until count) {
				// Their sigmoid, steepened, so edges stay soft.
				val values = ByteArray(size)
				var area = 0
				for (i in 0 until size) {
					val logit = logits[index * size + i]
					if (logit > 0) area++
					values[i] = COVERAGE[(((SHARPNESS * logit).coerceIn(-LOGIT_REACH, LOGIT_REACH) + LOGIT_REACH) * LOGIT_STEPS).toInt()]
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

	private fun refinedBoxMask(plan: CropPlan, loadCrop: (Rect) -> Bitmap): SubjectMaskRecord? {
		val crop = loadCrop(plan.intSourceRect)
		val pixels = cropEncoderInput(crop, plan)
		val sessions = loadSessions()
		return OnnxTensor.createTensor(env, pixels, longArrayOf(SIDE.toLong(), SIDE.toLong(), 3)).use { input ->
			sessions.encoder.run(mapOf("input_image" to input), setOf("image_embeddings")).use { encResult ->
				val cropEmbeddings = encResult.get(0) as OnnxTensor
				decode(
					cropEmbeddings,
					plan.pasteWidth,
					plan.pasteHeight,
					boxPrompt(plan.boxLeft, plan.boxTop, plan.boxRight, plan.boxBottom),
				).use { decResult ->
					val buffer = (decResult.get("masks").get() as OnnxTensor).floatBuffer
					val size = plan.pasteWidth * plan.pasteHeight
					val logits = FloatArray(size).also { buffer.get(it, 0, size) }
					val values = ByteArray(size)
					var area = 0
					for (i in 0 until size) {
						val logit = logits[i]
						if (logit > 0) area++
						values[i] = COVERAGE[(((SHARPNESS * logit).coerceIn(-LOGIT_REACH, LOGIT_REACH) + LOGIT_REACH) * LOGIT_STEPS).toInt()]
					}
					if (area == 0) return null
					val full = ByteArray(plan.outputWidth * plan.outputHeight)
					for (row in 0 until plan.pasteHeight) {
						System.arraycopy(
							values,
							row * plan.pasteWidth,
							full,
							(plan.pasteY + row) * plan.outputWidth + plan.pasteX,
							plan.pasteWidth,
						)
					}
					writePng(full, plan.outputWidth, plan.outputHeight)
				}
			}
		}
	}

	private fun planCrop(sourceWidth: Int, sourceHeight: Int, box: RectRecord): CropPlan? {
		if (sourceWidth <= 0 || sourceHeight <= 0 || box.width <= 0 || box.height <= 0) return null
		val srcW = sourceWidth.toDouble()
		val srcH = sourceHeight.toDouble()
		val boxLeft = box.x * srcW
		val boxTop = box.y * srcH
		val boxWidth = box.width * srcW
		val boxHeight = box.height * srcH
		val pad = maxOf(boxWidth, boxHeight) * CROP_PAD

		val leftPx = (boxLeft - pad).coerceIn(0.0, srcW)
		val topPx = (boxTop - pad).coerceIn(0.0, srcH)
		val rightPx = (boxLeft + boxWidth + pad).coerceIn(0.0, srcW)
		val bottomPx = (boxTop + boxHeight + pad).coerceIn(0.0, srcH)

		val rawWidth = rightPx - leftPx
		val rawHeight = bottomPx - topPx
		val sourceLong = maxOf(srcW, srcH)
		val cropLong = maxOf(rawWidth, rawHeight)
		if (cropLong < MIN_CROP_PIXELS || cropLong / sourceLong > MAX_CROP_SHARE) return null

		val outScale = minOf(1.0, REFINED_MASK_MAX_SIDE / sourceLong)
		val outWidth = (srcW * outScale).roundToInt().coerceAtLeast(1)
		val outHeight = (srcH * outScale).roundToInt().coerceAtLeast(1)

		val pasteX = floor((leftPx / srcW) * outWidth).toInt().coerceIn(0, outWidth - 1)
		val pasteY = floor((topPx / srcH) * outHeight).toInt().coerceIn(0, outHeight - 1)
		val pasteRight = ceil((rightPx / srcW) * outWidth).toInt().coerceIn(pasteX + 1, outWidth)
		val pasteBottom = ceil((bottomPx / srcH) * outHeight).toInt().coerceIn(pasteY + 1, outHeight)
		val pasteWidth = pasteRight - pasteX
		val pasteHeight = pasteBottom - pasteY

		val normLeft = pasteX.toDouble() / outWidth
		val normTop = pasteY.toDouble() / outHeight
		val normWidth = pasteWidth.toDouble() / outWidth
		val normHeight = pasteHeight.toDouble() / outHeight

		val sourceX = normLeft * srcW
		val sourceY = normTop * srcH
		val sourceCropW = normWidth * srcW
		val sourceCropH = normHeight * srcH

		val rx = floor(sourceX).toInt().coerceIn(0, sourceWidth - 1)
		val ry = floor(sourceY).toInt().coerceIn(0, sourceHeight - 1)
		val rx2 = ceil(sourceX + sourceCropW).toInt().coerceIn(rx + 1, sourceWidth)
		val ry2 = ceil(sourceY + sourceCropH).toInt().coerceIn(ry + 1, sourceHeight)

		val encScale = SIDE.toDouble() / maxOf(sourceCropW, sourceCropH)
		val encodeWidth = (sourceCropW * encScale).roundToInt().coerceAtLeast(1)
		val encodeHeight = (sourceCropH * encScale).roundToInt().coerceAtLeast(1)

		val bx0 = (((box.x - normLeft) / normWidth).coerceIn(0.0, 1.0) * encodeWidth).toFloat()
		val by0 = (((box.y - normTop) / normHeight).coerceIn(0.0, 1.0) * encodeHeight).toFloat()
		val bx1 = (((box.x + box.width - normLeft) / normWidth).coerceIn(0.0, 1.0) * encodeWidth).toFloat()
		val by1 = (((box.y + box.height - normTop) / normHeight).coerceIn(0.0, 1.0) * encodeHeight).toFloat()

		return CropPlan(
			outputWidth = outWidth,
			outputHeight = outHeight,
			pasteX = pasteX,
			pasteY = pasteY,
			pasteWidth = pasteWidth,
			pasteHeight = pasteHeight,
			sourceX = sourceX,
			sourceY = sourceY,
			sourceWidth = sourceCropW,
			sourceHeight = sourceCropH,
			intSourceRect = Rect(rx, ry, rx2, ry2),
			encodeWidth = encodeWidth,
			encodeHeight = encodeHeight,
			boxLeft = bx0,
			boxTop = by0,
			boxRight = bx1,
			boxBottom = by1,
		)
	}

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

	// A point, and the padding point the decoder expects without a box.
	private fun pointPrompt(x: Float, y: Float) = DecoderPrompt(floatArrayOf(x, y, 0f, 0f), floatArrayOf(1f, -1f))

	// A box, as its top left and bottom right corners, labelled as SAM's are.
	private fun boxPrompt(left: Float, top: Float, right: Float, bottom: Float) =
		DecoderPrompt(floatArrayOf(left, top, right, bottom), floatArrayOf(2f, 3f))

	private class DecoderPrompt(val coords: FloatArray, val labels: FloatArray)

	private fun decode(
		embeddings: OnnxTensor,
		outputWidth: Int,
		outputHeight: Int,
		prompt: DecoderPrompt,
	): OrtSession.Result {
		fun tensor(values: FloatArray, vararg shape: Long) = OnnxTensor.createTensor(env, FloatBuffer.wrap(values), shape)
		val points = prompt.labels.size.toLong()
		val inputs = mapOf(
			"point_coords" to tensor(prompt.coords, 1, points, 2),
			"point_labels" to tensor(prompt.labels, 1, points),
			"mask_input" to tensor(FloatArray(256 * 256), 1, 1, 256, 256),
			"has_mask_input" to tensor(floatArrayOf(0f), 1),
			"orig_im_size" to tensor(floatArrayOf(outputHeight.toFloat(), outputWidth.toFloat()), 2),
		)
		try {
			return loadSessions().decoder.run(
				inputs + ("image_embeddings" to embeddings),
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
	private fun cropEncoderInput(crop: Bitmap, plan: CropPlan): FloatBuffer {
		var bitmap = crop
		var subLeft = (plan.sourceX - plan.intSourceRect.left).toFloat()
		var subTop = (plan.sourceY - plan.intSourceRect.top).toFloat()
		var subWidth = plan.sourceWidth.toFloat()
		var subHeight = plan.sourceHeight.toFloat()
		while (bitmap.width >= plan.encodeWidth * 2 && bitmap.height >= plan.encodeHeight * 2) {
			val half = Bitmap.createScaledBitmap(bitmap, bitmap.width / 2, bitmap.height / 2, true)
			val sx = half.width.toFloat() / bitmap.width
			val sy = half.height.toFloat() / bitmap.height
			subLeft *= sx
			subTop *= sy
			subWidth *= sx
			subHeight *= sy
			if (half !== bitmap) bitmap.recycle()
			bitmap = half
		}
		val sized = Bitmap.createBitmap(plan.encodeWidth, plan.encodeHeight, Bitmap.Config.ARGB_8888)
		val matrix = Matrix().apply {
			setRectToRect(
				RectF(subLeft, subTop, subLeft + subWidth, subTop + subHeight),
				RectF(0f, 0f, plan.encodeWidth.toFloat(), plan.encodeHeight.toFloat()),
				Matrix.ScaleToFit.FILL,
			)
		}
		Canvas(sized).drawBitmap(bitmap, matrix, Paint(Paint.FILTER_BITMAP_FLAG))
		bitmap.recycle()
		return bitmapToEncoderFloats(sized)
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
	return Triple(bitmapToEncoderFloats(sized), width, height)
}

// Extracts RGB floats padded with `MEAN` into `SIDE x SIDE x 3` and recycles `sized`.
private fun bitmapToEncoderFloats(sized: Bitmap): FloatBuffer {
	val width = sized.width
	val height = sized.height
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
	return FloatBuffer.wrap(floats)
}

// A point on an object or a box around it, as fractions of the image.
class ObjectPromptRecord(
	@Field val point: PointRecord? = null,
	@Field val box: RectRecord? = null,
) : Record

class ObjectMasksRecord(
	@Field val masks: List<SubjectMaskRecord> = emptyList(),
	@Field val likeliest: Int = 0,
) : Record

private class ObjectSelectionException(reason: String) :
	CodedException("Couldn't select objects: $reason")
