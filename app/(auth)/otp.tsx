import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Customer } from '@/services/customerService';
import { otpService } from '@/services/otpService';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
import { appConfigService } from '@/services/appConfigService';

export default function OTPScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phoneNumber: string, referralCode?: string }>();
  const { phoneNumber, referralCode: referralCodeParam } = params;
  const { login, isAuthenticated, user } = useAuth();

  // Use array for OTP input (separate fields for each digit)
  const otpPinCount = 6;
  const [otpInput, setOtpInput] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [confettiUrl, setConfettiUrl] = useState<string | null>(null);

  // Refs for OTP inputs and preventing duplicate verifications
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const hiddenInputRef = useRef<TextInput>(null);
  const verifyingRef = useRef(false);
  const iosAutofillDetected = useRef(false);
  const lastOtpUpdateTime = useRef<number>(0);

  // Timer logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0 && !canResend) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer, canResend]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

      // Auto-verify with a slight delay to allow UI to render filled state and enabled CTA
      setTimeout(() => {
        handleVerifyOtp({
          otpInput: retrievedCode,
          otpPinCount,
        });
      }, 300);
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

          // Auto-verify with a slight delay
          setTimeout(() => {
            handleVerifyOtp({
              otpInput: otpString,
              otpPinCount,
            });
          }, 300);

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

  // Navigate after OTP verification – skip kiddo-details, go to homepage
  useEffect(() => {
    const isGuest = user?.isGuest === true;

    if (isAuthenticated && !loading && otpVerified && !isGuest) {
      const navigationTimer = setTimeout(() => {
        if (confettiUrl) {
          router.replace({ pathname: '/(tabs)', params: { confettiUrl } });
        } else {
          router.replace('/(tabs)');
        }
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

      // Capture location for geofenced campaign rewards (best-effort; never blocks login)
      let coords: { lat: number; lng: number } | null = null;
      try {
        const { getCoordsBestEffort } = require('@/utils/getCoordsBestEffort');
        coords = await getCoordsBestEffort();
      } catch (e) {
        console.warn('[OTP] location capture failed (continuing without coords)', e);
      }

      // Verify OTP and complete login/signup on backend (single call; lat/lng optional in body)
      const result = await otpService.verifyOTPAndLogin(
        phoneNumber,
        otpToVerify,
        'User',
        '',
        referralCodeParam || undefined,
        coords
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
      let finalId = u?.id;
      let finalCustomerId = u?.customerId;

      // If backend returned a mock 'existing' ID, fetch the real one from Shopify immediately using phone number
      if ((finalId && finalId.includes('existing')) || (finalCustomerId && finalCustomerId.includes('existing'))) {
        try {
          const { shopifyAdminApi } = require('@/services/shopifyAdminApi');
          const fetchedId = await shopifyAdminApi.getCustomerIdByPhone(phoneNumber);
          if (fetchedId) {
            finalId = fetchedId;
            finalCustomerId = fetchedId;
          }
        } catch (e) {
          console.warn('Failed to fetch real customer ID on login by phone', e);
        }
      }

      const resolvedId = finalId && !finalId.includes('existing') ? finalId : (finalCustomerId && !finalCustomerId.includes('existing') ? finalCustomerId : `phone:${phoneNumber}`);
      const customerPayload: Customer = {
        id: resolvedId,
        phone: phoneNumber,
        email: u?.email ?? '',
        firstName: u?.firstName ?? 'User',
        lastName: u?.lastName ?? '',
        customerId: finalCustomerId && !finalCustomerId.includes('existing') ? finalCustomerId : resolvedId,
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
      
      const config = appConfigService.getConfig();
      if (result.render_confetti && config?.promoConfettiUrl) {
        setConfettiUrl(config.promoConfettiUrl);
      }
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
        setTimer(30);
        setCanResend(false);
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
            <Text style={styles.title}>Log in</Text>
            <Text style={styles.subtitle}>
              We've sent a 6 digit code to{'\n'}
              <Text style={styles.phoneNumber}>{phoneNumber.replace(/^\+/, '')}</Text>
            </Text>
          </View>

          {/* OTP Input Section */}
          <View style={styles.otpSection}>
            <Text style={styles.otpLabel}>Enter OTP</Text>
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

                      // Auto-verify with a slight delay
                      setTimeout(() => {
                        handleVerifyOtp({
                          otpInput: digits.slice(0, otpPinCount),
                          otpPinCount,
                        });
                      }, 300);
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

                        // Auto-verify with a slight delay
                        setTimeout(() => {
                          handleVerifyOtp({
                            otpInput: digits,
                            otpPinCount,
                          });
                        }, 300);

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

                    // Auto-verify when all digits are entered with a slight delay
                    const otpString = newOtp.join('');
                    if (otpString.length === otpPinCount) {
                      setTimeout(() => {
                        handleVerifyOtp({
                          otpInput: otpString,
                          otpPinCount,
                        });
                      }, 300);
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
          </View>

          <ErrorText message={error} visible={!!error} />

          {/* Verify Button */}
          <Button
            title="Verify"
            onPress={() =>
              handleVerifyOtp({
                otpInput: otpInput.join(''),
                otpPinCount,
              })
            }
            disabled={otpInput.join('').length < otpPinCount || loading}
            loading={loading}
            style={[
              styles.verifyButton,
              (otpInput.join('').length < otpPinCount) && styles.verifyButtonDisabled
            ]}
            textStyle={[
              styles.verifyButtonText,
              (otpInput.join('').length < otpPinCount) && styles.verifyButtonTextDisabled
            ]}
          />

          {/* Resend Row */}
          <View style={styles.resendRow}>
            <Text style={styles.resendPrompt}>Didn't receive OTP? </Text>
            <Text style={styles.timerText}>{formatTimer(timer)} </Text>
            <TouchableOpacity
              onPress={handleResendOtp}
              disabled={!canResend || resending || loading}
              activeOpacity={0.7}
            >
              {resending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={[
                  styles.resendLink,
                  (!canResend || loading) && styles.resendLinkDisabled
                ]}>Resend</Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
      <View style={styles.footerBackground}>
        <Image
          source={require('@/assets/images/order-success-footer.png')}
          style={styles.footerImage}
          contentFit="cover"
        />
      </View>
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
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  backButton: {
    marginBottom: 20,
    padding: 4,
    alignSelf: 'flex-start',
  },
  header: {
    marginTop: 20,
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontFamily: 'Fredoka_600SemiBold',
    color: Colors.primary,
    letterSpacing: 0.3,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Fonts.MediumFontSize,
    color: '#717680',
    textAlign: 'center',
    lineHeight: 26,
    fontFamily: Fonts.LexendMedium,
  },
  phoneNumber: {
    color: Colors.primary,
    fontFamily: Fonts.LexendMedium,
  },
  otpSection: {
    marginTop: 0,
  },
  otpLabel: {
    fontSize: Fonts.SmallFontSize,
    fontFamily: Fonts.LexendMedium,
    color: '#414651',
    marginBottom: 6,
    marginLeft: 4,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 0,
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
    flex: 1,
    height: 60,
    borderWidth: 2,
    borderColor: '#D5D7DA',
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: Fonts.LexendSemiBold,
    color: '#181D27',
    backgroundColor: '#FFFFFF',
  },
  otpDigitInputFilled: {
    borderColor: '#D5D7DA',
    backgroundColor: '#FFFFFF',
  },
  otpDigitInputError: {
    borderColor: '#F04438',
    justifyContent: 'flex-start'
  },
  verifyButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },
  verifyButtonDisabled: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#F5F5F5',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    fontSize: Fonts.MediumFontSize,
    fontFamily: Fonts.LexendSemiBold,
    color: '#FFFFFF',
  },
  verifyButtonTextDisabled: {
    fontSize: Fonts.MediumFontSize,
    fontFamily: Fonts.LexendSemiBold,
    color: '#A4A7AE',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 20,
    paddingLeft: 4,
  },
  resendPrompt: {
    fontSize: 14,
    color: '#717680',
    fontFamily: Fonts.LexendMedium,
  },
  timerText: {
    fontSize: 14,
    color: '#535862',
    fontFamily: Fonts.LexendRegular,
    marginRight: 4,
  },
  resendLink: {
    fontSize: 14,
    color: Colors.primary,
    fontFamily: Fonts.LexendBold,
  },
  resendLinkDisabled: {
    color: '#F69393',
  },
  footerBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: -1,
  },
  footerImage: {
    width: '100%',
    height: '100%',
  }
});
