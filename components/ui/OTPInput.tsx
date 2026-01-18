import { Colors } from '@/constants/theme';
import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

interface OTPInputProps {
  length?: number;
  value: string[];
  onChange: (value: string[]) => void;
  onComplete?: (otp: string) => void;
  error?: boolean;
  editable?: boolean;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error = false,
  editable = true,
}: OTPInputProps) {
  const inputRef = useRef<TextInput>(null);
  const isAutoFillingRef = useRef(false);

  useEffect(() => {
    // Focus input after mount to enable autofill
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  // Convert array value to string for display
  const otpString = value.join('');

  // Handle input change
  const handleChange = useCallback((text: string) => {
    if (!editable || isAutoFillingRef.current) return;

    // Extract only digits
    const digits = text.replace(/\D/g, '');

    // Limit to length
    const limitedDigits = digits.slice(0, length);

    // Convert to array
    const newOtp = limitedDigits.split('');
    
    // Pad with empty strings if needed
    while (newOtp.length < length) {
      newOtp.push('');
    }

    onChange(newOtp);

    // Auto-complete when all digits are entered
    if (limitedDigits.length === length) {
      isAutoFillingRef.current = true;
      setTimeout(() => {
        onComplete?.(limitedDigits);
        isAutoFillingRef.current = false;
      }, 100);
    }
  }, [length, onChange, onComplete, editable]);

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          otpString.length === length && styles.inputFilled,
          error && styles.inputError,
        ]}
        value={otpString}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoFocus={false}
        maxLength={length}
        editable={editable}
        importantForAutofill="yes"
        autoCorrect={false}
        spellCheck={false}
        selectTextOnFocus
        placeholder="Enter 6-digit OTP"
        placeholderTextColor={Colors.textSecondary}
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'Metropolis-SemiBold',
    letterSpacing: 8,
    color: Colors.text,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
  },
  inputFilled: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
});
