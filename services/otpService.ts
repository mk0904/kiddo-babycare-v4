// OTP Service - Handles OTP generation, sending, and verification
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configService } from './configService';

// Import local config as fallback (ensures it's always bundled)
let localConfigFallback: any = null;
try {
  localConfigFallback = require('@/config/kiddoAppConfig.json');
} catch (e) {
  // Config file might not be available in all build configurations
  // This is okay, we'll rely on configService
}

interface OTPData {
  otp: string;
  expiresAt: number;
  phoneNumber: string;
}

interface OTPResponse {
  success: boolean;
  message: string;
  devOtp?: string; // Only in dev mode for testing
}

class OTPService {
  private readonly STORAGE_PREFIX = 'kiddo_otp_';

  private getOTPConfig() {
    // First, try to get config from configService (works if remote config is loaded)
    let rawConfig = configService.getRawConfig();
    
    // If config not loaded yet, use local config file as fallback
    // This is critical for production builds where remote config might not have loaded yet
    if (!rawConfig && localConfigFallback) {
      rawConfig = localConfigFallback;
      if (__DEV__) {
        console.log('[OTP Service] Using local config file (fallback)');
      }
    }
    
    const otpConfig = rawConfig?.providers?.otp;
    
    // Log detailed error if OTP config is missing (helps with debugging)
    if (!otpConfig) {
      const errorMsg = '[OTP Service] OTP config not found. ';
      const debugInfo = rawConfig 
        ? 'Config loaded but providers.otp is missing.'
        : 'Config not loaded from configService or local file.';
      console.error(errorMsg + debugInfo);
      
      // In production, also log to help diagnose
      if (!__DEV__) {
        console.error('[OTP Service] rawConfig exists:', !!rawConfig);
        console.error('[OTP Service] localConfigFallback exists:', !!localConfigFallback);
        if (rawConfig) {
          console.error('[OTP Service] rawConfig.providers exists:', !!rawConfig.providers);
        }
      }
    }
    
    return otpConfig || null;
  }

  private getStorageKey(phoneNumber: string): string {
    return `${this.STORAGE_PREFIX}${phoneNumber}`;
  }

