package com.barereactnativeapp072

import android.os.Bundle
import com.clevertap.android.sdk.CleverTapAPI
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.freshchat.consumer.sdk.Freshchat

class KiddoPushRouter : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Freshchat.getInstance(applicationContext).setPushRegistrationToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        if (isCleverTapMessage(data)) {
            val extras = Bundle()
            for ((key, value) in data) {
                extras.putString(key, value)
            }
            CleverTapAPI.createNotification(applicationContext, extras)
        } else if (Freshchat.isFreshchatNotification(message)) {
            Freshchat.handleFcmMessage(applicationContext, message)
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
