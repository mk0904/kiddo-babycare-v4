import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface ErrorTextProps {
  message: string;
  visible?: boolean;
}

export function ErrorText({ message, visible = true }: ErrorTextProps) {
  if (!visible || !message) return null;

  return <Text style={styles.errorText}>{message}</Text>;
}

const styles = StyleSheet.create({
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
});

