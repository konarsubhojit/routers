package com.filesage.modules

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.Settings
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

class FileScannerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext),
  ActivityEventListener {

  private var pendingPermissionPromise: Promise? = null
  private val ioExecutor = NativeIoExecutor.acquire()

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = "FileScannerModule"

  @Deprecated("Use requestTreePermission for generic SAF tree selection. Planned removal after 2026-12.")
  @ReactMethod
  fun requestDownloadsTreePermission(promise: Promise) {
    requestTreePermission(promise)
  }

  @ReactMethod
  fun requestTreePermission(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "Cannot request SAF permission without an active Activity.")
      return
    }

    if (pendingPermissionPromise != null) {
      promise.reject("E_PERMISSION_IN_PROGRESS", "A SAF permission request is already in progress.")
      return
    }

    pendingPermissionPromise = promise
    val intent =
      Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
      }

    try {
      activity.startActivityForResult(intent, REQUEST_CODE_OPEN_TREE)
    } catch (error: Exception) {
      pendingPermissionPromise = null
      promise.reject("E_PERMISSION_REQUEST_FAILED", "Unable to launch SAF tree picker.", error)
    }
  }

  @ReactMethod
  fun scanTree(treeUriString: String, promise: Promise) {
    ioExecutor.execute {
      try {
        val treeUri = Uri.parse(treeUriString)
        val scheme = treeUri.scheme
        if (scheme != "content") {
          promise.reject(
            "E_UNSUPPORTED_URI_SCHEME",
            "URI scheme '${scheme ?: "null"}' is not supported; only SAF content URIs (scheme 'content') are accepted.",
          )
          return@execute
        }

        if (!DocumentsContract.isTreeUri(treeUri)) {
          promise.reject("E_INVALID_TREE_URI", "Provided URI is not a valid SAF tree URI.")
          return@execute
        }

        val files = Arguments.createArray()
        val rootDocumentId = DocumentsContract.getTreeDocumentId(treeUri)
        collectFilesRecursively(treeUri, rootDocumentId, files)
        promise.resolve(files)
      } catch (securityException: SecurityException) {
        promise.reject("E_PERMISSION_DENIED", "Missing persisted permission for the provided tree URI.", securityException)
      } catch (error: Exception) {
        promise.reject("E_SCAN_FAILED", "Failed to scan SAF tree URI.", error)
      }
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE_OPEN_TREE) {
      return
    }

    val promise = pendingPermissionPromise ?: return
    pendingPermissionPromise = null

    val treeUri = data?.data
    if (resultCode != Activity.RESULT_OK || treeUri == null) {
      promise.reject("E_PERMISSION_CANCELLED", "SAF permission flow was cancelled.")
      return
    }

    try {
      val intentFlags =
        data.flags and
          (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      if (intentFlags != 0) {
        reactContext.contentResolver.takePersistableUriPermission(treeUri, intentFlags)
      }
      promise.resolve(treeUri.toString())
    } catch (securityException: SecurityException) {
      promise.reject("E_PERSIST_PERMISSION_FAILED", "Failed to persist SAF permission.", securityException)
    }
  }

  /**
   * Opens the system settings screen that lets the user grant
   * MANAGE_EXTERNAL_STORAGE (Android 11+ / API 30+).
   * On Android < 11 this resolves immediately because the permission is
   * automatically available through READ_EXTERNAL_STORAGE.
   */
  @ReactMethod
  fun requestManageExternalStorage(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      promise.resolve(null)
      return
    }
    if (Environment.isExternalStorageManager()) {
      promise.resolve(null)
      return
    }
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject(
        "E_NO_ACTIVITY",
        "Cannot request MANAGE_EXTERNAL_STORAGE without an active Activity.",
      )
      return
    }
    try {
      val intent =
        Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
          data = Uri.fromParts("package", reactApplicationContext.packageName, null)
        }
      activity.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      try {
        activity.startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
        promise.resolve(null)
      } catch (fallback: Exception) {
        promise.reject(
          "E_PERMISSION_REQUEST_FAILED",
          "Unable to open MANAGE_EXTERNAL_STORAGE settings.",
          fallback,
        )
      }
    }
  }

  /**
   * Returns true when the app holds MANAGE_EXTERNAL_STORAGE on Android 11+,
   * or true on earlier API levels where the permission is automatically
   * available through READ_EXTERNAL_STORAGE.
   */
  @ReactMethod
  fun checkManageExternalStorageGranted(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      promise.resolve(true)
      return
    }
    promise.resolve(Environment.isExternalStorageManager())
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun invalidate() {
    super.invalidate()
    reactContext.removeActivityEventListener(this)
    NativeIoExecutor.release()
  }

  private fun collectFilesRecursively(
    treeUri: Uri,
    parentDocumentId: String,
    destination: WritableArray,
  ) {
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocumentId)
    val columns =
      arrayOf(
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_SIZE,
        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
      )

    reactContext.contentResolver.query(childrenUri, columns, null, null, null)?.use { cursor ->
      val idIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
      val nameIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      val sizeIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_SIZE)
      val modifiedAtIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
      val mimeTypeIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)

      while (cursor.moveToNext()) {
        val documentId = cursor.getString(idIndex)
        val mimeType = cursor.getString(mimeTypeIndex)

        if (mimeType == DocumentsContract.Document.MIME_TYPE_DIR) {
          collectFilesRecursively(treeUri, documentId, destination)
          continue
        }

        val fileUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
        val entry: WritableMap =
          Arguments.createMap().apply {
            putString("uri", fileUri.toString())
            putString("name", cursor.getString(nameIndex))
            if (cursor.isNull(sizeIndex)) {
              putNull("sizeBytes")
            } else {
              putDouble("sizeBytes", cursor.getLong(sizeIndex).toDouble())
            }
            if (cursor.isNull(modifiedAtIndex)) {
              putNull("mtime")
            } else {
              putDouble("mtime", cursor.getLong(modifiedAtIndex).toDouble())
            }
            putString("mimeType", mimeType)
          }
        destination.pushMap(entry)
      }
    }
  }

  companion object {
    private const val REQUEST_CODE_OPEN_TREE = 11991
  }
}
