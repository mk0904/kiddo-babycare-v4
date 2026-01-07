// Returns Service
// Handles return requests, reason selection, and refund tracking

import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const RETURNS_STORAGE_KEY = 'kiddo_returns';

// Return reasons
export const RETURN_REASONS = [
    { id: 'wrong_size', label: 'Wrong size', icon: 'resize-outline' },
    { id: 'defective', label: 'Defective/Damaged', icon: 'alert-circle-outline' },
    { id: 'not_as_described', label: 'Not as described', icon: 'document-text-outline' },
    { id: 'wrong_item', label: 'Wrong item delivered', icon: 'swap-horizontal-outline' },
    { id: 'quality_issue', label: 'Quality not satisfactory', icon: 'star-outline' },
    { id: 'changed_mind', label: 'Changed my mind', icon: 'heart-dislike-outline' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
] as const;

export type ReturnReasonId = typeof RETURN_REASONS[number]['id'];

export type ReturnStatus =
    | 'requested'
    | 'approved'
    | 'pickup_scheduled'
    | 'picked_up'
    | 'refund_initiated'
    | 'refund_completed'
    | 'rejected';

export interface ReturnItem {
    itemId: string;
    productId: string;
    variantId: string;
    title: string;
    variantTitle?: string;
    price: number;
    quantity: number;
    image?: string;
}

export interface ReturnRequest {
    id: string;
    orderId: string;
    orderName?: string;
    items: ReturnItem[];
    reason: ReturnReasonId;
    reasonText?: string; // For "other" reason
    additionalNotes?: string;
    status: ReturnStatus;
    totalRefundAmount: number;
    currencyCode: string;

    // Dates
    createdAt: string;
    updatedAt: string;
    pickupScheduledAt?: string;
    pickedUpAt?: string;
    refundCompletedAt?: string;

    // Refund
    refundMethod?: 'original_payment' | 'store_credit';
    refundId?: string;

    // Tracking
    statusHistory: Array<{
        status: ReturnStatus;
        timestamp: string;
        message?: string;
    }>;
}

// Helper functions
const generateReturnId = (): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `RET_${timestamp}_${random}`.toUpperCase();
};

export const getReturnStatusText = (status: ReturnStatus): string => {
    const statusMap: Record<ReturnStatus, string> = {
        requested: 'Return Requested',
        approved: 'Return Approved',
        pickup_scheduled: 'Pickup Scheduled',
        picked_up: 'Item Picked Up',
        refund_initiated: 'Refund Processing',
        refund_completed: 'Refund Completed',
        rejected: 'Return Rejected',
    };
    return statusMap[status] || status;
};

export const getReturnStatusColor = (status: ReturnStatus): string => {
    const colorMap: Record<ReturnStatus, string> = {
        requested: '#FF9800',
        approved: '#2196F3',
        pickup_scheduled: '#9C27B0',
        picked_up: '#00BCD4',
        refund_initiated: '#FF5722',
        refund_completed: '#4CAF50',
        rejected: '#F44336',
    };
    return colorMap[status] || '#666';
};

// Returns Service
export const returnsService = {
    /**
     * Create a return request
     */
    createReturnRequest: async (
        orderId: string,
        orderName: string | undefined,
        items: ReturnItem[],
        reason: ReturnReasonId,
        reasonText?: string,
        additionalNotes?: string
    ): Promise<ReturnRequest> => {
        try {
            const totalRefundAmount = items.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            );

            const now = new Date().toISOString();

            const returnRequest: ReturnRequest = {
                id: generateReturnId(),
                orderId,
                orderName,
                items,
                reason,
                reasonText,
                additionalNotes,
                status: 'requested',
                totalRefundAmount,
                currencyCode: 'INR',
                createdAt: now,
                updatedAt: now,
                statusHistory: [
                    {
                        status: 'requested',
                        timestamp: now,
                        message: 'Return request submitted',
                    },
                ],
            };

            // Save to storage
            const existingReturns = await returnsService.getAllReturns();
            existingReturns.unshift(returnRequest);
            await AsyncStorage.setItem(RETURNS_STORAGE_KEY, JSON.stringify(existingReturns));

            console.log('[ReturnsService] Return request created:', returnRequest.id);
            return returnRequest;
        } catch (error: any) {
            console.error('[ReturnsService] Error creating return:', error.message);
            throw error;
        }
    },

    /**
     * Get all return requests
     */
    getAllReturns: async (): Promise<ReturnRequest[]> => {
        try {
            const data = await AsyncStorage.getItem(RETURNS_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    /**
     * Get returns by order ID
     */
    getReturnsByOrderId: async (orderId: string): Promise<ReturnRequest[]> => {
        const allReturns = await returnsService.getAllReturns();
        return allReturns.filter((r) => r.orderId === orderId);
    },

    /**
     * Get return by ID
     */
    getReturnById: async (returnId: string): Promise<ReturnRequest | null> => {
        const allReturns = await returnsService.getAllReturns();
        return allReturns.find((r) => r.id === returnId) || null;
    },

    /**
     * Update return status
     */
    updateReturnStatus: async (
        returnId: string,
        status: ReturnStatus,
        message?: string
    ): Promise<ReturnRequest | null> => {
        try {
            const allReturns = await returnsService.getAllReturns();
            const index = allReturns.findIndex((r) => r.id === returnId);
            if (index === -1) return null;

            const now = new Date().toISOString();
            const returnRequest = allReturns[index];

            returnRequest.status = status;
            returnRequest.updatedAt = now;
            returnRequest.statusHistory.push({
                status,
                timestamp: now,
                message: message || getReturnStatusText(status),
            });

            // Update specific timestamps
            if (status === 'pickup_scheduled') {
                returnRequest.pickupScheduledAt = now;
            } else if (status === 'picked_up') {
                returnRequest.pickedUpAt = now;
            } else if (status === 'refund_completed') {
                returnRequest.refundCompletedAt = now;
            }

            allReturns[index] = returnRequest;
            await AsyncStorage.setItem(RETURNS_STORAGE_KEY, JSON.stringify(allReturns));

            return returnRequest;
        } catch (error: any) {
            console.error('[ReturnsService] Error updating return:', error.message);
            return null;
        }
    },

    /**
     * Cancel a return request
     */
    cancelReturn: async (returnId: string): Promise<boolean> => {
        try {
            const allReturns = await returnsService.getAllReturns();
            const index = allReturns.findIndex((r) => r.id === returnId);
            if (index === -1) return false;

            // Can only cancel if status is 'requested' or 'approved'
            if (!['requested', 'approved'].includes(allReturns[index].status)) {
                return false;
            }

            allReturns.splice(index, 1);
            await AsyncStorage.setItem(RETURNS_STORAGE_KEY, JSON.stringify(allReturns));

            return true;
        } catch {
            return false;
        }
    },
};
