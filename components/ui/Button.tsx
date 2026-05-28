import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  style?: any;
}

export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.backgroundWhite : Colors.primary}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText,
            (disabled || loading) && styles.buttonTextDisabled,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonDisabled: {
    backgroundColor: Colors.disabled,
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: Fonts.SemiBold,
  },
  primaryButtonText: {
    color: Colors.backgroundWhite,
  },
  secondaryButtonText: {
    color: Colors.primary,
  },
  buttonTextDisabled: {
    color: Colors.backgroundWhite,
  },
});

