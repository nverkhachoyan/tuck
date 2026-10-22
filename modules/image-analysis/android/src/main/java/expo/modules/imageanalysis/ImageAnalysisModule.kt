package expo.modules.imageanalysis

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Rect
import android.media.ExifInterface
import android.net.Uri
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.OptionalModuleApi
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.segmentation.subject.Subject
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.io.FileOutputStream
import java.nio.FloatBuffer
import java.util.UUID
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher

class ImageAnalysisModule : Module() {
	private val context: Context
		get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

	private var faceDetector: FaceDetector? = null
	private var textRecognizer: TextRecognizer? = null
	private var subjectSegmenter: SubjectSegmenter? = null
	private var subjectsSegmenter: SubjectSegmenter? = null

	// Selecting objects reads one image at a time, and a tap waits for it,
	// off the queue the other functions share.
	private val objectQueue = CoroutineScope(Executors.newSingleThreadExecutor().asCoroutineDispatcher() + SupervisorJob())
	private val objectSelector by lazy { ObjectSelector(context) }

	override fun definition() = ModuleDefinition {
		Name("ImageAnalysis")

		Function("isAvailable") { feature: String ->
			(feature == "text" || feature == "faces" || feature == "background") && hasPlayServices()
		}

		AsyncFunction("imageSize") { uri: String ->
			val source = Uri.parse(uri)
			val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
			context.contentResolver.openInputStream(source)?.use { BitmapFactory.decodeStream(it, null, bounds) }
			if (bounds.outWidth <= 0) throw UnreadableImageException(source)
			val sideways = readOrientation(source) in SIDEWAYS
			SizeRecord(
				(if (sideways) bounds.outHeight else bounds.outWidth).toDouble(),
				(if (sideways) bounds.outWidth else bounds.outHeight).toDouble(),
			)
		}

		AsyncFunction("detectFaces") { uri: String, tiles: List<RectRecord> ->
			val bitmap = loadUpright(Uri.parse(uri))
			val detector = faceDetector ?: FaceDetection.getClient(
				FaceDetectorOptions.Builder()
					.setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
					// A head's width as a fraction of the image's. The default,
					// 0.1, misses the faces at the back of a group photo; ML Kit
					// looks at the image at every scale down to this one.
					.setMinFaceSize(0.02f)
					.build()
			).also { faceDetector = it }
			try {
				tiles.map { tile ->
					val x = tile.x.toInt()
					val y = tile.y.toInt()
					val crop = Bitmap.createBitmap(bitmap, x, y, tile.width.toInt(), tile.height.toInt())
					val faces = await(detector, detector.process(InputImage.fromBitmap(crop, 0)), "Face")
					if (crop !== bitmap) crop.recycle()
					faces.map { face ->
						face.boundingBox.let { rect(Rect(it.left + x, it.top + y, it.right + x, it.bottom + y)) }
					}
				}
			} finally {
				bitmap.recycle()
			}
		}

		AsyncFunction("detectText") { uri: String ->
			val image = InputImage.fromBitmap(loadUpright(Uri.parse(uri)), 0)
			val recognizer = textRecognizer
				?: TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).also { textRecognizer = it }
			val text = await(recognizer, recognizer.process(image), "Text")
			text.textBlocks.flatMap { block ->
				block.lines.mapNotNull { line ->
					line.boundingBox?.let { box ->
						TextRegionRecord(rect(box), line.elements.mapNotNull { it.boundingBox?.let(::rect) })
					}
				}
			}
		}

		// Every subject together, or with `at`, only the subject there. ML Kit
		// looks at the image small and scales its mask back up, so it's given
		// no more than `MAX_MASK_SIDE`.
		AsyncFunction("subjectMask") { uri: String, at: PointRecord? ->
			val bitmap = shrink(loadUpright(Uri.parse(uri)), MAX_MASK_SIDE)
			try {
				if (at == null) everySubject(bitmap) else subjectAt(bitmap, at)
			} finally {
				bitmap.recycle()
			}
		}

		Function("canSelectObjects") { true }

		AsyncFunction("prepareObjects") { uri: String ->
			objectSelector.prepare(uri) { loadUpright(Uri.parse(uri)) }
		}.runOnQueue(objectQueue)

