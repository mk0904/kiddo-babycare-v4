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

// Helper to check if running in dev/mock mode
const isMockMode = false; // Set to true if you want to force mock mode even with API implementation

export const customerService = {
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

      // Update metafields via Admin API (requires valid Shopify customer GID)
      const hasMetafields = metafields.baby_name || metafields.age || metafields.gender;
      if (hasMetafields) {
        let resolvedCustomerId = customerId;
        const isPlaceholderOrInvalid =
          !resolvedCustomerId ||
          resolvedCustomerId === 'gid://shopify/Customer/existing' ||
          resolvedCustomerId.includes('existing');
        if (isPlaceholderOrInvalid) {
          const fetchedId = await shopifyApi.getCurrentCustomerId(customerAccessToken);
          if (!fetchedId) {
            throw new Error('Could not resolve customer id. Please try again.');
          }
          resolvedCustomerId = fetchedId;
        }

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

        if (metafieldsArray.length > 0 && resolvedCustomerId) {
          await shopifyAdminApi.updateCustomerMetafields(resolvedCustomerId, metafieldsArray);
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

