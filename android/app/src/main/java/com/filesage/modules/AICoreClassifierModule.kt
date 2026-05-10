package com.filesage.modules

import android.content.Intent
import android.content.pm.PackageManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AICoreClassifierModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private val ioExecutor = NativeIoExecutor.acquire()

  override fun getName(): String = "AICoreClassifierModule"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    ioExecutor.execute {
      try {
        promise.resolve(hasAICorePackage() && hasGeminiNanoCapability())
      } catch (_: Exception) {
        promise.resolve(false)
      }
    }
  }

  @ReactMethod
  fun classifyPath(path: String, promise: Promise) {
    ioExecutor.execute {
      val normalizedPath = path.trim()
      if (!ENABLE_AICORE_CLASSIFICATION || normalizedPath.isEmpty()) {
        promise.resolve(null)
        return@execute
      }

      // TODO(phase-7): Replace stub with real AICore Gemini Nano text classification flow.
      // Docs: https://developer.android.com/ai/aicore
      promise.resolve(null)
    }
  }

  override fun invalidate() {
    super.invalidate()
    NativeIoExecutor.release()
  }

  private fun hasAICorePackage(): Boolean = isPackageInstalled(AICORE_PACKAGE_NAME)

  private fun hasGeminiNanoCapability(): Boolean {
    val packageManager = reactContext.packageManager

    if (packageManager.hasSystemFeature(GEMINI_NANO_FEATURE)) {
      return true
    }

    val serviceIntent = Intent(AICORE_SERVICE_ACTION).setPackage(AICORE_PACKAGE_NAME)
    val matchingServices = packageManager.queryIntentServices(serviceIntent, PackageManager.MATCH_DEFAULT_ONLY)
    return matchingServices.isNotEmpty()
  }

  private fun isPackageInstalled(packageName: String): Boolean =
    try {
      reactContext.packageManager.getPackageInfo(packageName, 0)
      true
    } catch (_: Exception) {
      false
    }

  companion object {
    private const val ENABLE_AICORE_CLASSIFICATION = false
    private const val AICORE_PACKAGE_NAME = "com.google.android.aicore"
    private const val AICORE_SERVICE_ACTION = "com.google.android.aicore.service.AICORE_SERVICE"
    private const val GEMINI_NANO_FEATURE = "com.google.android.feature.GEMINI_NANO"
  }
}
