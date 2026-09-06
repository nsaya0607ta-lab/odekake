package com.odekake.stepsync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class HealthConnectRepository(private val context: Context) {
    val readPermission = HealthPermission.getReadPermission(StepsRecord::class)
    val backgroundPermission = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
    fun status() = HealthConnectClient.getSdkStatus(context)
    fun client() = HealthConnectClient.getOrCreate(context)
    suspend fun granted() = client().permissionController.getGrantedPermissions()
    suspend fun todaySteps(): Long {
        val zone = ZoneId.systemDefault()
        val start = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val result = client().aggregate(AggregateRequest(
            metrics = setOf(StepsRecord.COUNT_TOTAL),
            timeRangeFilter = TimeRangeFilter.between(start, Instant.now()),
        ))
        return result[StepsRecord.COUNT_TOTAL] ?: 0L
    }
}
