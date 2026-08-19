import { Colors, Fonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  style?: any;
  textStyle?: any;
}

export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
  textStyle,
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
      onPressIn={() => {
        if (process.env.EXPO_OS === 'ios') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
      onPress={() => {
        onPress();
      }}
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
            textStyle,
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

