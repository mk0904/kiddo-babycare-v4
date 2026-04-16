import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

/**
 * Legacy route: order detail now lives in `orders/[id]/v2` (map, event orders, delivery parity).
 * Keeps deep links and older navigations (e.g. order-success/index) on the same summary as post-checkout.
 */
export default function OrderDetailLegacyRedirect() {
    const { id } = useLocalSearchParams<{ id?: string | string[] }>();
    const idStr = typeof id === 'string' ? id : Array.isArray(id) ? (id[0] ?? '') : '';
    if (!idStr.trim()) {
        return <Redirect href="/orders" />;
    }
    return <Redirect href={{ pathname: '/orders/[id]/v2', params: { id: idStr } } as any} />;
}
