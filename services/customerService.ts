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
  async createCustomer(phoneNumber: string): Promise<CustomerResponse> {
    try {
      // Mock mode fallback
      if (isMockMode) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const mockToken = `mock_token_${Date.now()}`;
        return {
          success: true,
          customer: {
            id: `gid://shopify/Customer/${Date.now()}`,
            phone: phoneNumber,
            customerAccessToken: mockToken,
            isGuest: false,
            displayName: phoneNumber,
            createdAt: new Date().toISOString(),
          },
        };
      }

      // Format email: phone@kiddo.app
      const email = `${phoneNumber}@kiddo.app`;
      const firstName = 'User';
      const lastName = phoneNumber.slice(-4);
      const password = `Kiddo${phoneNumber.slice(-4)}!`;

      // 1. Check if customer already exists
      const existing = await this.checkCustomerExists(email, password);

      if (existing.exists && existing.token) {
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
              phone: phoneNumber,
              firstName,
              lastName,
              customerAccessToken: existing.token,
              isGuest: false,
            } as Customer,
          };
        }
      }

      // 2. Create new customer
      const result = await shopifyApi.createCustomerAndGetToken(
        email,
        password,
        firstName,
        lastName,
        phoneNumber
      );

      if (!result.customer || !result.customerAccessToken) {
        throw new Error('Failed to create customer or get access token');
      }

      // 3. Get full details
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

    } catch (error: any) {
      console.error('[Customer Service] Error creating customer:', error);

      // Handle "already taken" error specifically if checkCustomerExists missed it
      if (error.message?.includes('taken')) {
        // Try one more time to login
        try {
          const email = `${phoneNumber}@kiddo.app`;
          const password = `Kiddo${phoneNumber.slice(-4)}!`;
          const retry = await this.checkCustomerExists(email, password);
          if (retry.exists && retry.token) {
            return {
              success: true,
              customer: {
                ...(retry.customer || {}),
                customerAccessToken: retry.token,
                isGuest: false,
                email,
                phone: phoneNumber,
              } as Customer,
            };
          }
        } catch (retryError) { }
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
        return { success: false, error: 'No customer access token' };
      }

      const address = await shopifyApi.createCustomerAddress(customerAccessToken, addressData);

      if (setAsDefault && address?.id) {
        try {
          await shopifyApi.setDefaultAddress(customerAccessToken, address.id);
        } catch (e) {
          // Ignore default setting error
        }
      }

      return {
        success: true,
        address,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
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
        return { success: false, error: 'No customer access token' };
      }

      const address = await shopifyApi.updateCustomerAddress(customerAccessToken, addressId, addressData);

      return {
        success: true,
        address,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
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
};

