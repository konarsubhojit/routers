package com.filesage.modules

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class HashingModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val ioExecutor: ExecutorService = Executors.newSingleThreadExecutor()

  override fun getName(): String = "HashingModule"

  @ReactMethod
  fun sha256(contentUriString: String, promise: Promise) {
    ioExecutor.execute {
      try {
        val contentUri = Uri.parse(contentUriString)
        val digest = MessageDigest.getInstance("SHA-256")

        reactContext.contentResolver.openInputStream(contentUri)?.use { stream ->
          val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
          while (true) {
            val bytesRead = stream.read(buffer)
            if (bytesRead < 0) {
              break
            }
            digest.update(buffer, 0, bytesRead)
          }
        } ?: throw IOException("Unable to open content URI input stream.")

        promise.resolve(digest.digest().toHexString())
      } catch (securityException: SecurityException) {
        promise.reject("E_PERMISSION_DENIED", "Missing read permission for the content URI.", securityException)
      } catch (error: Exception) {
        promise.reject("E_HASH_FAILED", "Failed to compute SHA-256 for content URI.", error)
      }
    }
  }

  override fun invalidate() {
    super.invalidate()
    ioExecutor.shutdown()
  }
}

private fun ByteArray.toHexString(): String {
  val output = StringBuilder(size * 2)
  for (byte in this) {
    output.append(((byte.toInt() shr 4) and 0x0f).toString(16))
    output.append((byte.toInt() and 0x0f).toString(16))
  }
  return output.toString()
}
