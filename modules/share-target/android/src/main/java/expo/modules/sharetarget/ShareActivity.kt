package expo.modules.sharetarget

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.MimeTypeMap
import java.io.File
import java.util.UUID

/**
 * Takes a photo shared from another app's share sheet and opens Tuck on it.
 * The photo comes as a content URI that only this activity may read, so it's
 * copied into the cache first, and the app is opened with the copy's name:
 * <scheme>://share?file=<name>, as on iOS.
 */
class ShareActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val source = sharedImage(intent)
    if (source == null) {
      finish()
      return
    }
    // A large photo, or one a cloud provider fetches, takes a moment to copy.
    Thread {
      val name = try {
        copy(source)
      } catch (error: Exception) {
        Log.w(TAG, "Couldn't copy the shared photo", error)
        null
      }
      runOnUiThread {
        if (name != null) openApp(name)
        finish()
      }
    }.start()
  }

  private fun sharedImage(intent: Intent): Uri? {
    if (intent.action != Intent.ACTION_SEND) return null
    val stream = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }
    return stream ?: intent.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.uri
  }

  // Replaces the last photo shared, which the app deletes once it's read it
  // but may not have if it couldn't open.
  private fun copy(source: Uri): String {
    val folder = File(cacheDir, FOLDER)
    folder.deleteRecursively()
    folder.mkdirs()
    val type = contentResolver.getType(source)
    val ext = type?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) } ?: "jpg"
    val name = "${UUID.randomUUID()}.$ext"
    val input = contentResolver.openInputStream(source)
      ?: throw IllegalStateException("No stream for $source")
    input.use { stream ->
      File(folder, name).outputStream().use { stream.copyTo(it) }
    }
    return name
  }

  private fun openApp(name: String) {
    val info = packageManager.getActivityInfo(componentName, PackageManager.GET_META_DATA)
    val scheme = info.metaData?.getString(SCHEME) ?: return
    val url = Uri.Builder()
      .scheme(scheme)
      .authority("share")
      .appendQueryParameter("file", name)
      .build()
    // The main activity takes the link like any other, as its launch URL or
    // a new intent if it's running.
    startActivity(
      Intent(Intent.ACTION_VIEW, url)
        .setPackage(packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
  }

  companion object {
    private const val TAG = "ShareActivity"

    // Also named in src/photos/sharedPhoto.ts and the iOS share extension.
    private const val FOLDER = "shared-photos"

    // Set by the config plugin, from app.json's scheme.
    private const val SCHEME = "expo.modules.sharetarget.SCHEME"
  }
}
