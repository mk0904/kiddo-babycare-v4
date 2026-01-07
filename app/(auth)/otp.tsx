import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OTPInput } from '@/components/ui/OTPInput';
import { Button } from '@/components/ui/Button';
import { ErrorText } from '@/components/ui/ErrorText';
import { Colors } from '@/constants/theme';
import { otpService } from '@/services/otpService';
import { customerService } from '@/services/customerService';
import { useAuth } from '@/context/AuthContext';

export default function OTPScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phoneNumber: string }>();
  const { phoneNumber } = params;
  const { login, isAuthenticated, user } = useAuth();
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  // Navigate to home after OTP verification
  useEffect(() => {
    const isGuest = user?.isGuest === true;

    if (isAuthenticated && !loading && otpVerified && !isGuest) {
      const navigationTimer = setTimeout(() => {
        router.replace('/(tabs)');
      }, 600);

      return () => clearTimeout(navigationTimer);
    }
  }, [isAuthenticated, loading, otpVerified, user, router]);

  const handleVerifyOTP = async (otpValue?: string) => {
    const otpToVerify = otpValue || otp.join('');

    if (otpToVerify.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setOtpVerified(false);

      // Verify OTP
      const verifyResult = await otpService.verifyOTP(phoneNumber, otpToVerify);

      if (!verifyResult.success) {
        setError(verifyResult.message || 'Invalid OTP');
        setOtp(['', '', '', '', '', '']);
        setOtpVerified(false);
        setLoading(false);
        return;
      }

      // OTP verified, create customer
      const customerResult = await customerService.createCustomer(phoneNumber);

      if (customerResult.success && customerResult.customer) {
        if (!customerResult.customer.customerAccessToken) {
          setError('Failed to authenticate. Please try again.');
          setOtp(['', '', '', '', '', '']);
          setLoading(false);
          return;
        }

        setOtpVerified(true);

        // Login user
        await login({
          id: customerResult.customer.id,
          phone: phoneNumber,
          email: customerResult.customer.email,
          firstName: customerResult.customer.firstName,
          lastName: customerResult.customer.lastName,
          customerId: customerResult.customer.id,
          customerAccessToken: customerResult.customer.customerAccessToken,
          isGuest: false,
          displayName: customerResult.customer.displayName,
          numberOfOrders: customerResult.customer.numberOfOrders,
          acceptsMarketing: customerResult.customer.acceptsMarketing,
          createdAt: customerResult.customer.createdAt,
          updatedAt: customerResult.customer.updatedAt,
          defaultAddress: customerResult.customer.defaultAddress,
        });
      } else {
        setError('Failed to create account. Please try again.');
        setOtp(['', '', '', '', '', '']);
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
      setOtp(['', '', '', '', '', '']);
      setOtpVerified(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResending(true);
    setError('');

    try {
      const result = await otpService.sendOTP(phoneNumber);

      if (result && result.success) {
        Alert.alert('Success', 'OTP has been resent to your phone number');
        setOtp(['', '', '', '', '', '']);
        setError('');
      } else {
        const errorMsg = result?.message || 'Failed to resend OTP';
        setError(errorMsg);
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to resend OTP. Please try again.';
      setError(errorMessage);

      if (__DEV__) {
        setOtp(['', '', '', '', '', '']);
        console.log('Dev Mode: OTP may have been generated, check console.');
      }
    } finally {
      setResending(false);
    }
  };

  const otpComplete = otp.every((digit) => digit !== '');

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
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Enter OTP</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit code to{'\n'}
              <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            </Text>
          </View>

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            <OTPInput
              value={otp}
              onChange={setOtp}
              onComplete={handleVerifyOTP}
              error={!!error}
              editable={!loading}
            />
          </View>

          <ErrorText message={error} visible={!!error} />

          {/* Verify Button */}
          <Button
            title="Verify OTP"
            onPress={() => handleVerifyOTP()}
            disabled={!otpComplete || loading}
            loading={loading}
          />

          {/* Resend OTP */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity
              onPress={handleResendOTP}
              disabled={resending}
              activeOpacity={0.7}
            >
              <Text style={styles.resendLink}>
                {resending ? 'Resending...' : 'Resend OTP'}
              </Text>
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
    color: Colors.text,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  phoneNumber: {
    color: Colors.primary,
    fontWeight: '600',
  },
  otpContainer: {
    marginBottom: 24,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resendLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
});