		AsyncFunction("objectMasks") { uri: String, at: PointRecord ->
			objectSelector.masks(uri, at)
		}.runOnQueue(objectQueue)

		AsyncFunction("releaseObjects") {
			objectSelector.release()
		}.runOnQueue(objectQueue)

		OnDestroy {
			faceDetector?.close()
			textRecognizer?.close()
			subjectSegmenter?.close()
			subjectsSegmenter?.close()
		}
	}

	private fun everySubject(bitmap: Bitmap): SubjectMaskRecord? {
		val segmenter = subjectSegmenter ?: SubjectSegmentation.getClient(
			SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build()
		).also { subjectSegmenter = it }
		val result = await(segmenter, segmenter.process(InputImage.fromBitmap(bitmap, 0)), "Background")
		return result.foregroundConfidenceMask?.let { writeMask(it, bitmap.width, bitmap.height) }
	}

	// Each subject comes with a mask of its own box, which is placed in an
	// otherwise empty mask the size of the image.
	private fun subjectAt(bitmap: Bitmap, at: PointRecord): SubjectMaskRecord? {
		val segmenter = subjectsSegmenter ?: SubjectSegmentation.getClient(
			SubjectSegmenterOptions.Builder()
				.enableMultipleSubjects(
					SubjectSegmenterOptions.SubjectResultOptions.Builder().enableConfidenceMask().build()
				)
				.build()
		).also { subjectsSegmenter = it }
		val result = await(segmenter, segmenter.process(InputImage.fromBitmap(bitmap, 0)), "Background")
		val x = (at.x * bitmap.width).toInt().coerceIn(0, bitmap.width - 1)
		val y = (at.y * bitmap.height).toInt().coerceIn(0, bitmap.height - 1)
		val subject = nearestSubject(result.subjects, x, y, bitmap.width, bitmap.height) ?: return null
		val confidences = subject.confidenceMask ?: return null
		val full = FloatBuffer.allocate(bitmap.width * bitmap.height)
		confidences.rewind()
		for (row in 0 until subject.height) {
			full.position((subject.startY + row) * bitmap.width + subject.startX)
			for (column in 0 until subject.width) full.put(confidences.get())
		}
		return writeMask(full, bitmap.width, bitmap.height)
	}

	private fun hasPlayServices() =
		GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

	// ML Kit ignores EXIF, so the bitmap is turned upright before it looks.
	private fun loadUpright(uri: Uri): Bitmap {
		val bitmap = context.contentResolver.openInputStream(uri)?.use(BitmapFactory::decodeStream)
			?: throw UnreadableImageException(uri)
		val matrix = exifMatrix(readOrientation(uri)) ?: return bitmap
		val upright = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
		if (upright !== bitmap) bitmap.recycle()
		return upright
	}

	// A grayscale PNG in the cache, or null when no pixel is more likely the
	// subject than not.
	private fun writeMask(confidences: FloatBuffer, width: Int, height: Int): SubjectMaskRecord? {
		val pixels = IntArray(width * height)
		var found = false
		confidences.rewind()
		for (i in pixels.indices) {
			val confidence = confidences.get().coerceIn(0f, 1f)
			if (confidence >= 0.5f) found = true
			val value = (confidence * 255 + 0.5f).toInt()
			pixels[i] = (0xFF shl 24) or (value shl 16) or (value shl 8) or value
		}
		if (!found) return null
		val mask = Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
		val file = File(context.cacheDir, "mask-${UUID.randomUUID()}.png")
		try {
			FileOutputStream(file).use { mask.compress(Bitmap.CompressFormat.PNG, 100, it) }
		} finally {
			mask.recycle()
		}
		return SubjectMaskRecord(Uri.fromFile(file).toString(), width.toDouble(), height.toDouble())
	}

	private fun readOrientation(uri: Uri): Int =
		runCatching {
			context.contentResolver.openInputStream(uri)?.use {
				ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
			}
		}.getOrNull() ?: ExifInterface.ORIENTATION_NORMAL

	// A model missing because the app was installed offline is asked for now,
	// so trying again once it's downloaded works.
	private fun <T> await(api: OptionalModuleApi, task: Task<T>, feature: String): T =
		try {
			Tasks.await(task)
		} catch (e: ExecutionException) {
			val cause = e.cause
			if (cause is MlKitException && cause.errorCode == MlKitException.UNAVAILABLE) {
				ModuleInstall.getClient(context)
					.installModules(ModuleInstallRequest.newBuilder().addApi(api).build())
				throw ModelUnavailableException(feature)
			}
			throw cause ?: e
		}
}

