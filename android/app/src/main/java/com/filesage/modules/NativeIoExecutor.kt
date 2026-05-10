package com.filesage.modules

import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

object NativeIoExecutor {
  // Two threads allow one scan task and one hash task to overlap, matching typical usage
  // while avoiding excessive context switching from larger pools.
  private const val NATIVE_IO_THREAD_POOL_SIZE = 2
  private var activeClients = 0
  private var sharedExecutor: ExecutorService? = null

  // Scanner and hashing are both I/O-bound and short-lived; two workers allow overlap
  // (e.g., one scan + one hash) without creating a thread per module.
  @Synchronized
  fun acquire(): ExecutorService {
    activeClients += 1
    if (sharedExecutor == null) {
      sharedExecutor = Executors.newFixedThreadPool(NATIVE_IO_THREAD_POOL_SIZE)
    }
    return checkNotNull(sharedExecutor)
  }

  @Synchronized
  fun release() {
    check(activeClients > 0) {
      "NativeIoExecutor.release() called without a matching acquire(). Active clients: $activeClients"
    }
    activeClients -= 1
    if (activeClients == 0) {
      // shutdown() lets in-flight work drain while preventing new submissions.
      sharedExecutor?.shutdown()
      sharedExecutor = null
    }
  }
}
