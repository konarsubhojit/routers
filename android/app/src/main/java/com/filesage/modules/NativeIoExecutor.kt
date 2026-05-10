package com.filesage.modules

import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

object NativeIoExecutor {
  val executor: ExecutorService = Executors.newFixedThreadPool(2)
}
