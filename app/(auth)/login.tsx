import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { otpService } from '@/services/otpService';
import { useReferralAttributionStore } from '@/store/referralAttributionStore';
import { trackSignupStarted } from '@/utils/mixpanelHelpers';
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
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Carousel data with images
const getCarouselData = () => {
  return [
    {
      imageUrl: require('@/assets/images/kiddo.png'),
      title: 'Welcome to Kiddo',
      subtitle: 'Your trusted partner in baby care, delivering 24/7',
    },
    {
      imageUrl: require('@/assets/images/kiddo_with_parents.png'),
      title: 'Quality You Can Trust',
      subtitle: 'Curated products, you can trust for your little ones',
    },
    {
      imageUrl: require('@/assets/images/kiddo_scooter.png'),
      title: 'Fast Delivery',
      subtitle: 'Get essentials delivered right to your door, Try & Buy, Gift options and Schedule a Delivery',
    },
  ];
};

export default function LoginScreen() {
  const router = useRouter();
  const { login, skipLogin } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const carouselData = getCarouselData();

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

  // // Auto-submit when 10 digits are entered
  // useEffect(() => {
  //   const cleanedPhone = phoneNumber.replace(/\D/g, '');
  //   if (cleanedPhone.length === 10 && !loading) {
  //     handleSendOTP();
  //   }
  // }, [phoneNumber]);

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    return cleaned.slice(0, 10);
  };

  const handleSendOTP = async () => {
    // Track signup started
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
        // In dev mode, OTP is available in result.devOtp but not logged for security/privacy compliance

        // Navigate to OTP verification screen
        router.push({
          pathname: '/(auth)/otp',
          params: { phoneNumber: cleanedPhone },
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

      // Use skipLogin from Zustand store via AuthContext
      skipLogin();

      // Navigate to home
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
          {/* Top Section - Carousel */}
          {/* <View style={[styles.topSection, { flex: isKeyboardVisible ? 0 : 1 }]}>
            <View style={[styles.carouselContainer, isKeyboardVisible && { marginBottom: 0 }]}>
              <Carousel
                data={carouselData}
                config={{
                  autoPlay: !isKeyboardVisible,
                  autoPlayInterval: 3000,
                  loop: true,
                  height: isKeyboardVisible ? 0.5 : 0.95,
                  resizeMode: 'contain',
                  showTextOverlay: false,
                }}
                styles={{
                  container: {
                    width: '100%',
                    alignSelf: 'stretch',
                  },
                  imageContainer: {
                    paddingHorizontal: 0,
                  },
                  img: {
                    width: '100%',
                  },
                }}
                onIndexChange={setCurrentCarouselIndex}
              />
              {carouselData[currentCarouselIndex] && (
                <View style={[styles.carouselTextContainer, { marginTop: isKeyboardVisible ? 0 : 16 }]}>
                  {carouselData[currentCarouselIndex].title && (
                    <Text style={[styles.carouselTitle, isKeyboardVisible && { fontSize: 18, marginBottom: 2 }]}>
                      {carouselData[currentCarouselIndex].title}
                    </Text>
                  )}
                  {carouselData[currentCarouselIndex].subtitle && (
                    <Text style={[styles.carouselSubtitle, isKeyboardVisible && { fontSize: 12, lineHeight: 16 }]}>
                      {carouselData[currentCarouselIndex].subtitle}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View> */}
          <View style={styles.topSection}>
            <Text style={styles.loginHeading}>Login</Text>
          </View>
            
          {/* Bottom Section - Phone Input */}

          <View style={styles.bottomSection}>
            <PhoneInput
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(formatPhoneNumber(text));
                setError('');
              }}
              editable={!loading}
              error={!!error}
            />

            <ErrorText message={error} visible={!!error} />

            <Button
              title="Send OTP"
              onPress={handleSendOTP}
              disabled={!isPhoneValid || loading}
              loading={loading}
            />

            {/* Legal Text */}
            <View style={styles.legalSection}>
              <Text style={styles.legalText}>
                By continuing, you agree to our{' '}
                <Text style={styles.legalLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.legalLink}>Privacy Policy.</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
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
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  loginHeading: {
    fontSize: 40,
    fontFamily: 'Fredoka_600SemiBold',
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  loginSubheading: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: Fonts.Regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  carouselContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  carouselTextContainer: {
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  carouselTitle: {
    fontSize: 24,
    fontFamily: Fonts.Bold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 6,
  },
  carouselSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Fonts.Regular,
  },
  bottomSection: {
    paddingHorizontal: 20,
    backgroundColor: Colors.backgroundWhite,
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingBottom: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderBottomWidth: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 5,
  },
  legalSection: {
    paddingHorizontal: 10,
    marginTop: 20,
  },
  legalText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: Fonts.Regular,
  },
  legalLink: {
    color: Colors.primary,
    fontFamily: Fonts.SemiBold,
    textDecorationLine: 'underline',
  },
});

