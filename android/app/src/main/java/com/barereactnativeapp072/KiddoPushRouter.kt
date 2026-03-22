package com.barereactnativeapp072

import android.os.Bundle
import com.clevertap.android.sdk.CleverTapAPI
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class KiddoPushRouter : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        if (isCleverTapMessage(data)) {
            val extras = Bundle()
            for ((key, value) in data) {
                extras.putString(key, value)
            }
            CleverTapAPI.createNotification(applicationContext, extras)
        } else {
            super.onMessageReceived(message)
        }
    }

    private fun isCleverTapMessage(data: Map<String, String>): Boolean {
        return data.containsKey("wzrk_pn") ||
               data.containsKey("wzrk_pid") ||
               data.containsKey("nm") ||
               data.containsKey("nt")
    }
}
