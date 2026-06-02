import "expo-router/entry";
import { Platform } from 'react-native';
import { Freshchat, FreshchatNotificationConfig } from 'react-native-freshchat-sdk';

if (Platform.OS === 'android') {
    var freshchatNotificationConfig = new FreshchatNotificationConfig();
    freshchatNotificationConfig.priority = FreshchatNotificationConfig.NotificationPriority.PRIORITY_HIGH;
    freshchatNotificationConfig.notificationSoundEnabled = true;
    freshchatNotificationConfig.largeIcon = "notif"; // Drawable name
    freshchatNotificationConfig.smallIcon = "notif"; // Drawable name
    Freshchat.setNotificationConfig(freshchatNotificationConfig);
}