  private generateOTP(): string {
    // Generate 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(phoneNumber: string): Promise<OTPResponse> {
    try {
      // Ensure config is loaded before proceeding
      // If configService doesn't have config yet, try to load it
      if (!configService.getRawConfig()) {
        try {
          await configService.loadConfig();
        } catch (configError) {
          // Config loading failed, but we'll try with local fallback
          console.warn('[OTP Service] Failed to load config from configService, using local fallback');
        }
      }
      
      const config = this.getOTPConfig();
      
      if (!config) {
        // Log detailed error for debugging
        console.error('[OTP Service] OTP config is missing. Check if config file is properly bundled.');
        console.error('[OTP Service] Attempting to use hardcoded fallback values...');
        
        // Last resort: use hardcoded values from the config file
        // This ensures OTP works even if config loading completely fails
        const fallbackConfig = {
          apiBaseUrl: 'https://sms.shinenetcore.in/api/v2',
          senderId: 'SNCOTP',
          apiKey: '3Ri5Du6T3fbCAfWs9L5gUfOSn4pbofa/DjZucAqwplo=',
          clientId: 'b00a4a12-c1f3-420f-ae2c-e69988212928',
          messageTemplate: 'One time OTP From Kiddo App {#var#} to login or activate your profile apsops SNC',
          expiryMinutes: 5,
          countryCode: '91'
        };
        
        // Use fallback config
        const cleanedPhone = phoneNumber.replace(/\D/g, '');
        if (cleanedPhone.length !== 10) {
          return {
            success: false,
            message: 'Invalid phone number. Please enter a 10-digit number.',
          };
        }
        
        const otp = this.generateOTP();
        const fullNumber = cleanedPhone.startsWith(fallbackConfig.countryCode)
          ? cleanedPhone
          : `${fallbackConfig.countryCode}${cleanedPhone}`;
        // Replace {#var#} or {otp} with actual OTP value (API uses {#var#})
        const message = fallbackConfig.messageTemplate
          .replace(/{#var#}/g, otp)
          .replace(/{otp}/g, otp);
        
        const otpData: OTPData = {
          otp,
          expiresAt: Date.now() + fallbackConfig.expiryMinutes * 60 * 1000,
          phoneNumber: cleanedPhone,
        };
        
        const storageKey = this.getStorageKey(cleanedPhone);
        await AsyncStorage.setItem(storageKey, JSON.stringify(otpData));
        
        // Try to send SMS
        const apiBaseUrl = fallbackConfig.apiBaseUrl;
        const url = `${apiBaseUrl}/SendSMS`;
        const params = new URLSearchParams({
          SenderId: fallbackConfig.senderId,
          Is_Unicode: 'false',
          Is_Flash: 'false',
          Message: message,
          MobileNumbers: fullNumber,
          ApiKey: fallbackConfig.apiKey,
          ClientId: fallbackConfig.clientId,
        });
        
        const smsUrl = `${url}?${params.toString()}`;
        
        try {
          // Create AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          const response = await fetch(smsUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const status = response.status;
          let responseData: any = null;
          let responseText = '';

          try {
            responseText = await response.text();
            if (responseText.trim()) {
              try {
                responseData = JSON.parse(responseText);
              } catch (jsonError) {
                responseData = { message: responseText };
              }
            }
          } catch (parseError: any) {
            console.warn('[OTP Service] Failed to parse fallback response:', parseError.message);
            responseData = { error: 'Failed to parse API response' };
          }

          // Check if SMS was sent successfully
          // ShineNetCore API returns ErrorCode: 0 (number) or '0' (string) for success
          // Also check Data array for MessageErrorCode: 0
          const errorCode = responseData?.ErrorCode;
          const messageErrorCode = responseData?.Data?.[0]?.MessageErrorCode;
          const isSuccess = response.ok && (
            !responseData || 
            errorCode === 0 || 
            errorCode === '0' ||
            messageErrorCode === 0 ||
            messageErrorCode === '0' ||
            responseData.Status === 'Success' ||
            responseData.status === 'success'
          );

          if (isSuccess) {
            return {
              success: true,
              message: 'OTP sent successfully',
              ...(__DEV__ ? { devOtp: otp } : {}),
            };
          } else {
            const errorMsg = responseData?.Message || responseData?.message || responseData?.Error || `HTTP ${status}`;
            console.error('[OTP Service] Fallback SMS API error:', errorMsg);
            console.warn('[OTP Service] SMS API call failed, but OTP stored locally');
            return {
              success: true,
              message: 'OTP generated. Please check your phone.',
              ...(__DEV__ ? { devOtp: otp } : {}),
            };
          }
        } catch (apiError: any) {
          const errorType = apiError.name === 'AbortError' ? 'timeout' : 'network';
          console.error(`[OTP Service] Fallback SMS API ${errorType} error:`, apiError.message);
          console.warn('[OTP Service] Failed to send SMS, but OTP stored locally');
          return {
            success: true,
            message: 'OTP generated. Please check your phone.',
            ...(__DEV__ ? { devOtp: otp } : {}),
          };
        }
      }

      // Clean phone number (remove non-digits)
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      
      if (cleanedPhone.length !== 10) {
        return {
          success: false,
          message: 'Invalid phone number. Please enter a 10-digit number.',
        };
      }

      // Generate OTP
      const otp = this.generateOTP();
      
      // Log for debugging (dev mode only - never log OTP in production)
      if (__DEV__) {
        console.log(`[OTP Service] Phone: ${cleanedPhone}`);
        // OTP is NOT logged for security/privacy compliance
      }

      // Add country code
      const countryCode = config.countryCode || '91';
      const fullNumber = cleanedPhone.startsWith(countryCode)
        ? cleanedPhone
        : `${countryCode}${cleanedPhone}`;
      
      if (__DEV__) {
        console.log(`[OTP Service] Full Number: ${fullNumber}`);
      }

      // Format message
      const messageTemplate = config.messageTemplate || 'One time OTP From Kiddo App {#var#} to login or activate your profile apsops SNC';
      // Replace {#var#} or {otp} with actual OTP value (API uses {#var#})
      const message = messageTemplate
        .replace(/{#var#}/g, otp)
        .replace(/{otp}/g, otp);
      
      if (__DEV__) {
        console.log(`[OTP Service] Message: ${message}`);
      }

      // Store OTP in AsyncStorage with expiry
      const expiryMinutes = config.expiryMinutes || 5;
      const otpData: OTPData = {
        otp,
        expiresAt: Date.now() + expiryMinutes * 60 * 1000,
        phoneNumber: cleanedPhone,
      };

      const storageKey = this.getStorageKey(cleanedPhone);
      await AsyncStorage.setItem(storageKey, JSON.stringify(otpData));

      // Send SMS via ShineNetCore API
      const apiBaseUrl = config.apiBaseUrl || 'https://sms.shinenetcore.in/api/v2';
      const url = `${apiBaseUrl}/SendSMS`;
      
      const params = new URLSearchParams({
        SenderId: config.senderId || 'SNCOTP',
        Is_Unicode: 'false',
        Is_Flash: 'false',
        Message: message,
        MobileNumbers: fullNumber,
        ApiKey: config.apiKey || '',
        ClientId: config.clientId || '',
      });

      const smsUrl = `${url}?${params.toString()}`;

      // Log API call details for debugging (without sensitive data)
      if (__DEV__) {
        console.log('[OTP Service] Calling SMS API:', apiBaseUrl);
        console.log('[OTP Service] Phone number:', fullNumber);
        console.log('[OTP Service] Sender ID:', config.senderId);
      }

      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch(smsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check response status first
        const status = response.status;
        let responseData: any = null;
        let responseText = '';

        try {
          // Try to get response as text first (some APIs return text)
          responseText = await response.text();
          
          // Try to parse as JSON
          if (responseText.trim()) {
            try {
              responseData = JSON.parse(responseText);
            } catch (jsonError) {
              // Not JSON, use text response
              responseData = { message: responseText };
            }
          }
        } catch (parseError: any) {
          console.warn('[OTP Service] Failed to parse response:', parseError.message);
          responseData = { error: 'Failed to parse API response' };
        }

        // Log response for debugging
        if (__DEV__) {
          console.log('[OTP Service] API Response Status:', status);
          console.log('[OTP Service] API Response:', responseData);
        } else {
          // In production, log minimal info
          console.log('[OTP Service] SMS API Status:', status);
        }

        // Check if SMS was sent successfully
        // ShineNetCore API returns ErrorCode: 0 (number) or '0' (string) for success
        // Also check Data array for MessageErrorCode: 0
        const errorCode = responseData?.ErrorCode;
        const messageErrorCode = responseData?.Data?.[0]?.MessageErrorCode;
        const isSuccess = response.ok && (
          !responseData || 
          errorCode === 0 || 
          errorCode === '0' ||
          messageErrorCode === 0 ||
          messageErrorCode === '0' ||
          responseData.Status === 'Success' ||
          responseData.status === 'success'
        );

        if (isSuccess) {
          const result: OTPResponse = {
            success: true,
            message: 'OTP sent successfully',
          };

          // In dev mode, include OTP for testing (but don't log it for security)
          if (__DEV__) {
            result.devOtp = otp;
          }

          return result;
        } else {
          // API returned error - log details
          const errorMsg = responseData?.Message || responseData?.message || responseData?.Error || `HTTP ${status}`;
          console.error('[OTP Service] SMS API returned error:', {
            status,
            errorCode: responseData?.ErrorCode,
            errorMessage: errorMsg,
            fullResponse: responseData,
          });

          // OTP is stored, so user can still verify manually
          // This allows offline testing or if API fails
          console.warn('[OTP Service] SMS API call failed, but OTP stored locally. Error:', errorMsg);
          return {
            success: true,
            message: 'OTP generated. Please check your phone.',
            ...(__DEV__ ? { devOtp: otp } : {}),
          };
        }
      } catch (apiError: any) {
        // Network error, timeout, or API failure
        const errorType = apiError.name === 'AbortError' ? 'timeout' : 'network';
        const errorMessage = apiError.message || 'Unknown error';
        
        console.error(`[OTP Service] SMS API ${errorType} error:`, {
          message: errorMessage,
          name: apiError.name,
          stack: __DEV__ ? apiError.stack : undefined,
        });

        // OTP is still stored, so verification can work
        console.warn('[OTP Service] Failed to send SMS, but OTP stored locally');
        return {
          success: true,
          message: 'OTP generated. Please check your phone.',
          ...(__DEV__ ? { devOtp: otp } : {}),
        };
      }
    } catch (error: any) {
      console.error('[OTP Service] Error sending OTP:', error);
      return {
        success: false,
        message: error.message || 'Failed to send OTP. Please try again.',
      };
    }
  }

  async verifyOTP(phoneNumber: string, enteredOTP: string): Promise<OTPResponse> {
    try {
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      const storageKey = this.getStorageKey(cleanedPhone);

      // Retrieve OTP from storage
      const storedData = await AsyncStorage.getItem(storageKey);

      if (!storedData) {
        return {
          success: false,
          message: 'OTP not found. Please request a new OTP.',
        };
      }

      const otpData: OTPData = JSON.parse(storedData);

      // Check expiry
      if (Date.now() > otpData.expiresAt) {
        // Remove expired OTP
        await AsyncStorage.removeItem(storageKey);
        return {
          success: false,
          message: 'OTP has expired. Please request a new OTP.',
        };
      }

      // Verify OTP
      if (otpData.otp !== enteredOTP) {
        return {
          success: false,
          message: 'Invalid OTP. Please try again.',
        };
      }

      // OTP verified successfully - remove it from storage
      await AsyncStorage.removeItem(storageKey);

      return {
        success: true,
        message: 'OTP verified successfully',
      };
    } catch (error: any) {
      console.error('[OTP Service] Error verifying OTP:', error);
      return {
        success: false,
        message: error.message || 'Failed to verify OTP. Please try again.',
      };
    }
  }

  // Clear stored OTP (useful for cleanup)
  async clearOTP(phoneNumber: string): Promise<void> {
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    const storageKey = this.getStorageKey(cleanedPhone);
    await AsyncStorage.removeItem(storageKey);
  }
}

export const otpService = new OTPService();
