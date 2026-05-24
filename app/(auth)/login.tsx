import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { otpService } from '@/services/otpService';
import { useReferralAttributionStore } from '@/store/referralAttributionStore';
import { trackSignupStarted } from '@/utils/mixpanelHelpers';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LoginScreen() {
  const router = useRouter();
  const { login, skipLogin } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Auto-fill referral code from AppsFlyer invite / OneLink (if captured at app open)
  useEffect(() => {
    const pending = useReferralAttributionStore.getState().consumePendingReferralCode();
    if (pending) {
      setReferralCode(pending);
    }
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Auto-submit when 10 digits are entered
  useEffect(() => {
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    if (cleanedPhone.length === 10 && !loading) {
      handleSendOTP();
    }
  }, [phoneNumber]);

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    return cleaned.slice(0, 10);
  };

  const handleSendOTP = async () => {
    trackSignupStarted('phone');
    const cleanedPhone = phoneNumber.replace(/\D/g, '');

    if (cleanedPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    if (loading || skipping) return;

    setLoading(true);
    setError('');

    try {
      const result = await otpService.sendOTP(cleanedPhone);

      if (result.success) {
        router.push({
          pathname: '/(auth)/otp',
          params: { phoneNumber: cleanedPhone, referralCode: referralCode || '' },
        });
      } else {
        setError(result.message || 'Failed to send OTP. Please try again.');
      }
    } catch (error: any) {
      let errorMessage = 'Something went wrong. Please try again.';
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const cleanedPhone = phoneNumber.replace(/\D/g, '');
  const isPhoneValid = cleanedPhone.length === 10;

  const handleSkip = async () => {
    if (skipping || loading) return;

    try {
      setSkipping(true);
      setError('');
      skipLogin();
      router.replace('/(tabs)');
    } catch (error) {
      setSkipping(false);
      setError('Unable to skip login. Please try again.');
      Alert.alert(
        'Error',
        'Unable to skip login. Please try again or continue with phone number login.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Skip Button - iOS Only */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
            disabled={skipping}
          >
            {skipping ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : (
              <Text style={styles.skipButtonText}>Skip</Text>
            )}
          </TouchableOpacity>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            isKeyboardVisible && { justifyContent: 'flex-end' }
          ]}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
        >

          <View style={styles.topSection}>
            <Text style={styles.loginHeading}>Login</Text>
          </View>

          {/* Bottom Section - Phone Input */}
          <View style={styles.bottomSection}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Phone number <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <PhoneInput
                value={phoneNumber}
                onChangeText={(text) => {
                  setPhoneNumber(formatPhoneNumber(text));
                  setError('');
                }}
                editable={!loading}
                error={!!error}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Referral code</Text>
              <TextInput
                style={styles.referralInput}
                placeholder="Enter code"
                placeholderTextColor={Colors.textSecondary}
                value={referralCode}
                onChangeText={setReferralCode}
                autoCapitalize="characters"
                editable={!loading}
              />
            </View>

            <ErrorText message={error} visible={!!error} />

            <Button
              title="Send OTP"
              onPress={handleSendOTP}
              disabled={!isPhoneValid || loading}
              loading={loading}
              style={[
                styles.submitButton,
                (!isPhoneValid || loading) && styles.submitButtonDisabled
              ]}
              textStyle={[
                styles.submitButtonText,
                (!isPhoneValid || loading) && styles.submitButtonTextDisabled
              ]}
            />

            {/* Legal Text */}
            {/* <View style={styles.legalSection}>
              <Text style={styles.legalText}>
                By continuing, you agree to our{' '}
                <Text style={styles.legalLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.legalLink}>Privacy Policy.</Text>
              </Text>
            </View> */}
          </View>
        </ScrollView>
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
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  skipButtonText: {
    fontSize: 14,
    color: Colors.text,
    fontFamily: Fonts.SemiBold,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  topSection: {
    justifyContent: 'center',
    width: '100%',
    alignItems: 'center',
    marginBottom: 0,
    paddingHorizontal: 24,
  },
  textContainer: {
    alignItems: 'center',
  },
  loginHeading: {
    fontSize: 40,
    fontFamily: 'Fredoka_600SemiBold',
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  loginSubheading: {
    marginTop: 8,
    fontSize: 15,
    fontFamily: Fonts.LexendRegular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  bottomSection: {
    paddingHorizontal: 24,
    backgroundColor: Colors.backgroundWhite,
    justifyContent: 'flex-start',
    paddingTop: 30,
    paddingBottom: 40,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: Fonts.SmallFontSize,
    fontFamily: Fonts.LexendMedium,
    color: '#414651',
    marginBottom: 8,
    marginLeft: 4,
  },
  referralInput: {
    height: 52,
    borderWidth: 2,
    borderColor: '#D5D7DA',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: Fonts.MediumFontSize,
    fontFamily: Fonts.LexendRegular,
    color: '#181D27',
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#F5F5F5',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: Fonts.MediumFontSize,
    fontFamily: Fonts.LexendSemiBold,
    color: '#FFFFFF',
  },
  submitButtonTextDisabled: {
    fontSize: Fonts.MediumFontSize,
    fontFamily: Fonts.LexendSemiBold,
    color: '#A4A7AE',
  },
  footerBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 1,
  },
  footerImage: {
    width: '100%',
    height: '100%',
  }
});

