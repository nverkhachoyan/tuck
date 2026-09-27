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
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.concurrent.ExecutionException

class ImageAnalysisModule : Module() {
	private val context: Context
		get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

	private var textRecognizer: TextRecognizer? = null

	override fun definition() = ModuleDefinition {
		Name("ImageAnalysis")

		Function("isAvailable") { feature: String ->
			feature == "text" && hasPlayServices()
		}

		AsyncFunction("detectText") { uri: String ->
			val image = InputImage.fromBitmap(loadUpright(Uri.parse(uri)), 0)
			val recognizer = textRecognizer
				?: TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).also { textRecognizer = it }
			val text = await(recognizer, recognizer.process(image))
			text.textBlocks.flatMap { block ->
				block.lines.mapNotNull { line ->
					line.boundingBox?.let { box ->
						TextRegionRecord(rect(box), line.elements.mapNotNull { it.boundingBox?.let(::rect) })
					}
				}
			}
		}

		OnDestroy {
			textRecognizer?.close()
		}
	}

	private fun hasPlayServices() =
		GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

	// ML Kit ignores EXIF, so the bitmap is turned upright before it looks.
	private fun loadUpright(uri: Uri): Bitmap {
		val resolver = context.contentResolver
		val bitmap = resolver.openInputStream(uri)?.use(BitmapFactory::decodeStream)
			?: throw UnreadableImageException(uri)
		val orientation = runCatching {
			resolver.openInputStream(uri)?.use {
				ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
			}
		}.getOrNull() ?: ExifInterface.ORIENTATION_NORMAL
		val matrix = exifMatrix(orientation) ?: return bitmap
		val upright = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
		if (upright !== bitmap) bitmap.recycle()
		return upright
	}

	// A model missing because the app was installed offline is asked for now,
	// so trying again once it's downloaded works.
	private fun <T> await(api: OptionalModuleApi, task: Task<T>): T =
		try {
			Tasks.await(task)
		} catch (e: ExecutionException) {
			val cause = e.cause
			if (cause is MlKitException && cause.errorCode == MlKitException.UNAVAILABLE) {
				ModuleInstall.getClient(context)
					.installModules(ModuleInstallRequest.newBuilder().addApi(api).build())
				throw ModelUnavailableException()
			}
			throw cause ?: e
		}
}

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

class TextRegionRecord(
	@Field val line: RectRecord = RectRecord(),
	@Field val words: List<RectRecord> = emptyList(),
) : Record

private class UnreadableImageException(uri: Uri) :
	CodedException("Couldn't read the image at $uri")

// Play services downloads each model on its own, after the app is installed.
private class ModelUnavailableException :
	CodedException("Text detection is still being downloaded. Try again in a moment.")
