import axios from 'axios';
import { getBackendApiPath, getBackendAuthHeaders } from './backendBase';

export interface InitiateTopupResponse {
    id?: string;
    razorpay_order_id?: string;
}

/**
 * Initiates a wallet topup with the backend and returns the transaction ID and Razorpay Order ID.
 */
export async function initiateTopup(amount: number, customerId: string, customerContact: string): Promise<InitiateTopupResponse> {
    const url = getBackendApiPath('wallet/topup/initiate');
    const payload = {
        amount,
        customer_id: customerId || 'guest',
        customer_contact: customerContact || '+910000000000',
        metadata: {}
    };

    console.log('[WalletService] initiateTopup request:', { url, payload });
    try {
        const { data } = await axios.post<InitiateTopupResponse>(url, payload, {
            timeout: 30000,
            headers: getBackendAuthHeaders({ 'Content-Type': 'application/json' }),
        });
        console.log('[WalletService] initiateTopup response:', data);
        return data;
    } catch (err: any) {
        const msg =
            err.response?.data?.error ??
            err.response?.data?.message ??
            (typeof err.response?.data === 'string' ? err.response.data : null) ??
            err.message;
        throw new Error(msg || 'Failed to initiate wallet topup');
    }
}

export const walletService = {
    initiateTopup,
};
