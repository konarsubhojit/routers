package com.filesage.modules

import android.net.Uri
import android.provider.DocumentsContract
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FolderManagerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private val ioExecutor = NativeIoExecutor.acquire()

  override fun getName(): String = "FolderManagerModule"

  @ReactMethod
  fun ensureChildDirectory(treeUriString: String, name: String, promise: Promise) {
    ioExecutor.execute {
      try {
        val normalizedName = name.trim()
        if (normalizedName.isEmpty() || normalizedName.contains("/")) {
          promise.reject(
            "E_INVALID_DIRECTORY_NAME",
            "Directory name must be a non-empty single path segment.",
          )
          return@execute
        }

        val treeUri = Uri.parse(treeUriString)
        if (!DocumentsContract.isTreeUri(treeUri)) {
          promise.reject("E_INVALID_TREE_URI", "Provided URI is not a valid SAF tree URI.")
          return@execute
        }

        val rootDocumentId = DocumentsContract.getTreeDocumentId(treeUri)
        val rootDocumentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, rootDocumentId)

        val existingChild = findExistingChildDirectory(treeUri, rootDocumentId, normalizedName)
        if (existingChild != null) {
          promise.resolve(buildChildTreeUri(existingChild).toString())
          return@execute
        }

        val createdChild =
          DocumentsContract.createDocument(
            reactContext.contentResolver,
            rootDocumentUri,
            DocumentsContract.Document.MIME_TYPE_DIR,
            normalizedName,
          )
        if (createdChild == null) {
          promise.reject("E_CREATE_FAILED", "Failed to create the requested child directory.")
          return@execute
        }

        promise.resolve(buildChildTreeUri(createdChild).toString())
      } catch (nameConflict: NameConflictException) {
        promise.reject("E_NAME_CONFLICT", nameConflict.message)
      } catch (securityException: SecurityException) {
        promise.reject(
          "E_PERMISSION_DENIED",
          "Missing write permission for the provided SAF tree URI.",
          securityException,
        )
      } catch (error: Exception) {
        promise.reject("E_ENSURE_DIRECTORY_FAILED", "Failed to ensure child directory.", error)
      }
    }
  }

  override fun invalidate() {
    super.invalidate()
    NativeIoExecutor.release()
  }

  private fun buildChildTreeUri(documentUri: Uri): Uri {
    val authority =
      requireNotNull(documentUri.authority) {
        "Document URI is missing an authority: $documentUri"
      }
    val documentId = DocumentsContract.getDocumentId(documentUri)
    return DocumentsContract.buildTreeDocumentUri(authority, documentId)
  }

  private fun findExistingChildDirectory(
    treeUri: Uri,
    parentDocumentId: String,
    name: String,
  ): Uri? {
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocumentId)
    val columns =
      arrayOf(
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
      )

    reactContext.contentResolver.query(childrenUri, columns, null, null, null)?.use { cursor ->
      val documentIdIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
      val displayNameIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
      val mimeTypeIndex = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)

      while (cursor.moveToNext()) {
        if (cursor.getString(displayNameIndex) != name) {
          continue
        }

        val documentId = cursor.getString(documentIdIndex)
        val documentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
        val mimeType = cursor.getString(mimeTypeIndex)
        if (mimeType != DocumentsContract.Document.MIME_TYPE_DIR) {
          throw NameConflictException(
            "A non-directory document already exists with the requested name.",
          )
        }

        return documentUri
      }
    }

    return null
  }

  private class NameConflictException(message: String) : IllegalStateException(message)
}
