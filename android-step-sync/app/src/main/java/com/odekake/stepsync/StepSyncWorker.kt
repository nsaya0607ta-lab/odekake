package com.odekake.stepsync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.work.*
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

class StepSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val settings = SecureSettings(applicationContext)
        val endpoint = settings.endpoint ?: return Result.success()
        val token = settings.token ?: return Result.success()
        val health = HealthConnectRepository(applicationContext)
        if (health.status() != HealthConnectClient.SDK_AVAILABLE) return Result.success()
        val permissions = health.granted()
        if (health.readPermission !in permissions || health.backgroundPermission !in permissions) return Result.success()
        return try {
            val result = StepSyncClient.sync(endpoint, token, health.todaySteps())
            settings.lastSync = "${timestamp()}　${result.steps}歩（+${result.earnedExp} EXP）"
            Result.success()
        } catch (_: Exception) { Result.retry() }
    }

    companion object {
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<StepSyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "odekake-step-sync", ExistingPeriodicWorkPolicy.UPDATE, request)
        }
        fun timestamp() = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm"))
    }
}
