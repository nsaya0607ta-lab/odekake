package com.odekake.stepsync

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL

class MainActivity : ComponentActivity() {
    private lateinit var endpoint: EditText
    private lateinit var token: EditText
    private lateinit var status: TextView
    private lateinit var sync: Button
    private lateinit var settings: SecureSettings
    private lateinit var health: HealthConnectRepository

    private val permissions = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { refreshPermissions(it) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = SecureSettings(this)
        health = HealthConnectRepository(this)
        setContentView(content())
        endpoint.setText(settings.endpoint.orEmpty())
        token.setText(settings.token.orEmpty())
        checkHealthConnect()
    }

    override fun onResume() {
        super.onResume()
        if (::health.isInitialized) checkHealthConnect()
    }

    private fun content(): View {
        val density = resources.displayMetrics.density
        val p = (20 * density).toInt()
        val gap = (12 * density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(p, p, p, p)
            setBackgroundColor(Color.rgb(247, 243, 234))
        }
        root.addView(text("おでかけ歩数連携", 24f, true))
        root.addView(text("Health Connectの今日の歩数を、おでかけ記録へ送ります。", 14f).top(gap))
        endpoint = EditText(this).apply {
            hint = "送信先URL（https://…/api/steps/sync）"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine()
        }
        root.addView(endpoint.top(gap * 2))
        token = EditText(this).apply {
            hint = "連携キー"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setSingleLine()
        }
        root.addView(token.top(gap))
        root.addView(Button(this).apply {
            text = "設定を保存"
            setOnClickListener { save(true) }
        }.top(gap))
        root.addView(Button(this).apply {
            text = "Health Connectの歩数を許可"
            setOnClickListener { requestPermissions() }
        }.top(gap * 2))
        sync = Button(this).apply {
            text = "今すぐ同期"
            setOnClickListener { syncNow() }
        }
        root.addView(sync.top(gap))
        status = text("Health Connectを確認しています…", 14f).apply { setPadding(0, gap * 2, 0, gap) }
        root.addView(status)
        root.addView(text("設定後は約6時間ごとに自動同期します。省電力設定で遅れる場合は「今すぐ同期」を使用してください。", 12f))
        return ScrollView(this).apply { addView(root) }
    }

    private fun save(showMessage: Boolean): Boolean {
        val endpointValue = endpoint.text.toString().trim()
        val tokenValue = token.text.toString().trim()
        val validUrl = runCatching {
            val url = URL(endpointValue)
            url.protocol == "https" || (url.protocol == "http" && url.host == "10.0.2.2")
        }.getOrDefault(false)
        if (!validUrl || !endpointValue.endsWith("/api/steps/sync")) {
            status.text = "送信先URLを確認してください。末尾は /api/steps/sync です。"
            return false
        }
        if (!TOKEN.matches(tokenValue)) {
            status.text = "連携キーを確認してください。"
            return false
        }
        settings.endpoint = endpointValue
        settings.token = tokenValue
        StepSyncWorker.schedule(this)
        if (showMessage) status.text = "設定を保存しました。"
        return true
    }

    private fun requestPermissions() {
        when (health.status()) {
            HealthConnectClient.SDK_AVAILABLE -> permissions.launch(setOf(health.readPermission, health.backgroundPermission))
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                val provider = "com.google.android.apps.healthdata"
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$provider")))
            }
            else -> status.text = "この端末ではHealth Connectを利用できません。"
        }
    }

    private fun checkHealthConnect() {
        if (health.status() != HealthConnectClient.SDK_AVAILABLE) {
            status.text = "Health Connectを利用できません。"
            sync.isEnabled = false
            return
        }
        lifecycleScope.launch { refreshPermissions(health.granted()) }
    }

    private fun refreshPermissions(granted: Set<String>) {
        val canRead = health.readPermission in granted
        sync.isEnabled = canRead
        status.text = when {
            !canRead -> "歩数の読み取りを許可してください。"
            health.backgroundPermission !in granted -> "手動同期できます。自動同期にはバックグラウンド権限も許可してください。"
            else -> settings.lastSync?.let { "最終同期：$it" } ?: "歩数を読み取れます。"
        }
    }

    private fun syncNow() {
        if (!save(false)) return
        sync.isEnabled = false
        status.text = "歩数を同期しています…"
        lifecycleScope.launch {
            try {
                val steps = health.todaySteps()
                val result = withContext(Dispatchers.IO) { StepSyncClient.sync(settings.endpoint!!, settings.token!!, steps) }
                settings.lastSync = "${StepSyncWorker.timestamp()}　${result.steps}歩（+${result.earnedExp} EXP）"
                status.text = "同期しました：${result.steps}歩 / +${result.earnedExp} EXP"
            } catch (error: Exception) {
                status.text = error.message ?: "同期に失敗しました。"
            } finally { sync.isEnabled = true }
        }
    }

    private fun text(value: String, size: Float, bold: Boolean = false) = TextView(this).apply {
        text = value; textSize = size; setTextColor(Color.rgb(35, 43, 38))
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    private fun <T : View> T.top(margin: Int): T = apply {
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = margin
        }
    }

    companion object {
        private val TOKEN = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
    }
}
