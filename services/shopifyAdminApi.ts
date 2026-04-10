// Shopify Admin API Service
// For operations that require Admin privileges (Draft Orders, Order Editing, etc.)

import {
  SHOPIFY_ADMIN_ACCESS_TOKEN,
  SHOPIFY_STORE_DOMAIN,
} from '@/config/shopify';
import axios from 'axios';

// Admin API GraphQL Client
const adminClient = axios.create({
  baseURL: `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`,
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
  },
});

// Types
export interface LineItemInput {
  variantId: string;
  quantity: number;
  title?: string;
  originalUnitPrice?: string;
  customAttributes?: Array<{ key: string; value: string }>;
}

export interface AddressInput {
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  country: string;
  zip: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AppliedDiscountInput {
  valueType: 'FIXED_AMOUNT' | 'PERCENTAGE';
  value: number;
  title?: string;
  description?: string;
}

export interface DraftOrderInput {
  customerId?: string;
  email?: string;
  lineItems: LineItemInput[];
  shippingAddress?: AddressInput;
  billingAddress?: AddressInput;
  tags?: string[];
  note?: string;
  customAttributes?: Array<{ key: string; value: string }>;
  /** Discount codes to apply (Shopify applies eligible ones) */
  discountCodes?: string[];
  /** Exact discount amount to apply (overrides discountCodes calculation when set) */
  appliedDiscount?: AppliedDiscountInput;
}

export interface DraftOrder {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  totalPrice: string;
  subtotalPrice: string;
  currencyCode: string;
  tags: string[];
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        quantity: number;
        originalUnitPrice: string;
        variant?: {
          id: string;
          image?: { url: string };
        };
      };
    }>;
  };
}