private const val MAX_MASK_SIDE = 2048

// How far from a tap a subject can be and still be picked, as a share of the
// image's longer side: a tap just off its edge still means it.
private const val PICK_REACH = 0.02

// The subject under (`x`, `y`) in an image `width` by `height`, or the nearest
// one within `PICK_REACH`.
private fun nearestSubject(subjects: List<Subject>, x: Int, y: Int, width: Int, height: Int): Subject? {
	val reach = maxOf(1, (PICK_REACH * maxOf(width, height)).toInt())
	var nearest: Subject? = null
	var nearestDistance = reach * reach + 1
	for (subject in subjects) {
		val mask = subject.confidenceMask ?: continue
		val left = maxOf(subject.startX, x - reach)
		val right = minOf(subject.startX + subject.width - 1, x + reach)
		val top = maxOf(subject.startY, y - reach)
		val bottom = minOf(subject.startY + subject.height - 1, y + reach)
		for (row in top..bottom) {
			for (column in left..right) {
				val distance = (row - y) * (row - y) + (column - x) * (column - x)
				if (distance >= nearestDistance) continue
				val index = (row - subject.startY) * subject.width + (column - subject.startX)
				if (mask.get(index) >= 0.5f) {
					nearest = subject
					nearestDistance = distance
				}
			}
		}
	}
	return nearest
}

// `bitmap` itself if it fits in `maxSide`, or else a smaller copy of it,
// which recycles the original.
private fun shrink(bitmap: Bitmap, maxSide: Int): Bitmap {
	val scale = maxSide.toFloat() / maxOf(bitmap.width, bitmap.height)
	if (scale >= 1f) return bitmap
	val shrunk = Bitmap.createScaledBitmap(
		bitmap,
		(bitmap.width * scale).toInt().coerceAtLeast(1),
		(bitmap.height * scale).toInt().coerceAtLeast(1),
		true,
	)
	if (shrunk !== bitmap) bitmap.recycle()
	return shrunk
}

private val SIDEWAYS = setOf(
	ExifInterface.ORIENTATION_TRANSPOSE,
	ExifInterface.ORIENTATION_ROTATE_90,
	ExifInterface.ORIENTATION_TRANSVERSE,
	ExifInterface.ORIENTATION_ROTATE_270,
)

private fun exifMatrix(orientation: Int): Matrix? {
	val matrix = Matrix()
	when (orientation) {
		ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
		ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
		ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1f, -1f)
		ExifInterface.ORIENTATION_TRANSPOSE -> matrix.apply { setRotate(90f); postScale(-1f, 1f) }
		ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
		ExifInterface.ORIENTATION_TRANSVERSE -> matrix.apply { setRotate(-90f); postScale(-1f, 1f) }
		ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(270f)
		else -> return null
	}
	return matrix
}

private fun rect(box: Rect) = RectRecord(
	box.left.toDouble(),
	box.top.toDouble(),
	box.width().toDouble(),
	box.height().toDouble(),
)

class RectRecord(
	@Field val x: Double = 0.0,
	@Field val y: Double = 0.0,
	@Field val width: Double = 0.0,
	@Field val height: Double = 0.0,
) : Record

class PointRecord(
	@Field val x: Double = 0.0,
	@Field val y: Double = 0.0,
) : Record

class SizeRecord(
	@Field val width: Double = 0.0,
	@Field val height: Double = 0.0,
) : Record

class SubjectMaskRecord(
	@Field val uri: String = "",
	@Field val width: Double = 0.0,
	@Field val height: Double = 0.0,
) : Record

class TextRegionRecord(
	@Field val line: RectRecord = RectRecord(),
	@Field val words: List<RectRecord> = emptyList(),
) : Record

private class UnreadableImageException(uri: Uri) :
	CodedException("Couldn't read the image at $uri")

// Play services downloads each model on its own, after the app is installed.
private class ModelUnavailableException(feature: String) :
	CodedException("$feature detection is still being downloaded. Try again in a moment.")
