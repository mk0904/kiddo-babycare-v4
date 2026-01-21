import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { customerService } from '@/services/customerService';
import { otpService } from '@/services/otpService';
import { shopifyApi } from '@/services/shopifyApi';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

  // Use SMS User Consent hook (exactly like gauntlet)
  const retrievedCode = useSmsUserConsent(otpPinCount);

  // Handle auto-detected OTP from SMS User Consent (exactly like gauntlet)
  useEffect(() => {
    if (retrievedCode && retrievedCode.length === otpPinCount) {
      console.log('[OTP] ✅ Auto-detected OTP from SMS:', retrievedCode);
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
  }, [retrievedCode]);

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

      // Verify OTP using your service
      const verifyResult = await otpService.verifyOTP(phoneNumber, otpToVerify);

      if (!verifyResult.success) {
        setError(verifyResult.message || 'Invalid OTP');
        setOtpInput(['', '', '', '', '', '']);
        setOtpVerified(false);
        setLoading(false);
        verifyingRef.current = false;
        return;
      }

      // OTP verified, try to login first (for existing customers)
      // Format email: phone@kiddo.app
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      const email = `${cleanedPhone.slice(-10)}@kiddo.app`;
      const password = 'kiddo@12345';

      // Try to login first (for existing customers)
      const loginResult = await customerService.checkCustomerExists(email, password);
      
      if (loginResult.exists && loginResult.token) {
        // Existing customer - login directly
        console.log('[OTP] Existing customer, logging in...');
        setOtpVerified(true);

        if (loginResult.customer) {
          await login({
            id: loginResult.customer.id,
            phone: phoneNumber,
            email: loginResult.customer.email || email,
            firstName: loginResult.customer.firstName || '',
            lastName: loginResult.customer.lastName || '',
            customerId: loginResult.customer.id,
            customerAccessToken: loginResult.token,
            isGuest: false,
            displayName: loginResult.customer.displayName,
            numberOfOrders: loginResult.customer.numberOfOrders,
            acceptsMarketing: loginResult.customer.acceptsMarketing,
            createdAt: loginResult.customer.createdAt,
            updatedAt: loginResult.customer.updatedAt,
            defaultAddress: loginResult.customer.defaultAddress,
          });
        } else {
          // Customer exists but details not available - get them
          try {
            const details = await shopifyApi.getCustomerDetails(loginResult.token);
            if (details) {
              await login({
                id: details.id,
                phone: phoneNumber,
                email: details.email || email,
                firstName: details.firstName || '',
                lastName: details.lastName || '',
                customerId: details.id,
                customerAccessToken: loginResult.token,
                isGuest: false,
                displayName: details.displayName,
                numberOfOrders: details.numberOfOrders,
                acceptsMarketing: details.acceptsMarketing,
                createdAt: details.createdAt,
                updatedAt: details.updatedAt,
                defaultAddress: details.defaultAddress,
              });
            } else {
              await login({
                id: `gid://shopify/Customer/existing`,
                phone: phoneNumber,
                email: email,
                firstName: '',
                lastName: '',
                customerId: `gid://shopify/Customer/existing`,
                customerAccessToken: loginResult.token,
                isGuest: false,
              });
            }
          } catch (e) {
            await login({
              id: `gid://shopify/Customer/existing`,
              phone: phoneNumber,
              email: email,
              firstName: '',
              lastName: '',
              customerId: `gid://shopify/Customer/existing`,
              customerAccessToken: loginResult.token,
              isGuest: false,
            });
          }
        }
      } else {
        // New customer - create account with default name (skip name input screen)
        console.log('[OTP] New customer, creating account without name input...');
        setLoading(true);
        
        try {
          // Create customer with default/empty name
          const customerResult = await customerService.createCustomer(
            phoneNumber,
            'User', // Default first name
            '' // Empty last name - user can update later
          );

          if (customerResult.success && customerResult.customer) {
            if (!customerResult.customer.customerAccessToken) {
              throw new Error('Failed to create account. Please try again.');
            }

            // Login user with default name
            await login({
              id: customerResult.customer.id,
              phone: phoneNumber,
              email: customerResult.customer.email,
              firstName: customerResult.customer.firstName || 'User',
              lastName: customerResult.customer.lastName || '',
              customerId: customerResult.customer.id,
              customerAccessToken: customerResult.customer.customerAccessToken,
              isGuest: false,
              displayName: customerResult.customer.displayName || 'User',
              numberOfOrders: customerResult.customer.numberOfOrders,
              acceptsMarketing: customerResult.customer.acceptsMarketing,
              createdAt: customerResult.customer.createdAt,
              updatedAt: customerResult.customer.updatedAt,
              defaultAddress: customerResult.customer.defaultAddress,
            });

            setOtpVerified(true);
          } else {
            throw new Error(customerResult.message || 'Failed to create account. Please try again.');
          }
        } catch (error: any) {
          console.error('[OTP] Error creating customer:', error);
          setError(error.message || 'Failed to create account. Please try again.');
          setOtpInput(['', '', '', '', '', '']);
          setOtpVerified(false);
        } finally {
          setLoading(false);
          verifyingRef.current = false;
        }
      }
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
        console.log('Dev Mode: OTP may have been generated, check console.');
      }
    } finally {
      setResending(false);
    }
  };

  // Name input screen removed - accounts are created automatically with default name

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="auto" />
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
            
            {/* Auto-detection indicator */}
            {retrievedCode && (
              <View style={styles.autoDetectIndicator}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.autoDetectText}>OTP detected from SMS</Text>
              </View>
            )}
          </View>

          {/* OTP Input - Separate fields for each digit */}
          <View style={styles.otpContainer}>
            {/* Hidden input for SMS autofill */}
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
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
              autoFocus={false}
              maxLength={otpPinCount}
              editable={!loading}
              importantForAutofill="yes"
              autoCorrect={false}
              spellCheck={false}
            />
            
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
                  // Only allow single digit
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
                maxLength={1}
                selectTextOnFocus
                editable={!loading}
                textContentType="none"
                autoComplete="off"
                importantForAutofill="no"
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
