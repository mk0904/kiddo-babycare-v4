import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NoInternetScreenProps {
  onRetry: () => void;
}

export default function NoInternetScreen({ onRetry }: NoInternetScreenProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={80} color="#F15E5E" />
      <Text style={styles.title}>No Connection</Text>
      <Text style={styles.subtitle}>
        Please check your internet settings and try again to continue shopping for your kiddos.
      </Text>

      <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.LexendBold,
    marginTop: 20,
    color: '#1A1A1A'
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.LexendMedium,
    textAlign: 'center',
    marginTop: 10,
    color: '#666',
    lineHeight: 20
  },
  button: {
    marginTop: 30,
    backgroundColor: '#F15E5E',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    // Optional shadow for consistent styling
    shadowColor: '#F15E5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFF',
    fontFamily: Fonts.LexendBold,
    fontSize: 16
  },
});
