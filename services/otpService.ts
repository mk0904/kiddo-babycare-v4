// OTP Service - Handles OTP generation, sending, and verification via backend API
import axios from 'axios';
import { configService } from './configService';
import { getBackendApiPath, getBackendBase } from './backendBase';


interface OTPResponse {
  success: boolean;
  message: string;
  devOtp?: string; // Only in dev mode for testing, if backend returns it
}

/** User shape returned by POST /auth/verify-and-login (matches backend AuthLoginUser) */
export interface VerifyAndLoginUser {
  id: string;
  phone: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  customerId?: string;
  displayName?: string;
  numberOfOrders?: number;
  acceptsMarketing?: boolean;
  createdAt?: string;
  updatedAt?: string;
  defaultAddress?: unknown;
}

export interface VerifyAndLoginResponse {
  success: boolean;
  accessToken: string;
  user?: VerifyAndLoginUser | null;
}

class OTPService {
  /**
   * Format phone number to E.164 format (e.g., +919876543210)
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Check if it already has country code (assuming 91 for India as default)
    // If length is 10, add 91. If length is 12 and starts with 91, keep it.
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return `+${cleaned}`;
    } else {
      // Fallback: just return with + prefix if it looks like it has a country code,
      // or default to adding +91 if we're unsure but it's not 10 digits.
      // For safety with the specific example provided (+917607235050),
      // let's ensure we prefer the +91 prefix.
      return `+${cleaned}`;
    }
  }

  private getBackendUrl(): string {
    return getBackendBase();
  }

  private getApiPath(path: string): string {
    return getBackendApiPath(path);
  }

  private getVerifyAndLoginUrl(): string {
    return this.getApiPath('auth/verify-and-login');
  }

  async sendOTP(phoneNumber: string): Promise<OTPResponse> {
    try {
      // Ensure config is loaded
      if (!configService.getRawConfig()) {
        try {
          await configService.loadConfig();
        } catch (e) {
          console.warn('[OTP Service] Failed to load remote config, using local fallback');
        }
      }

      const url = this.getApiPath('send-otp');
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      console.log(`[OTP Service] Sending OTP to ${formattedPhone} via ${url}`);

      const response = await axios.post(url, {
        phone: formattedPhone
      });

      // Assuming backend returns { success: true, message: "..." } or similar
      const data = response.data;
      
      if (data.success || response.status === 200 || response.status === 201) {
        return {
          success: true,
          message: data.message || 'OTP sent successfully',
          devOtp: data.devOtp // Pass through if backend provides it in dev mode
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to send OTP',
        };
      }
    } catch (error: any) {
      console.error('[OTP Service] Error sending OTP:', error);
      
      const message = error.response?.data?.message || error.message || 'Failed to send OTP. Please try again.';
      
      return {
        success: false,
        message,
      };
    }
  }

  async verifyOTP(phoneNumber: string, enteredOTP: string): Promise<OTPResponse> {
    try {
      const url = this.getApiPath('verify-otp');
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      console.log(`[OTP Service] Verifying OTP for ${formattedPhone} via ${url}`);

      const response = await axios.post(url, {
        phone: formattedPhone,
        code: enteredOTP
      });

      const data = response.data;

      // Check for explicit success flag in response
      // If data.success is defined, use it. Otherwise fall back to status code.
      // We prioritize data.success because some APIs return 200 even for logical failures.
      const isSuccess = data.success !== undefined ? data.success : (response.status === 200);

      if (isSuccess) {
        return {
          success: true,
          message: data.message || 'OTP verified successfully',
        };
      } else {
        return {
          success: false,
          message: data.message || 'Invalid OTP',
        };
      }
    } catch (error: any) {
      console.error('[OTP Service] Error verifying OTP:', error);
      
      let message = error.response?.data?.message || error.message || 'Failed to verify OTP. Please try again.';
      
      // Specifically handle 401 Unauthorized as Invalid OTP
      if (error.response?.status === 401) {
        message = 'Invalid OTP. Please try again.';
      }
      
      return {
        success: false,
        message,
      };
    }
  }

  /**
   * Verify OTP and complete login/signup on backend (Shopify create or login).
   * Replaces frontend flow: verify OTP → checkCustomerExists/createCustomer.
   */
  async verifyOTPAndLogin(
    phoneNumber: string,
    code: string,
    firstName?: string,
    lastName?: string
  ): Promise<VerifyAndLoginResponse> {
    const url = this.getVerifyAndLoginUrl();
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const body = {
      phone: formattedPhone,
      code,
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
    };
    console.log('[OTP Service] verifyOTPAndLogin request', { url, phone: formattedPhone, codeLength: code?.length });

    try {
      const response = await axios.post<VerifyAndLoginResponse>(url, body);

      const data = response.data;
      console.log('[OTP Service] verifyOTPAndLogin response', { status: response.status, success: data?.success, hasToken: !!data?.accessToken });
      if (data?.success && data?.accessToken) {
        return {
          success: true,
          accessToken: data.accessToken,
          user: data.user ?? undefined,
        };
      }
      return {
        success: false,
        accessToken: '',
        user: undefined,
      };
    } catch (error: any) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      const message =
        error.response?.data?.error ||
        error.message ||
        'Something went wrong. Please try again.';
      console.error('[OTP Service] verifyOTPAndLogin failed', {
        url,
        status,
        responseData,
        message: error.message,
      });
      throw new Error(message);
    }
  }

  // Clear stored OTP (legacy support / cleanup)
  async clearOTP(phoneNumber: string): Promise<void> {
    // No-op for backend-based OTP as state is managed on server
    // We could potentially call a logout or clear session endpoint if it existed
    console.log('[OTP Service] Clear OTP called (no-op for backend service)');
  }
}

export const otpService = new OTPService();
