import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Customer } from '@/services/customerService';
import { otpService } from '@/services/otpService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// Import SMS User Consent (exactly like gauntlet)
import { useSmsUserConsent } from '@eabdullazyanov/react-native-sms-user-consent';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OTPScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phoneNumber: string }>();
  const { phoneNumber } = params;
  const { login, isAuthenticated, user } = useAuth();
  
  // Use array for OTP input (separate fields for each digit)
  const otpPinCount = 6;
  const [otpInput, setOtpInput] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  // Removed name input screen - accounts are created with default name
  
  // Refs for OTP inputs and preventing duplicate verifications
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const hiddenInputRef = useRef<TextInput>(null);
  const verifyingRef = useRef(false);
  const iosAutofillDetected = useRef(false);
  const lastOtpUpdateTime = useRef<number>(0);

  // Use SMS User Consent hook for Android (hook must be called unconditionally)
  // The hook should handle platform checks internally, but we'll only use it on Android
  const retrievedCode = useSmsUserConsent(otpPinCount);

  // Handle auto-detected OTP from SMS User Consent (Android only)
  // Note: handleVerifyOtp is defined below but included in dependencies
  useEffect(() => {
    // Only process on Android - iOS will use the hidden input autofill
    if (Platform.OS === 'android' && retrievedCode && retrievedCode.length === otpPinCount) {
      // OTP auto-detected from SMS (not logged for security/privacy compliance)
      const otpArray = retrievedCode.split('');
      setOtpInput(otpArray);
      
      // Blur all inputs
      inputRefs.current.forEach(ref => ref?.blur());
      hiddenInputRef.current?.blur();
            
      // Auto-verify
      handleVerifyOtp({
        otpInput: retrievedCode,
        otpPinCount,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retrievedCode, otpPinCount]);

  // iOS autofill detection - removed auto-focus to prevent keyboard from opening automatically
  // iOS autofill will still work via textContentType="oneTimeCode" without needing focus

  // iOS: Detect when all OTP fields are filled rapidly (autofill detection)
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const otpString = otpInput.join('');
      const now = Date.now();
      
      // If all 6 digits are filled and it happened very quickly (within 500ms), it's likely autofill
      if (otpString.length === otpPinCount && !iosAutofillDetected.current) {
        const timeSinceLastUpdate = now - lastOtpUpdateTime.current;
        
        // If all fields filled within 500ms, treat as autofill
        if (timeSinceLastUpdate < 500 || lastOtpUpdateTime.current === 0) {
          iosAutofillDetected.current = true;
          
          // Blur all inputs
          inputRefs.current.forEach(ref => ref?.blur());
          
          // Auto-verify
          handleVerifyOtp({
            otpInput: otpString,
            otpPinCount,
          });
          
          // Reset flag after a delay
          setTimeout(() => {
            iosAutofillDetected.current = false;
          }, 1000);
        }
      }
      
      lastOtpUpdateTime.current = now;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpInput, otpPinCount]);

  // Navigate after OTP verification
  useEffect(() => {
    const isGuest = user?.isGuest === true;

    if (isAuthenticated && !loading && otpVerified && !isGuest) {
      const navigationTimer = setTimeout(() => {
        router.replace('/(auth)/kiddo-details');
      }, 600);

      return () => clearTimeout(navigationTimer);
    }
  }, [isAuthenticated, loading, otpVerified, user, router]);

  const handleVerifyOtp = useCallback(async ({
    otpInput: otpToVerify,
    otpPinCount,
  }: {
    otpInput: string;
    otpPinCount: number;
  }) => {
    // Validation (exactly like gauntlet)
    if (!otpToVerify.length) {
      setError('Code is required.');
      return;
    }
    if (otpToVerify.length < otpPinCount) {
      setError('Invalid code.');
      return;
    }
    if (verifyingRef.current) {
      return;
    }

    verifyingRef.current = true;
    setLoading(true);
    setError('');

    try {
      setOtpVerified(false);

      // Verify OTP and complete login/signup on backend (single call)
      const result = await otpService.verifyOTPAndLogin(
        phoneNumber,
        otpToVerify,
        'User',
        ''
      );

      if (!result.success || !result.accessToken) {
        setError(result.message || 'Invalid OTP');
        setOtpInput(['', '', '', '', '', '']);
        setOtpVerified(false);
        setLoading(false);
        verifyingRef.current = false;
        return;
      }

      // Track OTP verified
      try {
        const { trackMobileOTPVerified } = require('@/utils/mixpanelHelpers');
        trackMobileOTPVerified(phoneNumber);
      } catch (e) {
        console.warn('Mixpanel tracking error:', e);
      }

      const u = result.user;
      const customerPayload: Customer = {
        id: u?.id ?? 'gid://shopify/Customer/existing',
        phone: phoneNumber,
        email: u?.email ?? '',
        firstName: u?.firstName ?? 'User',
        lastName: u?.lastName ?? '',
        customerId: u?.customerId ?? u?.id ?? 'gid://shopify/Customer/existing',
        customerAccessToken: result.accessToken,
        isGuest: false,
        displayName: u?.displayName ?? 'User',
        numberOfOrders: u?.numberOfOrders,
        acceptsMarketing: u?.acceptsMarketing,
        createdAt: u?.createdAt,
        updatedAt: u?.updatedAt,
        defaultAddress: u?.defaultAddress,
      };

      // Track signup if this looks like a new user (no createdAt or very recent)
      if (u?.id && u.id !== 'gid://shopify/Customer/existing') {
        try {
          const { trackSignupCompleted } = require('@/utils/mixpanelHelpers');
          trackSignupCompleted(u.id, 'phone');
        } catch (e) {
          console.warn('Mixpanel tracking error:', e);
        }
      }

      await login(customerPayload, result.accessToken);
      setOtpVerified(true);
    } catch (error: any) {
      let errorMessage = 'Something went wrong. Please try again.';

      if (error.message?.includes('Limit exceeded') || error.message?.includes('THROTTLED')) {
        errorMessage = 'Too many signup attempts. Please wait a few minutes and try again.';
      } else if (error.message?.includes('Phone is invalid')) {
        errorMessage = 'Invalid phone number format. Please check and try again.';
      } else if (error.message?.includes('Failed to create account')) {
        errorMessage = 'Unable to create account. Please try again in a moment.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setOtpInput(['', '', '', '', '', '']);
      setOtpVerified(false);
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  }, [phoneNumber, login]);

  // Removed handleCreateAccount - account creation now happens automatically after OTP verification
  
  const handleResendOtp = async () => {
    if (resending) {
      return;
    }

    setResending(true);
    setError('');

    try {
      const result = await otpService.sendOTP(phoneNumber);

      if (result && result.success) {
        Alert.alert('Success', 'OTP has been resent to your phone number');
        setOtpInput(['', '', '', '', '', '']);
        setError('');
        verifyingRef.current = false;
      } else {
        const errorMsg = result?.message || 'Failed to resend OTP';
        setError(errorMsg);
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to resend OTP. Please try again.';
      setError(errorMessage);

      if (__DEV__) {
        setOtpInput(['', '', '', '', '', '']);
        // Dev Mode: OTP may have been generated but not logged for security/privacy compliance
      }
    } finally {
      setResending(false);
    }
  };

  // Name input screen removed - accounts are created automatically with default name

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Enter OTP</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit code to{'\n'}
              <Text style={styles.phoneNumber}>{phoneNumber.replace(/^\+/, '')}</Text>
            </Text>
            
            {/* Auto-detection indicator - Android only */}
            {Platform.OS === 'android' && retrievedCode && (
              <View style={styles.autoDetectIndicator}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.autoDetectText}>OTP detected from SMS</Text>
              </View>
            )}
          </View>

          {/* OTP Input - Separate fields for each digit */}
          <View style={styles.otpContainer}>
            {/* Hidden input for SMS autofill - Android uses this */}
            {Platform.OS === 'android' && (
              <TextInput
                ref={hiddenInputRef}
                style={styles.hiddenInput}
                value=""
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '');
                  if (digits.length >= otpPinCount) {
                    const otpArray = digits.slice(0, otpPinCount).split('');
                    setOtpInput(otpArray);
                    
                    // Blur all inputs
                    inputRefs.current.forEach(ref => ref?.blur());
                    hiddenInputRef.current?.blur();
                    
                    // Auto-verify
                    handleVerifyOtp({
                      otpInput: digits.slice(0, otpPinCount),
                      otpPinCount,
                    });
                  }
                }}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                autoFocus={false}
                maxLength={otpPinCount}
                editable={!loading}
                importantForAutofill="yes"
                autoCorrect={false}
                spellCheck={false}
                secureTextEntry={false}
              />
            )}
            
            {/* Visible OTP inputs - one for each digit */}
            {Array.from({ length: otpPinCount }).map((_, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpDigitInput,
                  otpInput[index] && styles.otpDigitInputFilled,
                  error && styles.otpDigitInputError,
                ]}
                value={otpInput[index]}
                onChangeText={(text) => {
                  // For iOS: Handle autofill/paste of full OTP in the first input
                  if (Platform.OS === 'ios' && index === 0 && text.length > 1) {
                    const digits = text.replace(/\D/g, '').slice(0, otpPinCount);
                    if (digits.length === otpPinCount) {
                      // Prevent duplicate processing
                      if (iosAutofillDetected.current) {
                        return;
                      }
                      iosAutofillDetected.current = true;
                      
                      const otpArray = digits.split('');
                      setOtpInput(otpArray);
                      
                      // Blur all inputs
                      inputRefs.current.forEach(ref => ref?.blur());
                      
                      // Auto-verify
                      handleVerifyOtp({
                        otpInput: digits,
                        otpPinCount,
                      });
                      
                      // Reset flag after a delay
                      setTimeout(() => {
                        iosAutofillDetected.current = false;
                      }, 1000);
                      return;
                    }
                  }
                  
                  // Only allow single digit for normal input
                  if (text && !/^\d$/.test(text)) {
                    return;
                  }
                  
                  const newOtp = [...otpInput];
                  newOtp[index] = text;
                  setOtpInput(newOtp);
                  
                  // Auto-focus next input
                  if (text && index < otpPinCount - 1) {
                    inputRefs.current[index + 1]?.focus();
                  }
                  
                  // Auto-verify when all digits are entered
                  const otpString = newOtp.join('');
                  if (otpString.length === otpPinCount) {
                    handleVerifyOtp({
                      otpInput: otpString,
                      otpPinCount,
                    });
                  }
                }}
                onKeyPress={(e) => {
                  // Handle backspace
                  if (e.nativeEvent.key === 'Backspace' && !otpInput[index] && index > 0) {
                    inputRefs.current[index - 1]?.focus();
                  }
                }}
                keyboardType="number-pad"
                maxLength={Platform.OS === 'ios' && index === 0 ? otpPinCount : 1}
                selectTextOnFocus
                editable={!loading}
                textContentType={Platform.OS === 'ios' && index === 0 ? 'oneTimeCode' : 'none'}
                autoComplete={Platform.OS === 'ios' && index === 0 ? 'one-time-code' : 'off'}
                importantForAutofill={Platform.OS === 'ios' && index === 0 ? 'yes' : 'no'}
                autoCorrect={false}
                spellCheck={false}
              />
            ))}
          </View>

          <ErrorText message={error} visible={!!error} />

          {/* Verify Button */}
          <Button
            title="Verify OTP"
            onPress={() =>
              handleVerifyOtp({
                otpInput: otpInput.join(''),
                otpPinCount,
              })
            }
            disabled={otpInput.join('').length < otpPinCount || loading}
            loading={loading}
            style={styles.verifyButton}
          />

          {/* Resend OTP */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity
              onPress={handleResendOtp}
              disabled={resending || loading}
              activeOpacity={0.7}
            >
              {resending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.resendLink}>Resend OTP</Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  backButton: {
    marginBottom: 20,
    padding: 4,
    alignSelf: 'flex-start',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Metropolis-Bold',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Metropolis-Regular',
  },
  phoneNumber: {
    color: Colors.primary,
    fontFamily: 'Metropolis-SemiBold',
    fontWeight: '600',
  },
  autoDetectIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  autoDetectText: {
    fontSize: 12,
    color: Colors.primary,
    fontFamily: 'Metropolis-Medium',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  otpDigitInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'Metropolis-SemiBold',
    color: Colors.text,
    backgroundColor: '#F9FAFB',
  },
  otpDigitInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  otpDigitInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  verifyButton: {
    marginTop: 8,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 4,
  },
  resendText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'Metropolis-Regular',
  },
  resendLink: {
    fontSize: 14,
    color: Colors.primary,
    fontFamily: 'Metropolis-SemiBold',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  devInfo: {
    marginTop: 32,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  devInfoTitle: {
    fontSize: 12,
    fontFamily: 'Metropolis-SemiBold',
    color: Colors.text,
    marginBottom: 8,
  },
  devInfoText: {
    fontSize: 11,
    fontFamily: 'Monaco',
    color: '#666',
    marginBottom: 4,
  },
  devInfoNote: {
    fontSize: 10,
    fontFamily: 'Metropolis-Regular',
    color: Colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Removed unused styles for name input screen
});
