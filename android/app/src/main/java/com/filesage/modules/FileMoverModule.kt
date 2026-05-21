package com.filesage.modules

import android.content.ContentResolver
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FileMoverModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private val ioExecutor = NativeIoExecutor.acquire()

  override fun getName(): String = "FileMoverModule"

  @ReactMethod
  fun moveDocument(
    sourceUriString: String,
    destParentUriString: String,
    displayName: String,
    promise: Promise,
  ) {
    ioExecutor.execute {
      try {
        val normalizedDisplayName = displayName.trim()
        if (normalizedDisplayName.isEmpty() || normalizedDisplayName.contains("/")) {
          promise.reject(
            "E_INVALID_DISPLAY_NAME",
            "Display name must be a non-empty single path segment.",
          )
          return@execute
        }

        val sourceUri = Uri.parse(sourceUriString)
        if (sourceUri.scheme != ContentResolver.SCHEME_CONTENT) {
          promise.reject("E_INVALID_SOURCE_URI", "Provided source URI is not a valid SAF document URI.")
          return@execute
        }

        val destinationTreeUri = Uri.parse(destParentUriString)
        if (!DocumentsContract.isTreeUri(destinationTreeUri)) {
          promise.reject("E_INVALID_DESTINATION_URI", "Provided destination URI is not a valid SAF tree URI.")
          return@execute
        }

        val destinationParentDocumentId =
          try {
            DocumentsContract.getTreeDocumentId(destinationTreeUri)
          } catch (_: IllegalArgumentException) {
            promise.reject(
              "E_INVALID_DESTINATION_URI",
              "Provided destination URI is not a valid SAF tree URI.",
            )
            return@execute
          }

        val sourceParentDocumentUri =
          try {
            buildSourceParentDocumentUri(sourceUri)
          } catch (_: IllegalArgumentException) {
            promise.reject("E_INVALID_SOURCE_URI", "Provided source URI is not a valid SAF document URI.")
            return@execute
          }

        ensureNoDestinationConflict(
          destinationTreeUri,
          destinationParentDocumentId,
          normalizedDisplayName,
        )

        val destinationParentDocumentUri =
          DocumentsContract.buildDocumentUriUsingTree(
            destinationTreeUri,
            destinationParentDocumentId,
          )

        val movedDocumentUri =
          tryMoveDocument(sourceUri, sourceParentDocumentUri, destinationParentDocumentUri)
            ?: copyThenDeleteDocument(
              sourceUri,
              destinationTreeUri,
              destinationParentDocumentUri,
              normalizedDisplayName,
            )

        promise.resolve(movedDocumentUri.toString())
      } catch (nameConflict: NameConflictException) {
        promise.reject("E_NAME_CONFLICT", nameConflict.message)
      } catch (copyFailed: CopyFailedException) {
        promise.reject("E_COPY_FAILED", copyFailed.message, copyFailed)
      } catch (deleteFailed: DeleteFailedException) {
        promise.reject("E_DELETE_FAILED", deleteFailed.message, deleteFailed)
      } catch (securityException: SecurityException) {
        promise.reject(
          "E_PERMISSION_DENIED",
          "Missing read/write permission for the provided SAF document URIs.",
          securityException,
        )
      } catch (error: Exception) {
        promise.reject("E_MOVE_FAILED", "Failed to move document.", error)
      }
    }
  }

  override fun invalidate() {
    super.invalidate()
    NativeIoExecutor.release()
  }

  private fun buildSourceParentDocumentUri(sourceUri: Uri): Uri {
    val sourceDocumentId = DocumentsContract.getDocumentId(sourceUri)
    val parentDocumentId =
      requireNotNull(getParentDocumentId(sourceDocumentId)) {
        "Source document does not have a parent directory."
      }
    return DocumentsContract.buildDocumentUriUsingTree(sourceUri, parentDocumentId)
  }

  private fun ensureNoDestinationConflict(
    destinationTreeUri: Uri,
    destinationParentDocumentId: String,
    displayName: String,
  ) {
    val childrenUri =
      DocumentsContract.buildChildDocumentsUriUsingTree(
        destinationTreeUri,
        destinationParentDocumentId,
      )
    val columns =
      arrayOf(
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      )

    reactContext.contentResolver.query(childrenUri, columns, null, null, null)?.use { cursor ->
      val displayNameIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      while (cursor.moveToNext()) {
        if (cursor.getString(displayNameIndex) == displayName) {
          throw NameConflictException(
            "A document already exists in the destination folder with this name.",
          )
        }
      }
    }
  }

  private fun tryMoveDocument(
    sourceUri: Uri,
    sourceParentDocumentUri: Uri,
    destinationParentDocumentUri: Uri,
  ): Uri? =
    try {
      DocumentsContract.moveDocument(
        reactContext.contentResolver,
        sourceUri,
        sourceParentDocumentUri,
        destinationParentDocumentUri,
      )
    } catch (_: IllegalArgumentException) {
      null
    } catch (_: IllegalStateException) {
      null
    } catch (_: UnsupportedOperationException) {
      null
    }

  private fun copyThenDeleteDocument(
    sourceUri: Uri,
    destinationTreeUri: Uri,
    destinationParentDocumentUri: Uri,
    displayName: String,
  ): Uri {
    val mimeType = resolveMimeType(sourceUri)
    val destinationDocumentUri =
      DocumentsContract.createDocument(
        reactContext.contentResolver,
        destinationParentDocumentUri,
        mimeType,
        displayName,
      ) ?: throw CopyFailedException("Failed to copy document to destination.")

    try {
      reactContext.contentResolver.openInputStream(sourceUri)?.use { input ->
        reactContext.contentResolver.openOutputStream(destinationDocumentUri, "w")?.use { output ->
          input.copyTo(output)
        } ?: throw CopyFailedException("Failed to open destination document for writing.")
      } ?: throw CopyFailedException("Failed to open source document for reading.")
    } catch (securityException: SecurityException) {
      try {
        DocumentsContract.deleteDocument(reactContext.contentResolver, destinationDocumentUri)
      } catch (cleanupError: Exception) {
        Log.w(TAG, "Failed to clean up destination after copy permission failure.", cleanupError)
      }
      throw securityException
    } catch (error: Exception) {
      try {
        DocumentsContract.deleteDocument(reactContext.contentResolver, destinationDocumentUri)
      } catch (cleanupError: Exception) {
        Log.w(TAG, "Failed to clean up partially copied destination document.", cleanupError)
      }
      throw CopyFailedException("Failed to copy document to destination.", error)
    }

    if (!DocumentsContract.deleteDocument(reactContext.contentResolver, sourceUri)) {
      try {
        DocumentsContract.deleteDocument(reactContext.contentResolver, destinationDocumentUri)
      } catch (cleanupError: Exception) {
        Log.w(TAG, "Failed to clean up copied destination after delete failure.", cleanupError)
      }
      throw DeleteFailedException("Moved copy created, but failed to delete the source document.")
    }

    return DocumentsContract.buildDocumentUriUsingTree(
      destinationTreeUri,
      DocumentsContract.getDocumentId(destinationDocumentUri),
    )
  }

  private fun resolveMimeType(sourceUri: Uri): String {
    reactContext.contentResolver.getType(sourceUri)?.let { return it }

    val columns = arrayOf(DocumentsContract.Document.COLUMN_MIME_TYPE)
    reactContext.contentResolver.query(sourceUri, columns, null, null, null)?.use { cursor ->
      val mimeTypeIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
      if (cursor.moveToFirst()) {
        cursor.getString(mimeTypeIndex)?.let { return it }
      }
    }

    return "application/octet-stream"
  }

  private fun getParentDocumentId(documentId: String): String? {
    val separatorIndex = documentId.indexOf(':')
    if (separatorIndex < 0) {
      return null
    }

    val rootPrefix = documentId.slice(0..separatorIndex)
    val relativePath = documentId.slice(separatorIndex + 1 until documentId.length)
    if (relativePath.isEmpty()) {
      return null
    }

    val lastSlashIndex = relativePath.lastIndexOf('/')
    if (lastSlashIndex < 0) {
      return rootPrefix
    }

    return "$rootPrefix${relativePath.slice(0 until lastSlashIndex)}"
  }

  private class NameConflictException(message: String) : IllegalStateException(message)

  private class CopyFailedException(message: String, cause: Throwable? = null) :
    IllegalStateException(message, cause)

  private class DeleteFailedException(message: String, cause: Throwable? = null) :
    IllegalStateException(message, cause)

  companion object {
    private const val TAG = "FileMoverModule"
  }
}
