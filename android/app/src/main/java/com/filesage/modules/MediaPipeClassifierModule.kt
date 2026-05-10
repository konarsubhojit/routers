package com.filesage.modules

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mediapipe.tasks.components.containers.Category
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.text.textclassifier.TextClassifier
import com.google.mediapipe.tasks.text.textclassifier.TextClassifierResult
import java.io.IOException

class MediaPipeClassifierModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private val ioExecutor = NativeIoExecutor.acquire()

  @Volatile
  private var classifier: TextClassifier? = null

  override fun getName(): String = "MediaPipeClassifierModule"

  @ReactMethod
  fun isModelAvailable(promise: Promise) {
    ioExecutor.execute {
      promise.resolve(hasModelAsset())
    }
  }

  @ReactMethod
  fun classifyText(text: String, promise: Promise) {
    ioExecutor.execute {
      try {
        if (!hasModelAsset()) {
          promise.resolve(null)
          return@execute
        }

        val trimmedText = text.trim()
        if (trimmedText.isEmpty()) {
          promise.resolve(null)
          return@execute
        }

        val result = getOrCreateClassifier().classify(trimmedText)
        promise.resolve(extractTopLabel(result))
      } catch (error: Exception) {
        val detail = error.message ?: "unknown error"
        promise.reject(
          "E_MEDIAPIPE_CLASSIFY_FAILED",
          "Failed to classify text with MediaPipe: $detail",
          error,
        )
      }
    }
  }

  override fun invalidate() {
    super.invalidate()
    synchronized(this) {
      classifier?.close()
      classifier = null
    }
    NativeIoExecutor.release()
  }

  @Synchronized
  private fun getOrCreateClassifier(): TextClassifier {
    classifier?.let { return it }

    if (!hasModelAsset()) {
      throw IOException("Missing MediaPipe model asset at $MODEL_ASSET_PATH.")
    }

    val options =
      TextClassifier.TextClassifierOptions.builder()
        .setBaseOptions(BaseOptions.builder().setModelAssetPath(MODEL_ASSET_PATH).build())
        .build()

    val createdClassifier = TextClassifier.createFromOptions(reactContext, options)
    classifier = createdClassifier
    return createdClassifier
  }

  private fun hasModelAsset(): Boolean =
    try {
      reactContext.assets.open(MODEL_ASSET_PATH).use { _ -> }
      true
    } catch (_: IOException) {
      false
    }

  private fun extractTopLabel(result: TextClassifierResult?): String? {
    if (result == null) {
      return null
    }

    var topCategory: Category? = null
    for (classification in result.classifications()) {
      for (category in classification.categories()) {
        if (topCategory == null || category.score() > topCategory.score()) {
          topCategory = category
        }
      }
    }

    val categoryName = topCategory?.categoryName()?.trim().orEmpty()
    if (categoryName.isNotEmpty()) {
      return categoryName
    }

    val displayName = topCategory?.displayName()?.trim().orEmpty()
    if (displayName.isNotEmpty()) {
      return displayName
    }

    return null
  }

  companion object {
    private const val MODEL_ASSET_PATH = "mediapipe_text_classifier.tflite"
  }
}
