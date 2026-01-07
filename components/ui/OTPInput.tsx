import React, { useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { Colors } from '@/constants/theme';

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
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const hiddenInputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Focus first input on mount
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, []);

  const handleChange = (text: string, index: number) => {
    // Only allow digits
    if (text && !/^\d$/.test(text)) {
      return;
    }

    const newOtp = [...value];
    newOtp[index] = text;
    onChange(newOtp);

    // Auto-focus next input
    if (text && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-complete when all digits are entered
    if (newOtp.every((digit) => digit !== '') && newOtp.join('').length === length) {
      onComplete?.(newOtp.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleAutoFill = (text: string) => {
    if (!text || !editable) return;

    // Extract only digits
    const digits = text.replace(/\D/g, '');

    // Handle 6-digit OTP
    if (digits.length === length) {
      const newOtp = digits.split('').slice(0, length);
      onChange(newOtp);
      hiddenInputRef.current?.blur();
      onComplete?.(digits);
    } else if (digits.length > 0 && digits.length < length) {
      // Partial OTP
      const newOtp = [...value];
      digits.split('').forEach((digit, idx) => {
        if (idx < length && /^\d$/.test(digit)) {
          newOtp[idx] = digit;
        }
      });
      onChange(newOtp);
      const nextEmptyIndex = newOtp.findIndex((d) => d === '');
      if (nextEmptyIndex >= 0 && inputRefs.current[nextEmptyIndex]) {
        inputRefs.current[nextEmptyIndex]?.focus();
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Hidden input for auto-detection */}
      <TextInput
        ref={hiddenInputRef}
        style={styles.hiddenInput}
        value=""
        onChangeText={handleAutoFill}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoFocus={false}
        maxLength={length}
        editable={editable}
      />

      {/* Visible OTP inputs */}
      {Array.from({ length }).map((_, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            inputRefs.current[index] = ref;
          }}
          style={[
            styles.input,
            value[index] && styles.inputFilled,
            error && styles.inputError,
          ]}
          value={value[index]}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          editable={editable}
          textContentType={index === 0 ? 'oneTimeCode' : 'none'}
          autoComplete={index === 0 ? (Platform.OS === 'ios' ? 'one-time-code' : 'sms-otp') : 'off'}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    gap: 8,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -1000,
    zIndex: -1,
  },
  input: {
    width: 48,
    height: 52,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderRadius: 26,
    textAlign: 'center',
    fontSize: 20,
    color: Colors.text,
    backgroundColor: '#F9FAFB',
  },
  inputFilled: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
});

