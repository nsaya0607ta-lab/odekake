package com.odekake.stepsync

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.TextView

class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val p = (24 * resources.displayMetrics.density).toInt()
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(p, p, p, p); setBackgroundColor(Color.rgb(247, 243, 234))
            addView(TextView(context).apply { text = "歩数データの利用について"; textSize = 22f })
            addView(TextView(context).apply {
                text = "今日の合計歩数だけをHealth Connectから読み取り、おでかけ記録へ送信します。歩数以外の健康情報は取得しません。"
                textSize = 16f; setPadding(0, p, 0, 0)
            })
        })
    }
}
