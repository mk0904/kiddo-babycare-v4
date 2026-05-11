import { APP_STORE_URL, PLAY_STORE_URL } from '@/constants/versionConfig';
import { Colors } from '@/constants/theme';
import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export function UpdateRequiredScreen() {
  const storeUrl = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;

  const openStore = () => {
    console.log(`[UpdateRequired] Opening store: ${storeUrl}`);
    Linking.openURL(storeUrl).catch(err => {
      console.error('[UpdateRequired] Failed to open store URL:', err);
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Update required</Text>
      <Text style={styles.message}>
        A new version of Kiddo is available. Please update the app to continue.
      </Text>
      <Pressable 
        onPress={openStore} 
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Update app"
      >
        <Text style={styles.buttonText}>Update Now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.light.icon,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
