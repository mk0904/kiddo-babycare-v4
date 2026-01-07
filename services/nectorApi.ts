// Nector API Service
import axios from 'axios';
import {
    NECTOR_READ_ONLY_API_KEY,
    NECTOR_WORKSPACE_ID,
    NECTOR_BASE_URL,
    NECTOR_LEAD_ID,
} from '../config/nector';

const client = axios.create({
    baseURL: NECTOR_BASE_URL,
    timeout: 15000,
    headers: {
        'x-source': 'web',
        'x-apikey': NECTOR_READ_ONLY_API_KEY,
        'x-workspaceid': NECTOR_WORKSPACE_ID,
        'Content-Type': 'application/json',
    },
});

export const nectorApi = {
    /**
     * Get lead by customer_id
     * @param {string} customerId - Shopify customer ID (e.g., shopify-9699698639137)
     * @returns {Promise<Object>} Lead details with available points
     */
    async getLeadByCustomerId(customerId: string) {
        try {
            const response = await client.get(`/leads/${NECTOR_LEAD_ID}`, {
                params: {
                    customer_id: customerId,
                },
            });

            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get wallet transactions for a lead
     * @param {string} leadId - Lead ID
     * @returns {Promise<Object>} Transaction history
     */
    async getWalletTransactions(leadId: string) {
        try {
            // Create a separate request with mobile source header
            const response = await axios.get(`${NECTOR_BASE_URL}/wallettransactions`, {
                params: {
                    lead_id: leadId,
                },
                headers: {
                    'x-source': 'mobile',
                    'x-apikey': NECTOR_READ_ONLY_API_KEY,
                    'x-workspaceid': NECTOR_WORKSPACE_ID,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            });

            return response.data;
        } catch (error) {
            throw error;
        }
    },
};

export default nectorApi;
