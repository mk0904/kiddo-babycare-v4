import { shopifyAdminApi } from './shopifyAdminApi';
import { shopifyApi } from './shopifyApi';

export interface Customer {
  id: string;
  customerId?: string;
  phone: string | null;
  email?: string;
  firstName?: string;
  lastName?: string;
  customerAccessToken: string | null;
  isGuest: boolean;
  displayName?: string;
  numberOfOrders?: number;
  acceptsMarketing?: boolean;
  createdAt?: string;
  updatedAt?: string;
  defaultAddress?: any;
}

export interface CustomerResponse {
  success: boolean;
  customer?: Customer;
  message?: string;
}

// Helper to check if running in dev/mock mode
const isMockMode = false; // Set to true if you want to force mock mode even with API implementation

export const customerService = {
  // Check if customer exists by trying to get access token
  async checkCustomerExists(email: string, password: string) {
    try {
      if (isMockMode) return { exists: false, token: null, customer: null };

      const tokenResult = await shopifyApi.query(
        `mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
          customerAccessTokenCreate(input: $input) {
            customerAccessToken {
              accessToken
              expiresAt
            }
            customerUserErrors {
              field
              message
              code
            }
          }
        }`,
        {
          input: { email, password },
        }
      );

      if (tokenResult.data?.customerAccessTokenCreate?.customerUserErrors?.length > 0) {
        return { exists: false, token: null, customer: null };
      }

      const accessToken = tokenResult.data?.customerAccessTokenCreate?.customerAccessToken?.accessToken;

      if (accessToken) {
        // Get full details
        try {
          const customer = await shopifyApi.getCustomerDetails(accessToken);
          return {
            exists: true,
            token: accessToken,
            customer,
          };
        } catch (e) {
          return {
            exists: true,
            token: accessToken,
            customer: null,
          };
        }
      }

      return { exists: false, token: null, customer: null };
    } catch (error) {
      return { exists: false, token: null, customer: null };
    }
  },

  // Create customer in Shopify
  async createCustomer(phoneNumber: string, firstName?: string, lastName?: string): Promise<CustomerResponse> {
    // Format phone number to E.164 format (required by Shopify)
    // Remove any non-digit characters and ensure it's 10 digits
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    
    // If it's a 10-digit number, add +91 (India country code)
    // If it already starts with +91 or +1, keep it as is
    let formattedPhone: string;
    if (cleanedPhone.length === 10) {
      formattedPhone = `+91${cleanedPhone}`;
    } else if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) {
      formattedPhone = `+${cleanedPhone}`;
    } else if (phoneNumber.startsWith('+')) {
      formattedPhone = phoneNumber;
    } else {
      // Default to +91 if format is unclear
      formattedPhone = `+91${cleanedPhone.slice(-10)}`;
    }

    try {

      // Mock mode fallback
      if (isMockMode) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const mockToken = `mock_token_${Date.now()}`;
        return {
          success: true,
          customer: {
            id: `gid://shopify/Customer/${Date.now()}`,
            phone: formattedPhone,
            customerAccessToken: mockToken,
            isGuest: false,
            displayName: phoneNumber,
            createdAt: new Date().toISOString(),
          },
        };
      }

      // Format email: phone@kiddo.app (use cleaned 10-digit number)
      const email = `${cleanedPhone.slice(-10)}@kiddo.app`;
      // Fixed password for all users
      const password = 'kiddo@12345';

      // First, try to login with fixed password (for existing customers)
      const existing = await this.checkCustomerExists(email, password);
      if (existing.exists && existing.token) {
        console.log('[Customer Service] Existing customer found, logging in...');
        if (existing.customer) {
          return {
            success: true,
            customer: {
              ...existing.customer,
              customerAccessToken: existing.token,
              isGuest: false,
            } as Customer,
          };
        } else {
          return {
            success: true,
            customer: {
              id: `gid://shopify/Customer/existing`,
              email,
              phone: formattedPhone,
              firstName: firstName || 'User',
              lastName: lastName || '',
              customerAccessToken: existing.token,
              isGuest: false,
            } as Customer,
          };
        }
      }

      // If login failed, try to create new customer
      try {
        const result = await shopifyApi.createCustomerAndGetToken(
          email,
          password,
          firstName || 'User',
          lastName || undefined, // Pass undefined instead of empty string
          formattedPhone
        );

        if (!result.customer || !result.customerAccessToken) {
          throw new Error('Failed to create customer or get access token');
        }

        // Get full details
        let fullCustomerDetails = result.customer;
        try {
          const details = await shopifyApi.getCustomerDetails(result.customerAccessToken);
          if (details) {
            fullCustomerDetails = details;
          }
        } catch (e) {
          // Ignore detail fetch error
        }

        return {
          success: true,
          customer: {
            ...fullCustomerDetails,
            customerAccessToken: result.customerAccessToken,
            isGuest: false,
          } as Customer,
        };
      } catch (createError: any) {
        // If customer already exists OR rate limit exceeded, try to login instead
        // Rate limit might mean account exists but we can't create due to limits
        const shouldTryLogin = 
          createError.isCustomerExistsError ||
          createError.message?.includes('taken') || 
          createError.message?.includes('already') ||
          createError.message?.includes('exists') ||
          createError.message?.includes('Limit exceeded') ||
          createError.message?.includes('limit');
        
        if (shouldTryLogin) {
          console.log('[Customer Service] Customer already exists, attempting login...');
          
          // Account might exist, try to login
          try {
          const existing = await this.checkCustomerExists(email, password);
          
          if (existing.exists && existing.token) {
              console.log('[Customer Service] Login successful for existing customer');
            if (existing.customer) {
              return {
                success: true,
                customer: {
                  ...existing.customer,
                  customerAccessToken: existing.token,
                  isGuest: false,
                } as Customer,
              };
            } else {
              return {
                success: true,
                customer: {
                  id: `gid://shopify/Customer/existing`,
                  email,
                  phone: formattedPhone,
                  firstName,
                  lastName,
                  customerAccessToken: existing.token,
                  isGuest: false,
                } as Customer,
              };
            }
            } else {
              console.log('[Customer Service] Login failed - customer may need to reset password');
              // Customer exists but password might be wrong - this shouldn't happen with our format
              // but handle gracefully
              throw new Error('Account exists but could not be accessed. Please contact support.');
            }
          } catch (loginError: any) {
            console.error('[Customer Service] Error during login fallback:', loginError);
            // If login also fails, throw the original create error
            throw createError;
          }
        }
        
        // Re-throw if login didn't work or it's a different error
        throw createError;
      }

    } catch (error: any) {
      // Don't log expected "already exists" errors as they're handled gracefully
      if (!error.isCustomerExistsError && !error.message?.includes('taken') && !error.message?.includes('already')) {
      console.error('[Customer Service] Error creating customer:', error);
      }

      return {
        success: false,
        message: error.message || 'Failed to create customer. Please try again.',
      };
    }
  },

  // Create customer address
  async createCustomerAddress(customerAccessToken: string, addressData: any, setAsDefault: boolean = false) {
    try {
      if (isMockMode) {
        return {
          success: true,
          address: {
            id: `gid://shopify/MailingAddress/${Date.now()}`,
            ...addressData,
          },
        };
      }

      if (!customerAccessToken) {
        const error = new Error('No customer access token');
        console.error('[CustomerService] createCustomerAddress error:', error);
        throw error;
      }

      console.log('[CustomerService] Creating address with data:', addressData);
      const address = await shopifyApi.createCustomerAddress(customerAccessToken, addressData);

      if (!address || !address.id) {
        const error = new Error('Failed to create address - no address returned');
        console.error('[CustomerService] createCustomerAddress error:', error);
        throw error;
      }

      console.log('[CustomerService] Address created successfully:', address.id);

      if (setAsDefault && address.id) {
        try {
          await shopifyApi.setDefaultAddress(customerAccessToken, address.id);
          console.log('[CustomerService] Address set as default');
        } catch (e) {
          console.warn('[CustomerService] Failed to set address as default:', e);
          // Don't fail the whole operation if default setting fails
        }
      }

      return {
        success: true,
        address,
      };
    } catch (error: any) {
      console.error('[CustomerService] Error creating customer address:', error);
      console.error('[CustomerService] Error message:', error.message);
      console.error('[CustomerService] Error stack:', error.stack);
      // Re-throw the error so it can be caught by the caller
      throw error;
    }
  },

  // Update customer address
  async updateCustomerAddress(customerAccessToken: string, addressId: string, addressData: any) {
    try {
      if (isMockMode) {
        return {
          success: true,
          address: {
            id: addressId,
            ...addressData,
          },
        };
      }

      if (!customerAccessToken) {
        const error = new Error('No customer access token');
        console.error('[CustomerService] updateCustomerAddress error:', error);
        throw error;
      }

      console.log('[CustomerService] Updating address:', addressId, 'with data:', addressData);
      const address = await shopifyApi.updateCustomerAddress(customerAccessToken, addressId, addressData);

      if (!address || !address.id) {
        const error = new Error('Failed to update address - no address returned');
        console.error('[CustomerService] updateCustomerAddress error:', error);
        throw error;
      }

      console.log('[CustomerService] Address updated successfully:', address.id);

      return {
        success: true,
        address,
      };
    } catch (error: any) {
      console.error('[CustomerService] Error updating customer address:', error);
      console.error('[CustomerService] Error message:', error.message);
      console.error('[CustomerService] Error stack:', error.stack);
      // Re-throw the error so it can be caught by the caller
      throw error;
    }
  },

  // Delete customer address
  async deleteCustomerAddress(customerAccessToken: string, addressId: string) {
    try {
      if (isMockMode) return { success: true };

      if (!customerAccessToken) {
        return { success: false, error: 'No customer access token' };
      }

      await shopifyApi.deleteCustomerAddress(customerAccessToken, addressId);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Update customer with metafields
  async updateCustomerWithMetafields(
    customerAccessToken: string,
    customerData: { firstName?: string; lastName?: string },
    metafields: { baby_name?: string; age?: string; gender?: string },
    customerId?: string
  ) {
    try {
      if (isMockMode) {
        return { success: true };
      }

      if (!customerAccessToken) {
        return { success: false, message: 'No customer access token' };
      }

      // Update customer info (firstName/lastName) via Customer API
      if (customerData.firstName || customerData.lastName) {
        await shopifyApi.updateCustomer(customerAccessToken, customerData);
      }

      // Update metafields via Admin API
      if (customerId && (metafields.baby_name || metafields.age || metafields.gender)) {
        const metafieldsArray = [];
        if (metafields.baby_name) {
          metafieldsArray.push({
            namespace: 'custom',
            key: 'baby_name',
            value: metafields.baby_name,
            type: 'single_line_text_field',
          });
        }
        if (metafields.age) {
          metafieldsArray.push({
            namespace: 'custom',
            key: 'age',
            value: metafields.age.toString(), // Ensure it's a string
            type: 'single_line_text_field',
          });
        }
        if (metafields.gender) {
          metafieldsArray.push({
            namespace: 'custom',
            key: 'gender',
            value: metafields.gender,
            type: 'single_line_text_field',
          });
        }

        if (metafieldsArray.length > 0) {
          await shopifyAdminApi.updateCustomerMetafields(customerId, metafieldsArray);
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('[CustomerService] Error updating customer:', error);
      return {
        success: false,
        message: error.message || 'Failed to update customer',
      };
    }
  },
};

