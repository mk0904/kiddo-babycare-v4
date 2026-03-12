// Shopify API Service - Similar to Kiddo's implementation
import { SHOPIFY_API_URL, SHOPIFY_STOREFRONT_ACCESS_TOKEN } from '@/config/shopify';
import axios from 'axios';

const client = axios.create({
  baseURL: SHOPIFY_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_ACCESS_TOKEN,
  },
});

// GraphQL Queries
const GET_PRODUCTS_QUERY = `
  query getProducts($query: String!, $first: Int!, $sortKey: ProductSortKeys, $reverse: Boolean) {
    products(first: $first, query: $query, sortKey: $sortKey, reverse: $reverse) {
      edges {
          node {
            id
            title
            description
            handle
            availableForSale
            totalInventory
            tags
            vendor
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 1) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                   amount
                   currencyCode
                }
                availableForSale
                quantityAvailable
                currentlyNotInStock
              }
            }
          }
        }
      }
    }
  }
`;

const GET_COLLECTION_BY_ID_QUERY = `
  query getCollection($id: ID!) {
    collection(id: $id) {
      id
      title
      description
      image {
        url
        altText
      }
    }
  }
`;

const GET_PRODUCTS_BY_COLLECTION_QUERY = `
  query getProductsByCollection($id: ID!, $first: Int!, $after: String, $sortKey: ProductCollectionSortKeys, $reverse: Boolean, $filters: [ProductFilter!]) {
    collection(id: $id) {
      id
      title
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse, filters: $filters) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            description
            handle
            availableForSale
            totalInventory
            tags
            vendor
            productType
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 5) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 250) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  availableForSale
                  quantityAvailable
                  currentlyNotInStock
                  selectedOptions {
                    name
                    value
                  }
                  image {
                    url
                  }
                  compareAtPrice {
                      amount
                      currencyCode
                  }
                }
              }
            }
            compareAtPriceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
        filters {
          id
          label
          type
          values {
            id
            label
            count
            input
          }
        }
      }
    }
  }
`;

const GET_PRODUCT_BY_HANDLE_QUERY = `
  query getProductByHandle($handle: String!) {
    product(handle: $handle) {
      id
      title
      description
      handle
      availableForSale
      totalInventory
      tags
      vendor
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 10) {
        edges {
          node {
            url
            altText
          }
        }
      }
      variants(first: 20) {
        edges {
          node {
            id
            title
            price {
              amount
              currencyCode
            }
            compareAtPrice {
              amount
              currencyCode
            }
            availableForSale
            quantityAvailable
            currentlyNotInStock
            selectedOptions {
              name
              value
            }
            image {
              url
            }
          }
        }
      }
      options {
        id
        name
        values
      }
      metafields(identifiers: [
        {namespace: "custom", key: "fabric"}, 
        {namespace: "custom", key: "wash_care"},
        {namespace: "custom", key: "price_on_kiddo"},
        {namespace: "custom", key: "price_on_amazon"},
        {namespace: "custom", key: "price_on_firstcry"},
        {namespace: "custom", key: "price_on_blinkit"},
        {namespace: "custom", key: "price_on_zepto"}
      ]) {
        id
        key
        value
        namespace
      }
    }
  }

`;

const GET_PRODUCT_BY_ID_QUERY = `
  query getProductById($id: ID!) {
    product(id: $id) {
      id
      title
      description
      handle
      availableForSale
      totalInventory
      tags
      vendor
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 10) {
        edges {
          node {
            url
            altText
          }
        }
      }
      variants(first: 20) {
        edges {
          node {
            id
            title
            price {
              amount
              currencyCode
            }
            availableForSale
            quantityAvailable
            currentlyNotInStock
            selectedOptions {
              name
              value
            }
            image {
              url
            }
            compareAtPrice {
              amount
              currencyCode
            }
          }
        }
      }
      options {
        id
        name
        values
      }
      metafields(identifiers: [
        {namespace: "custom", key: "fabric"}, 
        {namespace: "custom", key: "wash_care"},
        {namespace: "custom", key: "price_on_kiddo"},
        {namespace: "custom", key: "price_on_amazon"},
        {namespace: "custom", key: "price_on_firstcry"},
        {namespace: "custom", key: "price_on_blinkit"},
        {namespace: "custom", key: "price_on_zepto"}
      ]) {
        id
        key
        value
        namespace
      }
    }
  }

`;

