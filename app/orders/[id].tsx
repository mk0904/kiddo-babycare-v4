import { NeedHelpChatCard } from '@/components/orders/NeedHelpChatCard';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { shopifyAdminApi } from '@/services/shopifyAdminApi';
import { shopifyApi } from '@/services/shopifyApi';
import { storefrontVariantImageUrl } from '@/utils/storefrontVariantImage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OrderDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrder = async (retryCount = 0) => {
            if (!id || typeof id !== 'string') {
                setLoading(false);
                setError('Invalid order ID');
                return;
            }

            try {
                // Decode the ID if it was URL encoded
                let decodedId = decodeURIComponent(id);
                console.log('[OrderDetails] Fetching order with ID:', decodedId);
                console.log('[OrderDetails] ID type:', typeof decodedId, 'Length:', decodedId.length);
                
                // Ensure ID is in GraphQL format (gid://shopify/Order/...)
                let orderId = decodedId.trim();
                
                // Handle IDs with query parameters (e.g., "gid://shopify/Order/6951949828385?key=034783923121d5774f2bf4ef6e5289d1")
                // Shopify sometimes returns order IDs with query params for security/access control
                // We need to preserve the query parameter as Shopify API might require it
                const hasQueryParam = orderId.includes('?');
                const queryPart = hasQueryParam ? orderId.split('?')[1] : '';
                const baseId = hasQueryParam ? orderId.split('?')[0] : orderId;
                
                console.log('[OrderDetails] Base ID:', baseId);
                if (hasQueryParam) {
                    console.log('[OrderDetails] Query parameter detected:', queryPart);
                }
                
                // Check if it's a DraftOrder ID (Try & Buy orders)
                const isDraftOrder = baseId.startsWith('gid://shopify/DraftOrder/');
                
                // Check if it's already in GraphQL format
                if (baseId.startsWith('gid://shopify/Order/')) {
                    console.log('[OrderDetails] ID is already in GraphQL Order format');
                    // Use the ID as-is, preserving query params
                    orderId = id.trim();
                } else if (isDraftOrder) {
                    // It's a DraftOrder ID - Try & Buy orders use draft orders
                    console.log('[OrderDetails] ID is a DraftOrder (Try & Buy)');
                    // Keep the draft order ID as-is
                    orderId = baseId;
                } else if (baseId.startsWith('gid://shopify/')) {
                    // It's a GraphQL ID but might be for a different type
                    console.log('[OrderDetails] ID is GraphQL format but might be wrong type:', baseId);
                    // Try to extract the numeric part
                    const numericMatch = baseId.match(/Order\/(\d+)/);
                    if (numericMatch) {
                        orderId = `gid://shopify/Order/${numericMatch[1]}`;
                        if (queryPart) {
                            orderId = `${orderId}?${queryPart}`;
                        }
                        console.log('[OrderDetails] Converted to Order format:', orderId);
                    } else {
                        // Try to extract any numeric ID
                        const anyNumericMatch = baseId.match(/\d+/);
                        if (anyNumericMatch) {
                            orderId = `gid://shopify/Order/${anyNumericMatch[0]}`;
                            if (queryPart) {
                                orderId = `${orderId}?${queryPart}`;
                            }
                            console.log('[OrderDetails] Extracted numeric ID and converted:', orderId);
                        }
                    }
                } else if (/^\d+$/.test(baseId)) {
                    // It's just a numeric ID, convert to GraphQL format
                    orderId = `gid://shopify/Order/${baseId}`;
                    if (queryPart) {
                        orderId = `${orderId}?${queryPart}`;
                    }
                    console.log('[OrderDetails] Converted numeric ID to GraphQL format:', orderId);
                } else {
                    // Try to extract numeric ID from various formats (e.g., "ORD-123456" or "order_123456")
                    const numericMatch = baseId.match(/\d+/);
                    if (numericMatch) {
                        orderId = `gid://shopify/Order/${numericMatch[0]}`;
                        if (queryPart) {
                            orderId = `${orderId}?${queryPart}`;
                        }
                        console.log('[OrderDetails] Extracted and converted ID:', orderId);
                    } else {
                        console.error('[OrderDetails] Could not parse order ID format:', baseId);
                        setError(`Invalid order ID format: ${baseId}`);
                        setLoading(false);
                        return;
                    }
                }

                // OPTIMIZATION: Try customer orders list FIRST (faster and more reliable for new orders)
                // Then fetch full details via node query
                let fetchedOrder: any = null;
                let orderIdToFetch: string = orderId;
                
                if (user?.customerAccessToken && retryCount === 0) {
                    console.log('[OrderDetails] Trying customer orders list first (faster for new orders)...');
                    try {
                        const customerOrders = await shopifyApi.getCustomerOrders(user.customerAccessToken, 50);
                        if (customerOrders?.edges && customerOrders.edges.length > 0) {
                            const allOrders = customerOrders.edges.map((edge: any) => edge.node);
                            
                            // Extract numeric ID from baseId for comparison
                            const numericId = baseId.split('/').pop()?.split('?')[0];
                            
                            // Try to find by ID (with or without query params)
                            const foundOrder = allOrders.find((o: any) => {
                                const orderIdStr = o.id || '';
                                const orderNumericId = orderIdStr.split('/').pop()?.split('?')[0];
                                
                                // Match by full ID, base ID, or numeric ID
                                return orderIdStr === orderId || 
                                       orderIdStr === baseId || 
                                       orderIdStr.includes(numericId || '') ||
                                       orderNumericId === numericId;
                            });
                            
                            if (foundOrder) {
                                console.log('[OrderDetails] ✅ Found order in customer orders list:', foundOrder.orderNumber);
                                // Use the order ID from the found order to fetch full details
                                orderIdToFetch = foundOrder.id;
                            }
                        }
                    } catch (ordersError: any) {
                        console.error('[OrderDetails] Error fetching customer orders:', ordersError.message);
                    }
                }
                
                // Check if we're dealing with a DraftOrder (Try & Buy)
                if (isDraftOrder || orderIdToFetch.startsWith('gid://shopify/DraftOrder/')) {
                    console.log('[OrderDetails] Fetching draft order (Try & Buy)...');
                    const draftOrder = await shopifyAdminApi.getDraftOrder(orderIdToFetch);
                    if (draftOrder) {
                        // Transform draft order to match order format
                        fetchedOrder = {
                            id: draftOrder.id,
                            orderNumber: draftOrder.name,
                            processedAt: draftOrder.createdAt,
                            financialStatus: 'PENDING',
                            fulfillmentStatus: 'UNFULFILLED',
                            lineItems: {
                                edges: draftOrder.lineItems.edges.map((edge: any) => ({
                                    node: {
                                        title: edge.node.title,
                                        quantity: edge.node.quantity,
                                        originalTotalPrice: {
                                            amount: (parseFloat(edge.node.originalUnitPrice) * edge.node.quantity).toString()
                                        },
                                        price: {
                                            amount: edge.node.originalUnitPrice
                                        },
                                        customAttributes: edge.node.customAttributes || [],
                                        variant: {
                                            title: edge.node.variant?.title || 'Default Title',
                                            image: edge.node.variant?.image,
                                            product: edge.node.variant?.product,
                                        }
                                    }
                                }))
                            },
                            currentTotalPrice: {
                                amount: draftOrder.totalPrice,
                                currencyCode: draftOrder.currencyCode
                            },
                            subtotalPrice: {
                                amount: draftOrder.subtotalPrice,
                                currencyCode: draftOrder.currencyCode
                            },
                            totalShippingPrice: {
                                amount: '0',
                                currencyCode: draftOrder.currencyCode
                            },
                            totalTax: {
                                amount: '0',
                                currencyCode: draftOrder.currencyCode
                            },
                            shippingAddress: draftOrder.shippingAddress,
                            tags: draftOrder.tags || []
                        };
                        console.log('[OrderDetails] ✅ Draft order fetched and transformed');
                    }
                } else {
                    // Fetch full order details via node query (has all price breakdown)
                    console.log('[OrderDetails] Calling shopifyApi.getOrderById with:', orderIdToFetch);
                    fetchedOrder = await shopifyApi.getOrderById(orderIdToFetch);
                    
                    // If that fails and we have query params, try with just the base ID
                    if (!fetchedOrder && hasQueryParam) {
                        const baseOrderId = orderIdToFetch.split('?')[0];
                        console.log('[OrderDetails] Retrying with base ID (without query params):', baseOrderId);
                        fetchedOrder = await shopifyApi.getOrderById(baseOrderId);
                    }
                }
                
                if (fetchedOrder) {
                    console.log('[OrderDetails] Order fetched successfully:', {
                        orderNumber: fetchedOrder.orderNumber,
                        id: fetchedOrder.id,
                        currentTotalPrice: fetchedOrder.currentTotalPrice?.amount,
                        subtotalPrice: fetchedOrder.subtotalPrice?.amount,
                        totalShippingPrice: fetchedOrder.totalShippingPrice?.amount,
                        totalTax: fetchedOrder.totalTax?.amount,
                        lineItemsCount: fetchedOrder.lineItems?.edges?.length || 0,
                    });
                    
                    // Log full order structure for debugging
                    console.log('[OrderDetails] Full order structure:', JSON.stringify(fetchedOrder, null, 2));
                    
                    setOrder(fetchedOrder);
                    setError(null);
                    setLoading(false);
                } else {
                    // Order might still be processing, retry with longer delays
                    // Shopify can take 10-30 seconds to process and associate orders
                    if (retryCount < 5) {
                        const delaySeconds = [3, 5, 8, 10, 15][retryCount]; // Longer delays: 3s, 5s, 8s, 10s, 15s
                        console.log(`[OrderDetails] Order not found, retrying in ${delaySeconds}s... (attempt ${retryCount + 1}/5)`);
                        setTimeout(() => {
                            fetchOrder(retryCount + 1);
                        }, delaySeconds * 1000);
                        return; // Don't set loading to false yet
                    } else {
                        console.error('[OrderDetails] Order not found after 5 retries');
                        console.error('[OrderDetails] Original ID:', id);
                        console.error('[OrderDetails] Converted ID:', orderId);
                        console.error('[OrderDetails] Base ID:', baseId);
                        console.error('[OrderDetails] This might mean:');
                        console.error('  1. Order is still processing (can take up to 30 seconds)');
                        console.error('  2. Order ID format is incorrect');
                        console.error('  3. Order does not exist or was not created');
                        console.error('  4. Customer access token might be missing');
                        setError('Order not found. The order may still be processing. Please wait a few moments and check your orders list, or try again later.');
                        setLoading(false);
                    }
                }
            } catch (err: any) {
                console.error('[OrderDetails] Error fetching order details:', err);
                console.error('[OrderDetails] Error details:', {
                    message: err.message,
                    stack: err.stack,
                    id: id,
                    retryCount,
                });
                
                // Retry on network errors
                if (retryCount < 2 && (err.message?.includes('network') || err.message?.includes('timeout') || err.message?.includes('fetch'))) {
                    console.log(`[OrderDetails] Network error, retrying in ${2 * (retryCount + 1)}s... (attempt ${retryCount + 1}/2)`);
                    setTimeout(() => {
                        fetchOrder(retryCount + 1);
                    }, 2000 * (retryCount + 1));
                    return;
                }
                
                setError('Failed to load order details. Please check your connection and try again.');
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id, user?.customerAccessToken]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const looksLikeTicketingDate = (value: string) => {
        const s = String(value || '').trim();
        if (!s) return false;
        const lower = s.toLowerCase();
        if (lower === 'default' || lower === 'default title') return false;
        if (/\d{4}-\d{2}-\d{2}/.test(lower)) return true;

        const month =
            '(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)';
        const ordinal = '(?:st|nd|rd|th)?';
        const day = '(?:[0-3]?\\d)';
        if (new RegExp(`\\b${day}${ordinal}\\s+${month}\\b`, 'i').test(s)) return true;
        if (new RegExp(`\\b${month}\\s+${day}${ordinal}\\b`, 'i').test(s)) return true;
        return false;
    };

    const isTicketingOrder = (o: any): boolean => {
        const edges = o?.lineItems?.edges || [];
        return edges.some((edge: any) => {
            const itemTitle = edge?.node?.title || '';
            const variantTitle = edge?.node?.variant?.title || '';
            // Has booking_date in customAttributes = definitely Events/Playhouses/Petting Farms
            const attrs = edge?.node?.customAttributes || [];
            if (attrs.some((a: any) => a.key === 'booking_date' || a.key === 'booking_date_display')) return true;
            if (looksLikeTicketingDate(variantTitle)) return true;
            if (/(event|workshop|playhouse|petting|farm|ticket|zoo)/i.test(String(itemTitle))) return true;
            return false;
        });
    };

    const ticketing = isTicketingOrder(order);
    // For Events, Playhouses, Petting Farms - always show "Booked"
    const showBooked = ticketing;

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <ScreenHeader title="Order Details" showSearch={false} showBack={true} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading order details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !order) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <ScreenHeader title="Order Details" showSearch={false} showBack={true} />
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={Colors.textSecondary} />
                    <Text style={styles.errorText}>{error || 'Order not found'}</Text>
                    <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 20 }} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <ScreenHeader title={`Order #${order.orderNumber}`} showSearch={false} showBack={true} />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            <NeedHelpChatCard onChatPress={() => { /* TODO: open chat / support */ }} />

            {/* Status Section */}
            <View style={styles.statusCard}>
                <View style={styles.statusHeader}>
                    <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                    <Text style={styles.statusTitle}>Order Confirmed</Text>
                </View>
                <View style={styles.statusRow}>
                    <Text style={styles.label}>Placed on</Text>
                    <Text style={styles.value}>{order.processedAt ? formatDate(order.processedAt) : 'N/A'}</Text>
                </View>
                <View style={styles.statusRow}>
                    <Text style={styles.label}>Payment Status</Text>
                    <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.badgeText, { color: Colors.success }]}>
                            {order.financialStatus === 'PAID' ? 'Paid' : order.financialStatus || 'Pending'}
                        </Text>
                    </View>
                </View>
                <View style={styles.statusRow}>
                    <Text style={styles.label}>Fulfillment Status</Text>
                    <View style={[styles.badge, { backgroundColor: '#FFF5F4' }]}>
                        <Text style={[styles.badgeText, { color: Colors.primary }]}>
                            {showBooked
                                ? 'Booked'
                                : order.fulfillmentStatus === 'FULFILLED'
                                  ? 'Shipped'
                                  : order.fulfillmentStatus || 'Pending'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Items Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Items</Text>
                {order.lineItems?.edges?.map((edge: any, index: number) => {
                    const item = edge.node;
                    const lineImg = storefrontVariantImageUrl(item.variant);
                    return (
                        <View key={item.title + item.variant?.title} style={[styles.itemCard, index === (order.lineItems?.edges?.length || 1) - 1 && styles.lastItem]}>
                            <View style={styles.imageContainer}>
                                {lineImg ? (
                                    <Image source={{ uri: lineImg }} style={styles.itemImage} />
                                ) : (
                                    <View style={styles.placeholderImage}>
                                        <Ionicons name="image-outline" size={24} color={Colors.textSecondary} />
                                    </View>
                                )}
                            </View>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                                {item.variant?.title && item.variant.title !== 'Default Title' && (
                                    <Text style={styles.variantTitle}>{item.variant.title}</Text>
                                )}
                                {(() => {
                                    const bookingAttr = item.customAttributes?.find((a: any) => a.key === 'booking_date_display');
                                    const bookingDate = bookingAttr?.value || item.customAttributes?.find((a: any) => a.key === 'booking_date')?.value;
                                    if (bookingDate) {
                                        return (
                                            <View style={styles.bookingDateRow}>
                                                <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                                                <Text style={styles.bookingDateText}>Booked for: {bookingDate}</Text>
                                            </View>
                                        );
                                    }
                                    return null;
                                })()}
                                <View style={styles.itemPriceRow}>
                                    <View style={styles.quantityBadge}>
                                        <Text style={styles.itemQuantity}>Qty: {item.quantity || 1}</Text>
                                    </View>
                                    <Text style={styles.itemPrice}>
                                        ₹{parseFloat(item.originalTotalPrice?.amount || item.price?.amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    );
                }) || (
                    <Text style={styles.emptyText}>No items found</Text>
                )}
            </View>

            {/* Price Breakdown */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment Summary</Text>
                {(() => {
                    // Calculate subtotal from line items if not available
                    const calculatedSubtotal = order.lineItems?.edges?.reduce((sum: number, edge: any) => {
                        const item = edge.node;
                        const itemPrice = parseFloat(item.originalTotalPrice?.amount || item.price?.amount || item.variant?.price?.amount || '0');
                        return sum + (itemPrice * (item.quantity || 1));
                    }, 0) || 0;
                    
                    // Get prices from order object with fallbacks
                    const subtotal = parseFloat(order.subtotalPrice?.amount || order.subtotalPriceV2?.amount || calculatedSubtotal.toString() || '0');
                    const shipping = parseFloat(order.totalShippingPrice?.amount || order.totalShippingPriceV2?.amount || order.shippingPrice?.amount || '0');
                    const tax = parseFloat(order.totalTax?.amount || order.totalTaxV2?.amount || order.taxPrice?.amount || '0');
                    const total = parseFloat(order.currentTotalPrice?.amount || order.currentTotalPriceV2?.amount || order.totalPrice?.amount || order.totalPriceV2?.amount || (subtotal + shipping + tax).toString() || '0');
                    
                    return (
                        <>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Subtotal</Text>
                                <Text style={styles.priceValue}>
                                    ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Shipping</Text>
                                <Text style={styles.priceValue}>
                                    ₹{shipping.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Tax</Text>
                                <Text style={styles.priceValue}>
                                    ₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.priceRow}>
                                <Text style={styles.totalLabel}>Total</Text>
                                <Text style={styles.totalValue}>
                                    ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                        </>
                    );
                })()}
            </View>

            {/* Shipping Address */}
            {order.shippingAddress && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Shipping Address</Text>
                    <View style={styles.addressCard}>
                        <Ionicons name="location" size={20} color={Colors.primary} />
                        <View style={styles.addressContent}>
                            {order.shippingAddress.firstName && (
                                <Text style={styles.addressName}>
                                    {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                                </Text>
                            )}
                            <Text style={styles.addressText}>{order.shippingAddress.address1}</Text>
                            {order.shippingAddress.address2 && (
                                <Text style={styles.addressText}>{order.shippingAddress.address2}</Text>
                            )}
                            <Text style={styles.addressText}>
                                {order.shippingAddress.city && `${order.shippingAddress.city}, `}
                                {order.shippingAddress.province && `${order.shippingAddress.province} `}
                                {order.shippingAddress.zip}
                            </Text>
                            {order.shippingAddress.country && (
                                <Text style={styles.addressText}>{order.shippingAddress.country}</Text>
                            )}
                            {order.shippingAddress.phone && (
                                <Text style={styles.addressPhone}>{order.shippingAddress.phone}</Text>
                            )}
                        </View>
                    </View>
                </View>
            )}

            {/* Order Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Actions</Text>

                {/* Try & Buy - Only show for fulfilled Fashion orders */}
                {order.fulfillmentStatus === 'FULFILLED' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonWithBorder]}
                        onPress={() => router.push({ pathname: '/try-and-buy/[id]', params: { id: order.id } } as any)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="cube-outline" size={20} color={Colors.primary} />
                        <Text style={styles.actionButtonText}>Track Try & Buy Order</Text>
                        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                )}

                {/* Return Request - Only show for delivered orders */}
                {order.fulfillmentStatus === 'FULFILLED' && order.financialStatus === 'PAID' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonWithBorder]}
                        onPress={() => router.push({ pathname: '/returns/request', params: { orderId: order.id } } as any)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="return-down-back-outline" size={20} color={Colors.primary} />
                        <Text style={styles.actionButtonText}>Request Return</Text>
                        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                )}

                {/* View Returns - Link to returns list */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push('/returns' as any)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="list-outline" size={20} color={Colors.primary} />
                    <Text style={styles.actionButtonText}>View My Returns</Text>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Button
                    title="Continue Shopping"
                    onPress={() => router.navigate('/')}
                    variant="primary"
                    style={styles.continueButton}
                />
            </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        fontFamily: Fonts.Medium,
        color: Colors.text,
        marginTop: 16,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
        textAlign: 'center',
        padding: 20,
    },
    statusCard: {
        backgroundColor: Colors.backgroundWhite,
        marginHorizontal: 20,
        marginTop: 16,
        borderRadius: 16,
        padding: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        marginLeft: 8,
    },
    section: {
        backgroundColor: Colors.backgroundWhite,
        marginHorizontal: 20,
        marginTop: 12,
        borderRadius: 16,
        padding: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
            },
            android: {
                elevation: 1,
            },
        }),
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        marginBottom: 16,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    label: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
    },
    value: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.text,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
    },
    itemCard: {
        flexDirection: 'row',
        paddingBottom: 16,
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    lastItem: {
        borderBottomWidth: 0,
        marginBottom: 0,
        paddingBottom: 0,
    },
    imageContainer: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: Colors.grey,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    itemImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    itemTitle: {
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
        marginBottom: 4,
    },
    variantTitle: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
        marginBottom: 8,
    },
    bookingDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    bookingDateText: {
        fontSize: 13,
        fontFamily: Fonts.Medium,
        color: Colors.primary,
    },
    itemPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    quantityBadge: {
        backgroundColor: Colors.backgroundSecondary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    itemQuantity: {
        fontSize: 12,
        fontFamily: Fonts.Medium,
        color: Colors.primary,
    },
    itemPrice: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    priceLabel: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
    },
    priceValue: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 12,
    },
    totalLabel: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    totalValue: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.primary,
    },
    addressCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: Colors.grey,
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    addressContent: {
        marginLeft: 12,
        flex: 1,
    },
    addressName: {
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
        marginBottom: 4,
    },
    addressText: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.text,
        lineHeight: 20,
        marginBottom: 2,
    },
    addressPhone: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.primary,
        marginTop: 4,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 4,
    },
    actionButtonWithBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        marginBottom: 0,
    },
    actionButtonText: {
        flex: 1,
        fontSize: 15,
        fontFamily: Fonts.Medium,
        color: Colors.text,
        marginLeft: 12,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },
    continueButton: {
        width: '100%',
    },
});
