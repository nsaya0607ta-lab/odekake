package com.odekake.stepsync

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureSettings(context: Context) {
    private val prefs = context.getSharedPreferences("step_sync", Context.MODE_PRIVATE)
    var endpoint: String?
        get() = decrypt(prefs.getString("endpoint", null))
        set(value) = save("endpoint", value)
    var token: String?
        get() = decrypt(prefs.getString("token", null))
        set(value) = save("token", value)
    var lastSync: String?
        get() = prefs.getString("last_sync", null)
        set(value) = prefs.edit().putString("last_sync", value).apply()

    private fun save(name: String, value: String?) {
        if (value.isNullOrBlank()) prefs.edit().remove(name).apply()
        else prefs.edit().putString(name, encrypt(value.trim())).apply()
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
            generateKey()
        }
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance(TRANSFORM).apply { init(Cipher.ENCRYPT_MODE, key()) }
        return Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + "." +
            Base64.encodeToString(cipher.doFinal(value.toByteArray()), Base64.NO_WRAP)
    }

    private fun decrypt(value: String?): String? = try {
        if (value == null) null else {
            val parts = value.split('.', limit = 2)
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
            String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)))
        }
    } catch (_: Exception) { null }

    companion object {
        private const val ALIAS = "odekake_step_sync"
        private const val TRANSFORM = "AES/GCM/NoPadding"
    }
}