const GET_PRODUCT_RECOMMENDATIONS_QUERY = `
  query getProductRecommendations($productId: ID!) {
    productRecommendations(productId: $productId) {
      id
      title
      handle
      availableForSale
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 1) {
        edges {
          node {
            url
            altText
          }
        }
      }
      variants(first: 10) {
        edges {
          node {
            id
            title
            price {
               amount
               currencyCode
            }
            compareAtPrice {
               amount
               currencyCode
            }
            availableForSale
            quantityAvailable
            currentlyNotInStock
            selectedOptions {
              name
              value
            }
            image {
              url
            }
          }
        }
      }
    }
  }

`;

const GET_CUSTOMER_ORDERS_QUERY = `
  query getCustomerOrders($customerAccessToken: String!, $first: Int!) {
    customer(customerAccessToken: $customerAccessToken) {
      id
      orders(first: $first, sortKey: PROCESSED_AT, reverse: true) {
        totalCount
        edges {
          node {
            id
            orderNumber
            processedAt
            financialStatus
            fulfillmentStatus
            currentTotalPrice {
              amount
              currencyCode
            }
            lineItems(first: 5) {
              edges {
                node {
                  title
                  quantity
                  customAttributes {
                    key
                    value
                  }
                  variant {
                    title
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const GET_ORDER_BY_ID_QUERY = `
  query getOrderById($id: ID!) {
    node(id: $id) {
      ... on Order {
        id
        orderNumber
        processedAt
        financialStatus
        fulfillmentStatus
        currentTotalPrice {
          amount
          currencyCode
        }
        totalShippingPrice {
          amount
          currencyCode
        }
        totalTax {
          amount
          currencyCode
        }
        subtotalPrice {
          amount
          currencyCode
        }
        shippingAddress {
          address1
          city
          province
          zip
          country
        }
        lineItems(first: 20) {
          edges {
            node {
              title
              quantity
              originalTotalPrice {
                amount
                currencyCode
              }
              customAttributes {
                key
                value
              }
              variant {
                title
                image {
                  url
                }
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

const CUSTOMER_ADDRESS_CREATE_MUTATION = `
  mutation customerAddressCreate($customerAccessToken: String!, $address: MailingAddressInput!) {
    customerAddressCreate(customerAccessToken: $customerAccessToken, address: $address) {
      customerAddress {
        id
        address1
        address2
        city
        province
        country
        zip
        firstName
        lastName
        phone
        company
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

const CUSTOMER_ADDRESS_UPDATE_MUTATION = `
  mutation customerAddressUpdate($customerAccessToken: String!, $id: ID!, $address: MailingAddressInput!) {
    customerAddressUpdate(customerAccessToken: $customerAccessToken, id: $id, address: $address) {
      customerAddress {
        id
        address1
        address2
        city
        province
        country
        zip
        firstName
        lastName
        phone
        company
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

const CUSTOMER_ADDRESS_DELETE_MUTATION = `
  mutation customerAddressDelete($customerAccessToken: String!, $id: ID!) {
    customerAddressDelete(customerAccessToken: $customerAccessToken, id: $id) {
      deletedCustomerAddressId
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

const CUSTOMER_ADDRESSES_QUERY = `
  query customerAddresses($customerAccessToken: String!, $first: Int!) {
    customer(customerAccessToken: $customerAccessToken) {
      addresses(first: $first) {
        edges {
          node {
            id
            address1
            address2
            city
            province
            country
            zip
            firstName
            lastName
            phone
            company
          }
        }
      }
      defaultAddress {
        id
        address1
        address2
        city
        province
        country
        zip
        firstName
        lastName
        phone
        company
      }
    }
  }
`;

const CUSTOMER_DEFAULT_ADDRESS_UPDATE_MUTATION = `
  mutation customerDefaultAddressUpdate($customerAccessToken: String!, $addressId: ID!) {
    customerDefaultAddressUpdate(customerAccessToken: $customerAccessToken, addressId: $addressId) {
      customer {
        id
        defaultAddress {
          id
        }
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

const CUSTOMER_UPDATE_MUTATION = `
  mutation customerUpdate($customerAccessToken: String!, $customer: CustomerUpdateInput!) {
    customerUpdate(customerAccessToken: $customerAccessToken, customer: $customer) {
      customer {
        id
        firstName
        lastName
        email
        phone
        displayName
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

const CART_DISCOUNT_CODES_UPDATE_MUTATION = `
  mutation cartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
      cart {
        id
        checkoutUrl
        discountCodes {
          code
          applicable
        }
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
          totalTaxAmount {
            amount
            currencyCode
          }
        }
        discountAllocations {
          discountedAmount {
            amount
            currencyCode
          }
          discountApplication {
            __typename
            allocationMethod
            targetSelection
            targetType
            value {
              ... on MoneyV2 {
                amount
                currencyCode
              }
              ... on PricingPercentageValue {
                percentage
              }
            }
          }
          __typename
          ... on CartCodeDiscountAllocation {
            code
          }
          ... on CartAutomaticDiscountAllocation {
            title
          }
          ... on CartCustomDiscountAllocation {
            title
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

const CART_ATTRIBUTES_UPDATE_MUTATION = `
  mutation cartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!) {
    cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
      cart {
        id
        attribute(key: "Gift Wrapping") {
            key
            value
        }
        lines(first: 100) {
            edges {
             node {
                 id
                 quantity
             }
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

const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        discountCodes {
          code
          applicable
        }
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
          totalTaxAmount {
            amount
            currencyCode
          }
        }
        discountAllocations {
          discountedAmount {
            amount
            currencyCode
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

const CART_LINES_ADD_MUTATION = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        discountCodes {
          code
          applicable
        }
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
          totalTaxAmount {
            amount
            currencyCode
          }
        }
        discountAllocations {
          discountedAmount {
            amount
            currencyCode
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

const GET_CART_QUERY = `
  query getCart($cartId: ID!) {
    cart(id: $cartId) {
      id
      checkoutUrl
      discountCodes {
        code
        applicable
      }
      lines(first: 250) {
        edges {
          node {
            id
            quantity
            attributes {
              key
              value
            }
            merchandise {
              ... on ProductVariant {
                id
                title
                price {
                  amount
                  currencyCode
                }
                product {
                  id
                  title
                  tags
                  images(first: 1) {
                    edges {
                      node {
                        url
                      }
                    }
                  }
                }
                image {
                  url
                }
                availableForSale
              }
            }
            cost {
              amountPerQuantity {
                amount
                currencyCode
              }
              subtotalAmount {
                amount
                currencyCode
              }
              totalAmount {
                amount
                currencyCode
              }
            }
            discountAllocations {
              discountedAmount {
                amount
                currencyCode
              }
            }
          }
        }
      }
      cost {
        totalAmount {
          amount
          currencyCode
        }
        subtotalAmount {
          amount
          currencyCode
        }
        totalTaxAmount {
          amount
          currencyCode
        }
      }
      discountAllocations {
        discountedAmount {
          amount
          currencyCode
        }
        discountApplication {
          __typename
          allocationMethod
          targetSelection
          targetType
          value {
            ... on MoneyV2 {
              amount
              currencyCode
            }
            ... on PricingPercentageValue {
              percentage
            }
          }
        }
        __typename
        ... on CartCodeDiscountAllocation {
          code
        }
        ... on CartAutomaticDiscountAllocation {
          title
        }
        ... on CartCustomDiscountAllocation {
          title
        }
      }
    }
  }
`;

export interface ShopifyProduct {
  id: string;
  title: string;
  description?: string;
  handle: string;
  tags?: string[];
  vendor?: string;
  priceRange?: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  images?: {
    edges: Array<{
      node: {
        url: string;
        altText?: string;
      };
    }>;
  };
  variants?: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        price: {
          amount: string;
          currencyCode: string;
        };
        availableForSale?: boolean;
        quantityAvailable?: number;
        image?: {
          url: string;
        };
      };
    }>;
  };
}

export interface CollectionResponse {
  collection: {
    id: string;
    title: string;
    description?: string;
    image?: {
      url: string;
      altText?: string;
    };
    products?: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      edges: Array<{
        node: ShopifyProduct;
      }>;
      filters?: Array<{
        id: string;
        label: string;
        type: string;
        values: Array<{
          id: string;
          label: string;
          count: number;
          input: string;
        }>;
      }>;
    };
  };
}

export const shopifyApi = {
  /**
   * Get collection by ID
   */
  getCollectionById: async (collectionId: string) => {
    try {
      const response = await client.post('', {
        query: GET_COLLECTION_BY_ID_QUERY,
        variables: { id: collectionId },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        return null;
      }

      return response.data.data.collection;
    } catch (error) {
      console.error('Error fetching collection:', error);
      return null;
    }
  },

  /**
   * Get products by collection ID with pagination, sorting and filtering
   */
  getProductsByCollection: async (
    collectionId: string,
    first: number = 20,
    after: string | null = null,
    sortKey?: string | null,
    reverse: boolean = false,
    filters: any[] = []
  ) => {
    try {
      console.log('[shopifyApi] Fetching products for:', collectionId, { sortKey, reverse, filters });

      // If filters is empty, send null/undefined to avoid strict API checks if any
      const queryFilters = filters && filters.length > 0 ? filters : null;

      const variables: any = {
        id: collectionId,
        first,
        after,
        reverse,
        filters: queryFilters,
      };
      
      // Only include sortKey if provided (allows Shopify to use collection's default sort)
      if (sortKey) {
        variables.sortKey = sortKey;
      }

      const response = await client.post('', {
        query: GET_PRODUCTS_BY_COLLECTION_QUERY,
        variables,
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', JSON.stringify(response.data.errors));
        return null;
      }

      const collection = response.data.data.collection as CollectionResponse['collection'];
      if (!collection) {
        console.log('[shopifyApi] No collection found or response invalid for ID:', collectionId);
      } else {
        console.log('[shopifyApi] Success. Found products:', collection.products?.edges.length);
      }

      return collection;
    } catch (error) {
      console.error('Error fetching products by collection:', error);
      return null;
    }
  },

  /**
   * Get product by handle
   */
  getProductByHandle: async (handle: string): Promise<ShopifyProduct | null> => {
    try {
      const response = await client.post('', {
        query: GET_PRODUCT_BY_HANDLE_QUERY,
        variables: { handle },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        return null;
      }

      return response.data.data.product;
    } catch (error) {
      console.error('Error fetching product by handle:', error);
      return null;
    }
  },


  /**
   * Get product by ID
   */
  getProductById: async (id: string): Promise<ShopifyProduct | null> => {
    try {
      const response = await client.post('', {
        query: GET_PRODUCT_BY_ID_QUERY,
        variables: { id },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        return null;
      }

      return response.data.data.product;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      return null;
    }
  },

  /**
   * Get product recommendations
   */
  getProductRecommendations: async (productId: string): Promise<ShopifyProduct[]> => {
    try {
      const response = await client.post('', {
        query: GET_PRODUCT_RECOMMENDATIONS_QUERY,
        variables: { productId },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        return [];
      }

      return response.data.data.productRecommendations || [];
    } catch (error) {
      console.error('Error fetching product recommendations:', error);
      return [];
    }
  },

  /**
   * Get customer orders
   */
  getCustomerOrders: async (customerAccessToken: string, first: number = 10) => {
    try {
      const response = await client.post('', {
        query: GET_CUSTOMER_ORDERS_QUERY,
        variables: { customerAccessToken, first },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        return null;
      }

      return response.data.data.customer?.orders;
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      return null;
    }
  },

  /**
   * Get order by ID (Using Node interface)
   */
  getOrderById: async (id: string) => {
    try {
      const response = await client.post('', {
        query: GET_ORDER_BY_ID_QUERY,
        variables: { id },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        return null;
      }

      return response.data.data.node;
    } catch (error) {
      console.error('Error fetching order by ID:', error);
      return null;
    }
  },

  /**
   * Search products
   */
  searchProducts: async (query: string, first: number = 20) => {
    try {
      const response = await client.post('', {
        query: GET_PRODUCTS_QUERY,
        variables: { query, first },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        return [];
      }

      return response.data.data.products.edges.map((edge: any) => edge.node);
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  },

  /**
   * Apply discount codes to cart
   */
  applyDiscountCodes: async (cartId: string, discountCodes: string[]) => {
    try {
      const response = await client.post('', {
        query: CART_DISCOUNT_CODES_UPDATE_MUTATION,
        variables: {
          cartId,
          discountCodes: discountCodes.map(code => code.toUpperCase()),
        },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        throw new Error(response.data.errors[0]?.message || 'Failed to apply discount codes');
      }

      const result = response.data.data.cartDiscountCodesUpdate;

      if (result.userErrors && result.userErrors.length > 0) {
        const error = result.userErrors[0];
        throw new Error(error.message || 'Failed to apply discount code');
      }

      return result.cart;
    } catch (error: any) {
      console.error('Error applying discount codes:', error);
      throw error;
    }
  },

  /**
   * Update cart attributes (for gifting, notes, etc.)
   */
  updateCartAttributes: async (cartId: string, attributes: { key: string; value: string }[]) => {
    try {
      const response = await client.post('', {
        query: CART_ATTRIBUTES_UPDATE_MUTATION,
        variables: {
          cartId,
          attributes,
        },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        throw new Error(response.data.errors[0]?.message || 'Failed to update cart attributes');
      }

      const result = response.data.data.cartAttributesUpdate;

      if (result.userErrors && result.userErrors.length > 0) {
        const error = result.userErrors[0];
        throw new Error(error.message || 'Failed to update cart attributes');
      }

      return result.cart;
    } catch (error: any) {
      console.error('Error updating cart attributes:', error);
      throw error;
    }
  },

  /**
   * Create a new Shopify cart.
   * Lines may include attributes (e.g. booking_date for ticketing) so they persist when cart is fetched.
   */
  createCart: async (
    lines?: Array<{ merchandiseId: string; quantity: number; attributes?: { key: string; value: string }[] }>,
    attributes?: { key: string; value: string }[]
  ) => {
    try {
      const variables: any = {
        input: {
          lines: lines || [],
        }
      };

      if (attributes) {
        variables.input.attributes = attributes;
      }

      const response = await client.post('', {
        query: CART_CREATE_MUTATION,
        variables,
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        throw new Error(response.data.errors[0]?.message || 'Failed to create cart');
      }

      const result = response.data.data.cartCreate;

      if (result.userErrors && result.userErrors.length > 0) {
        const error = result.userErrors[0];
        throw new Error(error.message || 'Failed to create cart');
      }

      return result.cart;
    } catch (error: any) {
      console.error('Error creating cart:', error);
      throw error;
    }
  },

  /**
   * Add lines to cart
   */
  addLinesToCart: async (cartId: string, lines: Array<{ merchandiseId: string; quantity: number }>) => {
    try {
      const response = await client.post('', {
        query: CART_LINES_ADD_MUTATION,
        variables: {
          cartId,
          lines,
        },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        throw new Error(response.data.errors[0]?.message || 'Failed to add items to cart');
      }

      const result = response.data.data.cartLinesAdd;

      if (result.userErrors && result.userErrors.length > 0) {
        const error = result.userErrors[0];
        throw new Error(error.message || 'Failed to add items to cart');
      }

      return result.cart;
    } catch (error: any) {
      console.error('Error adding lines to cart:', error);
      throw error;
    }
  },

  /**
   * Get cart details
   */
  getCart: async (cartId: string) => {
    try {
      const response = await client.post('', {
        query: GET_CART_QUERY,
        variables: { cartId },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        const errorMessage = response.data.errors[0]?.message || 'Failed to fetch cart';
        throw new Error(errorMessage);
      }

      const cart = response.data.data.cart;
      if (!cart) {
        throw new Error('Cart not found. The cart may have expired or been deleted.');
      }

      return cart;
    } catch (error: any) {
      console.error('Error fetching cart:', error);
      // Re-throw the error with a more descriptive message
      if (error.message) {
        throw error;
      }
      throw new Error('Failed to fetch cart. Please try again.');
    }
  },

  /**
   * Get multiple variants by IDs (for cart price sync)
   * Uses Shopify's nodes query to fetch multiple variants efficiently
   */
  getVariantsByIds: async (variantIds: string[]) => {
    if (!variantIds || variantIds.length === 0) return [];

    try {
      // Shopify nodes query can fetch up to 250 nodes at once
      const GET_VARIANTS_BY_IDS_QUERY = `
        query getVariantsByIds($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              title
              price {
                amount
                currencyCode
              }
              compareAtPrice {
                amount
                currencyCode
              }
              availableForSale
              quantityAvailable
              image {
                url
              }
            }
          }
        }
      `;

      const response = await client.post('', {
        query: GET_VARIANTS_BY_IDS_QUERY,
        variables: { ids: variantIds },
      });

      if (response.data.errors) {
        console.error('Shopify API errors:', response.data.errors);
        return [];
      }

      return response.data.data.nodes || [];
    } catch (error) {
      console.error('Error fetching variants by IDs:', error);
      return [];
    }
  },

  /**
   * Create customer address
   */
  createCustomerAddress: async (customerAccessToken: string, address: any) => {
    try {
      const response = await client.post('', {
        query: CUSTOMER_ADDRESS_CREATE_MUTATION,
        variables: {
          customerAccessToken,
          address,
        },
      });

      if (response.data.data?.customerAddressCreate?.customerUserErrors?.length > 0) {
        throw new Error(response.data.data.customerAddressCreate.customerUserErrors[0].message);
      }

      return response.data.data?.customerAddressCreate?.customerAddress;
    } catch (error) {
      console.error('Error creating customer address:', error);
      throw error;
    }
  },

  /**
   * Update customer address
   */
  updateCustomerAddress: async (customerAccessToken: string, id: string, address: any) => {
    try {
      const response = await client.post('', {
        query: CUSTOMER_ADDRESS_UPDATE_MUTATION,
        variables: {
          customerAccessToken,
          id,
          address,
        },
      });

      if (response.data.data?.customerAddressUpdate?.customerUserErrors?.length > 0) {
        throw new Error(response.data.data.customerAddressUpdate.customerUserErrors[0].message);
      }

      return response.data.data?.customerAddressUpdate?.customerAddress;
    } catch (error) {
      console.error('Error updating customer address:', error);
      throw error;
    }
  },

  /**
   * Delete customer address
   */
  deleteCustomerAddress: async (customerAccessToken: string, id: string) => {
    try {
      const response = await client.post('', {
        query: CUSTOMER_ADDRESS_DELETE_MUTATION,
        variables: {
          customerAccessToken,
          id,
        },
      });

      if (response.data.data?.customerAddressDelete?.customerUserErrors?.length > 0) {
        throw new Error(response.data.data.customerAddressDelete.customerUserErrors[0].message);
      }

      return response.data.data?.customerAddressDelete?.deletedCustomerAddressId;
    } catch (error) {
      console.error('Error deleting customer address:', error);
      throw error;
    }
  },

  /**
   * Get customer addresses
   */
  getCustomerAddresses: async (customerAccessToken: string, first: number = 50) => {
    try {
      const response = await client.post('', {
        query: CUSTOMER_ADDRESSES_QUERY,
        variables: {
          customerAccessToken,
          first,
        },
      });

      return {
        addresses: response.data.data?.customer?.addresses?.edges.map((edge: any) => edge.node) || [],
        defaultAddress: response.data.data?.customer?.defaultAddress,
      };
    } catch (error) {
      console.error('Error getting customer addresses:', error);
      throw error;
    }
  },

  /**
   * Set default address
   */
  setDefaultAddress: async (customerAccessToken: string, addressId: string) => {
    try {
      const response = await client.post('', {
        query: CUSTOMER_DEFAULT_ADDRESS_UPDATE_MUTATION,
        variables: {
          customerAccessToken,
          addressId,
        },
      });

      if (response.data.data?.customerDefaultAddressUpdate?.customerUserErrors?.length > 0) {
        throw new Error(response.data.data.customerDefaultAddressUpdate.customerUserErrors[0].message);
      }

      return response.data.data?.customerDefaultAddressUpdate?.customer;
    } catch (error) {
      console.error('Error setting default address:', error);
      throw error;
    }
  },

  /**
   * Update customer information
   */
  updateCustomer: async (customerAccessToken: string, customerData: { firstName?: string; lastName?: string }) => {
    try {
      const response = await client.post('', {
        query: CUSTOMER_UPDATE_MUTATION,
        variables: {
          customerAccessToken,
          customer: customerData,
        },
      });

      if (response.data.data?.customerUpdate?.customerUserErrors?.length > 0) {
        throw new Error(response.data.data.customerUpdate.customerUserErrors[0].message);
      }

      return response.data.data?.customerUpdate?.customer;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },
};

