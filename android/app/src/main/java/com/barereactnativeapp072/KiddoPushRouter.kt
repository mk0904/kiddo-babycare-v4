package com.barereactnativeapp072

import android.os.Bundle
import android.util.Log
import com.clevertap.android.sdk.CleverTapAPI
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.freshchat.consumer.sdk.Freshchat

class KiddoPushRouter : FirebaseMessagingService() {

    companion object {
        private const val TAG = "KiddoPushRouter"
    }

    /**
     * FCM issues a new registration token (fresh install, reinstall, data cleared, restore to a new
     * device, periodic rotation). EVERY SDK that pushes to this app has to be told, because this
     * class is the app's only FirebaseMessagingService — declaring it supplants CleverTap's
     * [com.clevertap.android.sdk.pushnotification.fcm.FcmMessageListenerService], whose own
     * onNewToken would otherwise have done this.
     *
     * Without the CleverTap call below, CleverTap keeps the token from the PREVIOUS install and
     * FCM rejects every send with 404 UNREGISTERED. It used to be papered over by the JS
     * `syncNativePushTokenWithCleverTap()` on app open, which only runs once the user opens the
     * app and notification permission is already granted — so there is a window, after a reinstall
     * and before the next launch, in which every campaign to this device fails.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)

        try {
            Freshchat.getInstance(applicationContext).setPushRegistrationToken(token)
        } catch (t: Throwable) {
            Log.e(TAG, "Failed to hand the new FCM token to Freshchat", t)
        }

        try {
            CleverTapAPI.getDefaultInstance(applicationContext)
                ?.pushFcmRegistrationId(token, true)
        } catch (t: Throwable) {
            Log.e(TAG, "Failed to hand the new FCM token to CleverTap", t)
        }
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