// GraphQL Mutations
const DRAFT_ORDER_CREATE_MUTATION = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        status
        createdAt
        updatedAt
        totalPrice
        subtotalPrice
        totalTax
        currencyCode
        customer {
          id
          displayName
          email
        }
        lineItems(first: 250) {
          edges {
            node {
              id
              title
              quantity
              originalUnitPrice
              variant {
                id
                image {
                  url
                }
              }
            }
          }
        }
        shippingAddress {
          address1
          address2
          city
          province
          country
          zip
          firstName
          lastName
          phone
        }
        tags
        customAttributes {
          key
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DRAFT_ORDER_UPDATE_MUTATION = `
  mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
    draftOrderUpdate(id: $id, input: $input) {
      draftOrder {
        id
        name
        status
        tags
        note
        lineItems(first: 250) {
          edges {
            node {
              id
              title
              quantity
              originalUnitPrice
            }
          }
        }
        customAttributes {
          key
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DRAFT_ORDER_COMPLETE_MUTATION = `
  mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
    draftOrderComplete(id: $id, paymentPending: $paymentPending) {
      draftOrder {
        id
        status
        order {
          id
          name
          createdAt
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          tags
          customAttributes {
            key
            value
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DRAFT_ORDER_DELETE_MUTATION = `
  mutation draftOrderDelete($input: DraftOrderDeleteInput!) {
    draftOrderDelete(input: $input) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_DRAFT_ORDER_QUERY = `
  query getDraftOrder($id: ID!) {
    draftOrder(id: $id) {
      id
      name
      status
      createdAt
      updatedAt
      totalPrice
      subtotalPrice
      currencyCode
      tags
      customer {
        id
        displayName
        email
      }
      lineItems(first: 250) {
        edges {
          node {
            id
            title
            quantity
            originalUnitPrice
            customAttributes {
              key
              value
            }
            variant {
              id
              sku
              title
              image {
                url
              }
              product {
                featuredImage {
                  url
                }
                images(first: 1) {
                  edges {
                    node {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
      shippingAddress {
        address1
        address2
        city
        province
        country
        zip
        firstName
        lastName
        phone
      }
      customAttributes {
        key
        value
      }
    }
  }
`;

// Admin API Service
export const shopifyAdminApi = {
  /**
   * Create a draft order (used for Try & Buy)
   */
  createDraftOrder: async (input: DraftOrderInput): Promise<DraftOrder> => {
    try {
      // Format line items for GraphQL (include customAttributes for booking_date etc.)
      const lineItems = input.lineItems.map((item) => {
        const variantId = item.variantId.includes('gid://')
          ? item.variantId
          : `gid://shopify/ProductVariant/${item.variantId}`;
        return {
          variantId,
          quantity: item.quantity,
          ...(item.originalUnitPrice && { originalUnitPrice: item.originalUnitPrice }),
          ...(item.customAttributes && item.customAttributes.length > 0 && { customAttributes: item.customAttributes }),
        };
      });

      // Format customer ID if provided
      const customerId = input.customerId
        ? input.customerId.includes('gid://')
          ? input.customerId
          : `gid://shopify/Customer/${input.customerId.replace('shopify-', '')}`
        : undefined;

      const variables = {
        input: {
          lineItems,
          ...(customerId && { customerId }),
          ...(input.email && { email: input.email }),
          ...(input.shippingAddress && { shippingAddress: input.shippingAddress }),
          ...(input.billingAddress && { billingAddress: input.billingAddress }),
          ...(input.tags && input.tags.length > 0 && { tags: input.tags }),
          ...(input.note && { note: input.note }),
          ...(input.customAttributes && input.customAttributes.length > 0 && {
            customAttributes: input.customAttributes,
          }),
          ...(input.discountCodes && input.discountCodes.length > 0 && !input.appliedDiscount && {
            discountCodes: input.discountCodes.map((c) => c.toUpperCase()),
          }),
          ...(input.appliedDiscount && input.appliedDiscount.value > 0 && {
            appliedDiscount: {
              valueType: input.appliedDiscount.valueType,
              value: input.appliedDiscount.value,
              ...(input.appliedDiscount.title && { title: input.appliedDiscount.title }),
            },
          }),
        },
      };

      console.log('[AdminAPI] Creating draft order:', JSON.stringify(variables, null, 2));

      const response = await adminClient.post('', {
        query: DRAFT_ORDER_CREATE_MUTATION,
        variables,
      });

      if (response.data.errors) {
        console.error('[AdminAPI] GraphQL errors:', response.data.errors);
        throw new Error(response.data.errors[0]?.message || 'Failed to create draft order');
      }

      const result = response.data.data.draftOrderCreate;

      if (result.userErrors && result.userErrors.length > 0) {
        console.error('[AdminAPI] User errors:', result.userErrors);
        const errorMessage = result.userErrors[0].message || 'Failed to create draft order';
        
        // Provide more helpful error messages
        if (errorMessage.includes('no longer available') || errorMessage.includes('is no longer available')) {
          // Extract product ID if present
          const productIdMatch = errorMessage.match(/ID\s+(\d+)/);
          if (productIdMatch) {
            throw new Error(`Product with ID ${productIdMatch[1]} is no longer available. Please remove it from your cart.`);
          }
          throw new Error('One or more products in your cart are no longer available. Please remove them and try again.');
        }
        
        throw new Error(errorMessage);
      }

      if (!result.draftOrder) {
        console.error('[AdminAPI] No draft order in response:', result);
        throw new Error('Failed to create draft order: No draft order returned');
      }

      console.log('[AdminAPI] Draft order created:', result.draftOrder.id);
      return result.draftOrder;
    } catch (error: any) {
      console.error('[AdminAPI] Error creating draft order:', error.message);
      throw error;
    }
  },

  /**
   * Update a draft order (used for modifying items in Try & Buy)
   */
  updateDraftOrder: async (
    draftOrderId: string,
    updates: Partial<DraftOrderInput>
  ): Promise<DraftOrder> => {
    try {
      const id = draftOrderId.includes('gid://')
        ? draftOrderId
        : `gid://shopify/DraftOrder/${draftOrderId}`;

      const input: any = {};

      if (updates.lineItems) {
        input.lineItems = updates.lineItems.map((item) => ({
          variantId: item.variantId.includes('gid://')
            ? item.variantId
            : `gid://shopify/ProductVariant/${item.variantId}`,
          quantity: item.quantity,
        }));
      }

      if (updates.tags) input.tags = updates.tags;
      if (updates.note !== undefined) input.note = updates.note;
      if (updates.customAttributes) input.customAttributes = updates.customAttributes;

      console.log('[AdminAPI] Updating draft order:', id, input);

      const response = await adminClient.post('', {
        query: DRAFT_ORDER_UPDATE_MUTATION,
        variables: { id, input },
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0]?.message || 'Failed to update draft order');
      }

      const result = response.data.data.draftOrderUpdate;

      if (result.userErrors && result.userErrors.length > 0) {
        throw new Error(result.userErrors[0].message || 'Failed to update draft order');
      }

      return result.draftOrder;
    } catch (error: any) {
      console.error('[AdminAPI] Error updating draft order:', error.message);
      throw error;
    }
  },

  /**
   * Complete a draft order (convert to real order)
   */
  completeDraftOrder: async (
    draftOrderId: string,
    paymentPending: boolean = false
  ): Promise<{ draftOrder: DraftOrder; order: any }> => {
    try {
      const id = draftOrderId.includes('gid://')
        ? draftOrderId
        : `gid://shopify/DraftOrder/${draftOrderId}`;

      console.log('[AdminAPI] Completing draft order:', id, { paymentPending });

      const response = await adminClient.post('', {
        query: DRAFT_ORDER_COMPLETE_MUTATION,
        variables: { id, paymentPending },
      });

      console.log('[AdminAPI] Complete response status:', response.status);
      if (response.data?.errors) {
        console.error('[AdminAPI] GraphQL Errors in complete:', JSON.stringify(response.data.errors));
      }
      if (response.data?.data?.draftOrderComplete?.userErrors?.length > 0) {
        console.error('[AdminAPI] User Errors in complete:', JSON.stringify(response.data.data.draftOrderComplete.userErrors));
      }

      if (response.data.errors) {
        throw new Error(response.data.errors[0]?.message || 'Failed to complete draft order');
      }

      const result = response.data.data.draftOrderComplete;

      if (result.userErrors && result.userErrors.length > 0) {
        throw new Error(result.userErrors[0].message || 'Failed to complete draft order');
      }

      // Validate that order was actually created
      if (!result.draftOrder) {
        console.error('[AdminAPI] Draft order completion returned no draftOrder:', result);
        throw new Error('Failed to complete draft order: No draft order in response');
      }

      if (!result.draftOrder.order) {
        console.error('[AdminAPI] Draft order completion returned no order:', {
          draftOrderId: id,
          draftOrderStatus: result.draftOrder.status,
          result,
        });
        throw new Error('Failed to complete draft order: Draft order was not converted to order');
      }

      if (!result.draftOrder.order.id) {
        console.error('[AdminAPI] Completed order missing ID:', result.draftOrder.order);
        throw new Error('Failed to complete draft order: Order missing ID');
      }

      console.log('[AdminAPI] Draft order completed successfully:', {
        draftOrderId: id,
        orderId: result.draftOrder.order.id,
        orderName: result.draftOrder.order.name,
        orderCreatedAt: result.draftOrder.order.createdAt,
      });

      return {
        draftOrder: result.draftOrder,
        order: result.draftOrder.order,
      };
    } catch (error: any) {
      console.error('[AdminAPI] Error completing draft order:', error.message, error.response?.data);
      throw error;
    }
  },

  /**
   * Get a draft order by ID
   */
  getDraftOrder: async (draftOrderId: string): Promise<DraftOrder | null> => {
    try {
      const id = draftOrderId.includes('gid://')
        ? draftOrderId
        : `gid://shopify/DraftOrder/${draftOrderId}`;

      const response = await adminClient.post('', {
        query: GET_DRAFT_ORDER_QUERY,
        variables: { id },
      });

      if (response.data.errors) {
        console.error('[AdminAPI] GraphQL errors:', response.data.errors);
        return null;
      }

      return response.data.data.draftOrder;
    } catch (error: any) {
      console.error('[AdminAPI] Error fetching draft order:', error.message);
      return null;
    }
  },

  /**
   * Delete a draft order
   */
  deleteDraftOrder: async (draftOrderId: string): Promise<boolean> => {
    try {
      const id = draftOrderId.includes('gid://')
        ? draftOrderId
        : `gid://shopify/DraftOrder/${draftOrderId}`;

      const response = await adminClient.post('', {
        query: DRAFT_ORDER_DELETE_MUTATION,
        variables: { input: { id } },
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0]?.message || 'Failed to delete draft order');
      }

      const result = response.data.data.draftOrderDelete;

      if (result.userErrors && result.userErrors.length > 0) {
        throw new Error(result.userErrors[0].message || 'Failed to delete draft order');
      }

      return true;
    } catch (error: any) {
      console.error('[AdminAPI] Error deleting draft order:', error.message);
      return false;
    }
  },

  /**
   * Update customer metafields (requires Admin API)
   */
  updateCustomerMetafields: async (
    customerId: string,
    metafields: Array<{ namespace: string; key: string; value: string; type: string }>
  ): Promise<boolean> => {
    try {
      // Format customer ID
      const formattedCustomerId = customerId.includes('gid://')
        ? customerId
        : `gid://shopify/Customer/${customerId.replace('shopify-', '').replace('gid://shopify/Customer/', '')}`;

      // Update each metafield using metafieldsSet mutation
      const METAFIELDS_SET_MUTATION = `
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      // Format metafields for input
      const metafieldsInput = metafields.map((mf) => ({
        ownerId: formattedCustomerId,
        namespace: mf.namespace,
        key: mf.key,
        value: mf.value,
        type: mf.type || 'single_line_text_field',
      }));

      const response = await adminClient.post('', {
        query: METAFIELDS_SET_MUTATION,
        variables: {
          metafields: metafieldsInput,
        },
      });

      if (response.data.errors) {
        console.error('[AdminAPI] GraphQL errors updating metafields:', response.data.errors);
        throw new Error(response.data.errors[0]?.message || 'Failed to update customer metafields');
      }

      const result = response.data.data.metafieldsSet;

      if (result.userErrors && result.userErrors.length > 0) {
        console.error('[AdminAPI] User errors updating metafields:', result.userErrors);
        throw new Error(result.userErrors[0].message || 'Failed to update customer metafields');
      }

      console.log('[AdminAPI] Customer metafields updated successfully');
      return true;
    } catch (error: any) {
      console.error('[AdminAPI] Error updating customer metafields:', error.message);
      throw error;
    }
  },
};
