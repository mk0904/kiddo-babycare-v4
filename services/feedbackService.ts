import AsyncStorage from '@react-native-async-storage/async-storage';

const FEEDBACK_STORAGE_KEY = 'kiddo_feedback_submitted';
const FEEDBACK_DISMISSAL_KEY = 'kiddo_feedback_dismissed';

export interface FeedbackSubmission {
    orderId: string;
    rating: number;
    comment?: string;
    submittedAt: string;
}

export interface FeedbackDismissal {
    orderId: string;
    dismissedAt: string;
}

/**
 * Feedback Service
 * Manages tracking of submitted feedback and dismissed prompts
 */
export const feedbackService = {
    /**
     * Check if feedback has been submitted for an order
     */
    hasSubmittedFeedback: async (orderId: string): Promise<boolean> => {
        try {
            const data = await AsyncStorage.getItem(FEEDBACK_STORAGE_KEY);
            if (!data) return false;

            const submissions: FeedbackSubmission[] = JSON.parse(data);
            return submissions.some((sub) => sub.orderId === orderId);
        } catch (error) {
            console.error('[FeedbackService] Error checking feedback:', error);
            return false;
        }
    },

    /**
     * Check if feedback prompt has been dismissed for an order
     */
    hasDismissedFeedback: async (orderId: string): Promise<boolean> => {
        try {
            const data = await AsyncStorage.getItem(FEEDBACK_DISMISSAL_KEY);
            if (!data) return false;

            const dismissals: FeedbackDismissal[] = JSON.parse(data);
            return dismissals.some((d) => d.orderId === orderId);
        } catch (error) {
            console.error('[FeedbackService] Error checking dismissal:', error);
            return false;
        }
    },

    /**
     * Record feedback submission
     */
    submitFeedback: async (orderId: string, rating: number, comment?: string): Promise<void> => {
        try {
            const data = await AsyncStorage.getItem(FEEDBACK_STORAGE_KEY);
            const submissions: FeedbackSubmission[] = data ? JSON.parse(data) : [];

            submissions.push({
                orderId,
                rating,
                comment,
                submittedAt: new Date().toISOString(),
            });

            await AsyncStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(submissions));
            console.log('[FeedbackService] Feedback submitted for order:', orderId);
        } catch (error) {
            console.error('[FeedbackService] Error submitting feedback:', error);
            throw error;
        }
    },

    /**
     * Dismiss feedback prompt for an order
     */
    dismissFeedback: async (orderId: string): Promise<void> => {
        try {
            const data = await AsyncStorage.getItem(FEEDBACK_DISMISSAL_KEY);
            const dismissals: FeedbackDismissal[] = data ? JSON.parse(data) : [];

            dismissals.push({
                orderId,
                dismissedAt: new Date().toISOString(),
            });

            await AsyncStorage.setItem(FEEDBACK_DISMISSAL_KEY, JSON.stringify(dismissals));
            console.log('[FeedbackService] Feedback dismissed for order:', orderId);
        } catch (error) {
            console.error('[FeedbackService] Error dismissing feedback:', error);
        }
    },

    /**
     * Get orders that need feedback (delivered but not submitted/dismissed)
     */
    getOrdersNeedingFeedback: async (orders: any[]): Promise<any[]> => {
        try {
            const needingFeedback: any[] = [];

            for (const order of orders) {
                const orderId = order.id || order.orderNumber;
                if (!orderId) continue;

                // Check if order is delivered
                const isDelivered = 
                    order.fulfillmentStatus === 'FULFILLED' ||
                    order.localOrderData?.status === 'delivered' ||
                    order.status === 'delivered';

                if (!isDelivered) continue;

                // Check if feedback already submitted
                const hasSubmitted = await feedbackService.hasSubmittedFeedback(orderId);
                if (hasSubmitted) continue;

                // Check if feedback already dismissed
                const hasDismissed = await feedbackService.hasDismissedFeedback(orderId);
                if (hasDismissed) continue;

                // Check if delivered within last 7 days
                const deliveredAt = order.deliveredAt || order.localOrderData?.deliveredAt;
                if (deliveredAt) {
                    const deliveryDate = new Date(deliveredAt);
                    const now = new Date();
                    const daysSinceDelivery = (now.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);
                    
                    if (daysSinceDelivery > 7) continue; // Only show for orders delivered in last 7 days
                }

                needingFeedback.push(order);
            }

            // Sort by delivery date (most recent first)
            needingFeedback.sort((a, b) => {
                const dateA = new Date(a.deliveredAt || a.localOrderData?.deliveredAt || 0).getTime();
                const dateB = new Date(b.deliveredAt || b.localOrderData?.deliveredAt || 0).getTime();
                return dateB - dateA;
            });

            return needingFeedback;
        } catch (error) {
            console.error('[FeedbackService] Error getting orders needing feedback:', error);
            return [];
        }
    },
};
