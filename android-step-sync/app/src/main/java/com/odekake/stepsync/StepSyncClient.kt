package com.odekake.stepsync

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

data class SyncResult(val steps: Long, val earnedExp: Int)

object StepSyncClient {
    fun sync(endpoint: String, token: String, steps: Long): SyncResult {
        require(steps in 0..200_000) { "歩数が送信可能な範囲ではありません。" }
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"; connectTimeout = 15_000; readTimeout = 20_000; doOutput = true
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Accept", "application/json")
        }
        try {
            val payload = JSONObject().put("steps", steps).put("date", LocalDate.now().toString())
                .put("source", "android-health-connect").toString()
            connection.outputStream.use { it.write(payload.toByteArray()) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val json = runCatching { JSONObject(stream?.bufferedReader()?.use { it.readText() }.orEmpty()) }.getOrNull()
            if (status !in 200..299 || json?.optBoolean("ok") != true) {
                throw IllegalStateException(json?.optString("error")?.takeIf { it.isNotBlank() }
                    ?: "歩数を送信できませんでした（HTTP $status）。")
            }
            return SyncResult(json.optLong("steps", steps), json.optInt("earnedExp", 0))
        } finally { connection.disconnect() }
    }
}
