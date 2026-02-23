import { APP_STORE_URL, PLAY_STORE_URL } from '@/constants/versionConfig';
import { Colors } from '@/constants/theme';
import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const storeUrl = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;

export function UpdateRequiredScreen() {
  const openStore = () => {
    Linking.openURL(storeUrl);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Update required</Text>
      <Text style={styles.message}>
        A new version of Kiddo is available. Please update the app to continue.
      </Text>
      <Pressable onPress={openStore} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>Update</Text>
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
