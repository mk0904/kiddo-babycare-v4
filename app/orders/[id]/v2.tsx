import {
    DARK_STORE_LOCATION,
    DEFAULT_ETA_MINUTES,
    geocodeAddress,
    getDeliveryEta,
    getDeliveryEtaForAddress,
} from '@/config/deliveryConfig';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
    getDeliveryPartnerOrderStatus,
    getDeliveryRouteForOrder,
    subscribeToDeliveryTracking,
    type DeliveryTrackingMessage,
} from '@/services/deliveryPartnerService';
import { shopifyAdminApi } from '@/services/shopifyAdminApi';
import { shopifyApi } from '@/services/shopifyApi';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { AnimatedRegion, Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const HEADER_BG = '#FFFFFF';
const CARD_RADIUS = 12;
const TRACKING_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#ECEFF3' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ECEFF3' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#DDE3EA' }] },
];

function shippingAddressString(address: any): string {
    if (!address) return '';
    return [
        address.address1,
        address.address2,
        address.city,
        address.province,
        address.zip,
        address.country,
    ]
        .filter(Boolean)
        .join(', ')
        .trim();
}

function trackingTimestampMs(value: string | number | null | undefined): number | null {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 1_000_000_000_000 ? value : value * 1000;
    }
    const parsed = new Date(String(value)).getTime();
    return Number.isNaN(parsed) ? null : parsed;
}

// Same images as GiftWrappingModal – used for gift wrap line items on order detail
const GIFT_WRAP_IMAGES: Record<string, any> = {
    'Wrap-1': require('@/assets/images/giftwrap1.jpeg'),
    'Wrap-2': require('@/assets/images/giftwrap2.jpeg'),
    'Wrap-3': require('@/assets/images/giftwrap3.jpeg'),
};
function getGiftWrapImageSource(title: string): any {
    if (!title || typeof title !== 'string') return null;
    const match = title.match(/Wrap-[123]/);
    return match ? GIFT_WRAP_IMAGES[match[0]] ?? GIFT_WRAP_IMAGES['Wrap-1'] : (/gift wrap/i.test(title) ? GIFT_WRAP_IMAGES['Wrap-1'] : null);
}

function looksLikeTicketingDate(s: string): boolean {
    if (!s || typeof s !== 'string') return false;
    const month =
        '(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)';
    const ordinal = '(?:st|nd|rd|th)?';
    const day = '(?:[0-3]?\\d)';
    if (new RegExp(`\\b${day}${ordinal}\\s+${month}\\b`, 'i').test(s)) return true;
    if (new RegExp(`\\b${month}\\s+${day}${ordinal}\\b`, 'i').test(s)) return true;
    return false;
}

function isTicketingLineItem(node: any): boolean {
    const itemTitle = node?.title || '';
    const variantTitle = node?.variant?.title || '';
    const attrs = node?.customAttributes || [];
    if (attrs.some((a: any) => a.key === 'booking_date' || a.key === 'booking_date_display')) return true;
    if (looksLikeTicketingDate(variantTitle)) return true;
    if (/(event|workshop|playhouse|petting|farm|ticket|zoo)/i.test(String(itemTitle))) return true;
    return false;
}

function isOnlyTicketingOrder(o: any): boolean {
    const edges = o?.lineItems?.edges || [];
    if (edges.length === 0) return false;
    return edges.every((edge: any) => isTicketingLineItem(edge?.node));
}

function getBookingDateDisplay(node: any): string | null {
    const attrs = node?.customAttributes || [];
    const display = attrs.find((a: any) => a.key === 'booking_date_display')?.value;
    const raw = attrs.find((a: any) => a.key === 'booking_date')?.value;
    if (display) return display;
    if (raw) return new Date(raw).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return null;
}

const DELIVERY_STATUS_LABELS: Record<string, string> = {
    placed: 'Placed',
    confirmed: 'Confirmed',
    packing: 'Packing',
    packed: 'Packed',
    rider_assigned: 'Rider Assigned',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    return_requested: 'Return Requested',
    returned: 'Returned',
};

const DELIVERY_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    placed: { bg: '#FFF4E5', text: '#B45309' },
    confirmed: { bg: '#E8F1FF', text: '#1D4ED8' },
    packing: { bg: '#F3E8FF', text: '#7E22CE' },
    packed: { bg: '#EDE9FE', text: '#6D28D9' },
    rider_assigned: { bg: '#ECFEFF', text: '#0F766E' },
    out_for_delivery: { bg: '#E0F2FE', text: '#0369A1' },
    delivered: { bg: '#ECFDF3', text: '#15803D' },
    cancelled: { bg: '#FEF2F2', text: '#B91C1C' },
    return_requested: { bg: '#FFF7ED', text: '#C2410C' },
    returned: { bg: '#F5F3FF', text: '#6B21A8' },
};

export default function OrderDetailV2Screen() {
    const { id, estimatedDeliveryMinutes: paramEta, from } = useLocalSearchParams<{ id: string; estimatedDeliveryMinutes?: string; from?: string }>();
    const router = useRouter();
    const goBack = () => (from === 'orders' ? router.back() : router.replace('/(tabs)'));
    const { user } = useAuth();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchedEtaMinutes, setFetchedEtaMinutes] = useState<number | null>(null);
    const [liveEtaMinutes, setLiveEtaMinutes] = useState<number | null>(null);
    const [deliveryPartnerStatus, setDeliveryPartnerStatus] = useState<{
        shopifyOrderId: string;
        status: string;
        deliveryPartner: { name: string | null; contact: string | null };
    } | null>(null);
    const [destinationCoords, setDestinationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [riderCoords, setRiderCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [trackingConnected, setTrackingConnected] = useState(false);
    const [riderOnline, setRiderOnline] = useState(false);
    const [trackingNote, setTrackingNote] = useState<string | null>(null);
    const [trackingUpdatedAt, setTrackingUpdatedAt] = useState<number | null>(null);
    const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[] | null>(null);
    const trackingMapRef = useRef<MapView | null>(null);
    const deliveryRouteFetchGen = useRef(0);
    const riderAnimatedCoord = useRef(
        new AnimatedRegion({
            latitude: DARK_STORE_LOCATION.latitude,
            longitude: DARK_STORE_LOCATION.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        }),
    ).current;
    const liveEtaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const liveEtaLastRunRef = useRef<number>(0);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!id || typeof id !== 'string') {
                setLoading(false);
                setError('Invalid order ID');
                return;
            }
            try {
                let orderId = decodeURIComponent(id).trim();
                const baseId = orderId.includes('?') ? orderId.split('?')[0] : orderId;
                const queryPart = orderId.includes('?') ? orderId.split('?')[1] : '';
                const isDraftOrder = baseId.startsWith('gid://shopify/DraftOrder/');

                let fetchedOrder: any = null;
                if (user?.customerAccessToken && !isDraftOrder) {
                    try {
                        const customerOrders = await shopifyApi.getCustomerOrders(user.customerAccessToken, 50);
                        const numericId = baseId.split('/').pop()?.split('?')[0];
                        const found = customerOrders?.edges?.map((e: any) => e.node).find((o: any) => {
                            const n = (o.id || '').split('/').pop()?.split('?')[0];
                            return n === numericId || o.id === orderId;
                        });
                        if (found) orderId = found.id;
                    } catch (_) { }
                }

                if (isDraftOrder || orderId.startsWith('gid://shopify/DraftOrder/')) {
                    const draft = await shopifyAdminApi.getDraftOrder(orderId);
                    if (draft) {
                        const draftAny = draft as any;
                        fetchedOrder = {
                            id: draft.id,
                            orderNumber: draft.name,
                            processedAt: draftAny.createdAt,
                            createdAt: draftAny.createdAt,
                            lineItems: {
                                edges: draft.lineItems.edges.map((e: any) => ({
                                    node: {
                                        title: e.node.title,
                                        quantity: e.node.quantity,
                                        originalTotalPrice: { amount: (parseFloat(e.node.originalUnitPrice) * e.node.quantity).toString() },
                                        price: { amount: e.node.originalUnitPrice },
                                        variant: { title: e.node.variant?.title || 'Default Title', image: e.node.variant?.image },
                                    },
                                })),
                            },
                            shippingAddress: draftAny.shippingAddress,
                            subtotalPrice: { amount: draftAny.subtotalPrice ?? '0' },
                            totalShippingPrice: { amount: draftAny.totalShippingPrice ?? '0' },
                            totalTax: { amount: draftAny.totalTax ?? '0' },
                            currentTotalPrice: { amount: draftAny.totalPrice ?? draftAny.subtotalPrice ?? '0' },
                        };
                    }
                } else {
                    fetchedOrder = await shopifyApi.getOrderById(orderId);
                    if (!fetchedOrder && queryPart) {
                        fetchedOrder = await shopifyApi.getOrderById(orderId.split('?')[0]);
                    }
                }

                if (fetchedOrder) {
                    setOrder(fetchedOrder);
                    setError(null);
                } else {
                    setError('Order not found');
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load order');
            }
            setLoading(false);
        };
        fetchOrder();
    }, [id, user?.customerAccessToken]);

    // Fetch delivery duration (minutes) to shipping address; "Arriving by" = order placed time + this duration
    useEffect(() => {
        if (!order?.shippingAddress) {
            setFetchedEtaMinutes(null);
            return;
        }
        const addr = order.shippingAddress;
        const addressString = [addr.address1, addr.address2, addr.city, addr.province, addr.zip, addr.country]
            .filter(Boolean)
            .join(', ')
            .trim();
        if (!addressString) {
            setFetchedEtaMinutes(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const deliveryTime = await getDeliveryEtaForAddress(addressString);
                if (cancelled || deliveryTime == null) {
                    setFetchedEtaMinutes(null);
                    return;
                }
                if (!cancelled) setFetchedEtaMinutes(deliveryTime);
            } catch (e) {
                if (!cancelled) setFetchedEtaMinutes(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [order?.id, order?.shippingAddress?.address1, order?.shippingAddress?.city, order?.shippingAddress?.zip]);

    useEffect(() => {
        const address = shippingAddressString(order?.shippingAddress);
        if (!address) {
            setDestinationCoords(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const coords = await geocodeAddress(address);
                if (!cancelled) setDestinationCoords(coords);
            } catch {
                if (!cancelled) setDestinationCoords(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [order?.shippingAddress?.address1, order?.shippingAddress?.address2, order?.shippingAddress?.city, order?.shippingAddress?.province, order?.shippingAddress?.zip, order?.shippingAddress?.country]);

    useEffect(() => {
        const statusKey = String(deliveryPartnerStatus?.status ?? '').trim().toLowerCase();
        const canUseLiveEta =
            ['rider_assigned', 'out_for_delivery'].includes(statusKey) && !!destinationCoords && !!riderCoords;
        if (!canUseLiveEta) {
            setLiveEtaMinutes(null);
            if (liveEtaTimerRef.current) {
                clearTimeout(liveEtaTimerRef.current);
                liveEtaTimerRef.current = null;
            }
            return;
        }

        let cancelled = false;
        const now = Date.now();
        const elapsed = now - liveEtaLastRunRef.current;
        const waitMs = Math.max(0, 8000 - elapsed);

        if (liveEtaTimerRef.current) {
            clearTimeout(liveEtaTimerRef.current);
        }

        liveEtaTimerRef.current = setTimeout(() => {
            void (async () => {
                const eta = await getDeliveryEta(destinationCoords.latitude, destinationCoords.longitude, {
                    originLatitude: riderCoords.latitude,
                    originLongitude: riderCoords.longitude,
                });
                if (cancelled) return;
                liveEtaLastRunRef.current = Date.now();
                setLiveEtaMinutes(eta?.etaMinutes ?? null);
            })();
        }, waitMs);

        return () => {
            cancelled = true;
            if (liveEtaTimerRef.current) {
                clearTimeout(liveEtaTimerRef.current);
                liveEtaTimerRef.current = null;
            }
        };
    }, [deliveryPartnerStatus?.status, destinationCoords, riderCoords?.latitude, riderCoords?.longitude]);

    useEffect(() => {
        const rawOrderId = String(order?.id ?? '').trim();
        if (!rawOrderId || !rawOrderId.includes('/Order/')) {
            setDeliveryPartnerStatus(null);
            return;
        }

        const shopifyOrderId = rawOrderId.split('/').pop()?.split('?')[0]?.trim() || '';
        if (!shopifyOrderId) {
            setDeliveryPartnerStatus(null);
            return;
        }

        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const TERMINAL_DELIVERY_POLL_STATUSES = new Set(['delivered', 'cancelled', 'returned']);

        const pollDeliveryStatus = async () => {
            const result = await getDeliveryPartnerOrderStatus(shopifyOrderId);
            if (cancelled) return;

            setDeliveryPartnerStatus(result);

            const statusKey = String(result?.status ?? '').trim().toLowerCase();
            if (TERMINAL_DELIVERY_POLL_STATUSES.has(statusKey) && intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        pollDeliveryStatus();
        intervalId = setInterval(pollDeliveryStatus, 60 * 1000);

        return () => {
            cancelled = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, [order?.id]);

    useEffect(() => {
        const rawOrderId = String(order?.id ?? '').trim();
        const shopifyOrderId = rawOrderId.includes('/Order/')
            ? rawOrderId.split('/').pop()?.split('?')[0]?.trim() || ''
            : '';
        const token = String(user?.customerAccessToken ?? user?.accessToken ?? '').trim();
        const statusKey = String(deliveryPartnerStatus?.status ?? '').trim().toLowerCase();
        const shouldTrack = !!shopifyOrderId && !!token && ['rider_assigned', 'out_for_delivery'].includes(statusKey);

        if (!shouldTrack) {
            setTrackingConnected(false);
            return;
        }

        let cancelled = false;
        let reconnectDelay = 1000;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let unsubscribe: (() => void) | null = null;

        const applyTrackingMessage = (message: DeliveryTrackingMessage) => {
            if (cancelled) return;
            switch (message.type) {
                case 'location':
                case 'rider_online': {
                    const lat = typeof message.lat === 'number' ? message.lat : null;
                    const lng = typeof message.lng === 'number' ? message.lng : null;
                    const ts = trackingTimestampMs(message.timestamp);
                    setRiderOnline(message.type === 'location' ? message.riderOnline !== false : true);
                    if (lat != null && lng != null) {
                        setRiderCoords({ latitude: lat, longitude: lng });
                        (riderAnimatedCoord as any).timing({
                            latitude: lat,
                            longitude: lng,
                            duration: 2000,
                            useNativeDriver: false,
                        }).start();
                    }
                    if (ts != null) setTrackingUpdatedAt(ts);
                    setTrackingNote(null);
                    return;
                }
                case 'rider_offline':
                    setRiderOnline(false);
                    setTrackingNote('Locating rider...');
                    return;
                case 'order_delivered':
                    setRiderOnline(false);
                    setTrackingConnected(false);
                    setTrackingNote('Order delivered');
                    return;
                case 'rider_assigned':
                    setTrackingNote('Rider assigned. Waiting for live location...');
                    return;
                default:
                    return;
            }
        };

        const connect = () => {
            if (cancelled) return;
            unsubscribe = subscribeToDeliveryTracking(shopifyOrderId, token, {
                onOpen: () => {
                    if (cancelled) return;
                    reconnectDelay = 1000;
                    setTrackingConnected(true);
                },
                onClose: () => {
                    if (cancelled) return;
                    setTrackingConnected(false);
                    reconnectTimer = setTimeout(connect, reconnectDelay);
                    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
                },
                onError: () => {
                    if (cancelled) return;
                    setTrackingConnected(false);
                },
                onMessage: applyTrackingMessage,
            });
        };

        connect();

        return () => {
            cancelled = true;
            if (unsubscribe) unsubscribe();
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, [order?.id, user?.customerAccessToken, user?.accessToken, deliveryPartnerStatus?.status, riderAnimatedCoord]);

    useEffect(() => {
        const rawOrderId = String(order?.id ?? '').trim();
        const shopifyOrderId = rawOrderId.includes('/Order/')
            ? rawOrderId.split('/').pop()?.split('?')[0]?.trim() || ''
            : '';
        const token = String(user?.customerAccessToken ?? user?.accessToken ?? '').trim();
        const statusKey = String(deliveryPartnerStatus?.status ?? '').trim().toLowerCase();
        if (!shopifyOrderId || !token || !['rider_assigned', 'out_for_delivery'].includes(statusKey)) {
            setRouteCoordinates(null);
            return;
        }

        const fetchGen = ++deliveryRouteFetchGen.current;
        let cancelled = false;
        const timer = setTimeout(() => {
            void (async () => {
                const res = await getDeliveryRouteForOrder(
                    shopifyOrderId,
                    token,
                    riderCoords
                        ? { latitude: riderCoords.latitude, longitude: riderCoords.longitude }
                        : null,
                );
                if (cancelled || fetchGen !== deliveryRouteFetchGen.current) return;
                if (res?.coordinates && res.coordinates.length >= 2) {
                    setRouteCoordinates(res.coordinates);
                } else {
                    setRouteCoordinates(null);
                }
            })();
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [order?.id, user?.customerAccessToken, user?.accessToken, deliveryPartnerStatus?.status, riderCoords?.latitude, riderCoords?.longitude]);

    const copyOrderId = async () => {
        const oid = order?.orderNumber || order?.id?.split('/').pop() || id;
        try {
            await Share.share({ message: `Order ID: ${oid}` });
        } catch (_) {
            Alert.alert('Order ID', String(oid));
        }
    };

    const addressLine = order?.shippingAddress
        ? [order.shippingAddress.address1, order.shippingAddress.address2].filter(Boolean).join(', ') || 'Address'
        : '—';

    const etaMinutes = liveEtaMinutes ?? fetchedEtaMinutes ?? (Number(paramEta ?? order?.estimatedDeliveryMinutes ?? DEFAULT_ETA_MINUTES) || DEFAULT_ETA_MINUTES);
    const orderPlacedAt = order?.processedAt || order?.createdAt;
    const baseTime = orderPlacedAt ? new Date(orderPlacedAt) : new Date();
    const deliveryByDate = new Date(baseTime.getTime() + etaMinutes * 60 * 1000);
    const h = deliveryByDate.getHours();
    const m = deliveryByDate.getMinutes();
    const hour12 = h % 12 || 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    const timeStr = `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
    const dateStr = deliveryByDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const deliveryByTimeStr = `${timeStr}, ${dateStr}`;
    const isDelivered = order?.fulfillmentStatus === 'FULFILLED';
    const hasArrivalTimePassed = deliveryByDate.getTime() < Date.now();
    const deliveryStatusKey = String(deliveryPartnerStatus?.status ?? '').trim().toLowerCase();

    const headerStatusText = (() => {
        if (hasArrivalTimePassed) {
            const arrivedDateStr = deliveryByDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
            return `Arrived at ${timeStr}, ${arrivedDateStr}`;
        }
        if (isDelivered) return `Delivered by ${deliveryByTimeStr}`;
        if (
            liveEtaMinutes != null &&
            riderCoords &&
            ['rider_assigned', 'out_for_delivery'].includes(deliveryStatusKey)
        ) {
            const mins = Math.max(1, Math.round(liveEtaMinutes));
            const liveArrival = new Date(Date.now() + mins * 60 * 1000);
            const lh = liveArrival.getHours();
            const lm = liveArrival.getMinutes();
            const liveHour12 = lh % 12 || 12;
            const liveAmpm = lh < 12 ? 'AM' : 'PM';
            const liveClock = `${liveHour12}:${lm.toString().padStart(2, '0')}${liveAmpm}`;
            const liveDateShort = liveArrival.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            return `Arriving by ${liveClock}, ${liveDateShort} · ${mins} min (live)`;
        }
        return `Arriving by ${deliveryByTimeStr}`;
    })();
    const deliveryStatusLabel = DELIVERY_STATUS_LABELS[deliveryStatusKey] ?? (deliveryPartnerStatus?.status ? String(deliveryPartnerStatus.status).replace(/_/g, ' ') : '');
    const deliveryStatusColors = DELIVERY_STATUS_COLORS[deliveryStatusKey] ?? { bg: '#F3F4F6', text: '#374151' };
    const shouldShowAssignSoonMessage = ['placed', 'confirmed', 'packing', 'packed'].includes(deliveryStatusKey);
    const shouldShowDeliveryPartnerDetails =
        ['rider_assigned', 'out_for_delivery'].includes(deliveryStatusKey) &&
        !!deliveryPartnerStatus?.deliveryPartner &&
        !!(deliveryPartnerStatus.deliveryPartner.name || deliveryPartnerStatus.deliveryPartner.contact);
    const handleDeliveryPartnerCall = async () => {
        const phone = String(deliveryPartnerStatus?.deliveryPartner?.contact ?? '').trim();
        if (!phone) return;
        try {
            await Linking.openURL(`tel:${phone}`);
        } catch (_) {
            Alert.alert('Contact', phone);
        }
    };
    const shouldShowTrackingMap =
        ['rider_assigned', 'out_for_delivery'].includes(deliveryStatusKey) &&
        !!destinationCoords;
    const mapRegion: Region | null = useMemo(() => {
        if (!destinationCoords) return null;
        const riderLat = riderCoords?.latitude ?? DARK_STORE_LOCATION.latitude;
        const riderLng = riderCoords?.longitude ?? DARK_STORE_LOCATION.longitude;
        const minLat = Math.min(destinationCoords.latitude, riderLat);
        const maxLat = Math.max(destinationCoords.latitude, riderLat);
        const minLng = Math.min(destinationCoords.longitude, riderLng);
        const maxLng = Math.max(destinationCoords.longitude, riderLng);
        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.8),
            longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.8),
        };
    }, [destinationCoords, riderCoords]);
    const trackingPathFallback = useMemo(() => {
        if (!destinationCoords) return [];
        return riderCoords
            ? [DARK_STORE_LOCATION, riderCoords, destinationCoords]
            : [DARK_STORE_LOCATION, destinationCoords];
    }, [destinationCoords, riderCoords]);

    const trackingPolylineCoordinates = useMemo(() => {
        if (routeCoordinates && routeCoordinates.length >= 2) return routeCoordinates;
        return trackingPathFallback;
    }, [routeCoordinates, trackingPathFallback]);

    useEffect(() => {
        if (trackingPolylineCoordinates.length < 2) return;
        const map = trackingMapRef.current;
        if (!map) return;
        requestAnimationFrame(() => {
            map.fitToCoordinates(trackingPolylineCoordinates, {
                edgePadding: { top: 28, right: 28, bottom: 28, left: 28 },
                animated: true,
            });
        });
    }, [trackingPolylineCoordinates]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading order...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !order) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={12}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <View style={styles.loadingWrap}>
                    <Text style={styles.errorText}>{error || 'Order not found'}</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={goBack}>
                        <Text style={styles.primaryButtonText}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const displayOrderId = order.orderNumber || order.id?.split('/').pop() || id;

    const formatCurrency = (amount: number) =>
        `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    // Coupon/discount from Shopify order (discountApplications + customAttributes fallback)
    const discountEdges = order.discountApplications?.edges ?? [];
    const orderDiscounts = Array.isArray(discountEdges) ? discountEdges : [];
    type DiscountNode = { code?: string; title?: string; applicable?: boolean; value?: { amount?: string } };
    const discountNodes: DiscountNode[] = orderDiscounts.map((e: any) => e?.node ?? e).filter(Boolean);
    const appliedCouponNode = discountNodes.find((n) => (n.applicable === undefined || n.applicable !== false) && (n.code ?? n.title));
    const couponFromApi = appliedCouponNode?.code ?? appliedCouponNode?.title ?? null;
    const customAttrs = (order.customAttributes ?? []) as { key?: string; value?: string }[];
    const couponFromAttrs = customAttrs.find((a) => {
        const k = (a?.key ?? '').toLowerCase();
        return k === 'discount_code' || k === 'coupon_code' || k === 'applied_discount_code' || k === 'coupon';
    })?.value;
    const couponCode = (couponFromApi ?? couponFromAttrs ?? null) ? String(couponFromApi ?? couponFromAttrs).trim() : null;
    const couponValue = appliedCouponNode?.value?.amount != null ? parseFloat(appliedCouponNode.value.amount) : 0;

    // Subtotal = sum of line items' original total (before order-level discount). Matches Shopify admin "Subtotal".
    const calculatedSubtotal = (order.lineItems?.edges || []).reduce((sum: number, edge: any) => {
        const item = edge.node;
        const lineTotal = parseFloat(item.originalTotalPrice?.amount || '0');
        const unitPrice = parseFloat(item.price?.amount || '0');
        const qty = item.quantity || 1;
        return sum + (lineTotal || unitPrice * qty);
    }, 0);
    const shipping = parseFloat(order.totalShippingPrice?.amount || order.totalShippingPriceV2?.amount || order.shippingPrice?.amount || '0');
    const tax = parseFloat(order.totalTax?.amount || order.totalTaxV2?.amount || order.taxPrice?.amount || '0');
    const total = parseFloat(order.currentTotalPrice?.amount || order.currentTotalPriceV2?.amount || order.totalPrice?.amount || order.totalPriceV2?.amount || '0');
    // Use calculated subtotal for bill display so discount math matches Shopify (subtotal − discount = total before tax/shipping).
    const subtotalDisplay = calculatedSubtotal > 0 ? calculatedSubtotal : parseFloat(order.subtotalPrice?.amount || order.subtotalPriceV2?.amount || '0');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header - light beige */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={12}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Order Summary</Text>
                </View>
                {!!deliveryStatusLabel && (
                    <View style={[styles.headerStatusPill, { backgroundColor: deliveryStatusColors.bg }]}>
                        <Text style={[styles.headerStatusText, { color: deliveryStatusColors.text }]}>
                            {deliveryStatusLabel}
                        </Text>
                    </View>
                )}
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Order detail banner image from app-config (orderDetail.imageUrl) */}
                {/* {(() => {
                    const orderDetailConfig = appConfigService.getOrderDetailConfig();
                    const imageUrl = orderDetailConfig?.imageUrl;
                    if (!imageUrl) return null;
                    return (
                        <View style={styles.orderDetailImageWrap}>
                            <Image source={{ uri: imageUrl }} style={styles.orderDetailImage} contentFit="cover" />
                        </View>
                    );
                })()} */}

                {shouldShowTrackingMap && mapRegion ? (
                    <View style={styles.trackingWrap}>
                        <View style={styles.trackingMapFrame}>
                            <MapView
                                ref={trackingMapRef}
                                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                                style={styles.trackingMap}
                                initialRegion={mapRegion}
                                customMapStyle={TRACKING_MAP_STYLE}
                                scrollEnabled={false}
                                zoomEnabled={false}
                                rotateEnabled={false}
                                pitchEnabled={false}
                                showsCompass={false}
                                showsBuildings={false}
                                showsTraffic={false}
                                toolbarEnabled={false}
                            >
                                {trackingPolylineCoordinates.length >= 2 ? (
                                    <Polyline
                                        coordinates={trackingPolylineCoordinates}
                                        strokeColor="#2563EB"
                                        strokeWidth={5}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                ) : null}
                                <Marker coordinate={DARK_STORE_LOCATION} title="Dark store" anchor={{ x: 0.5, y: 1 }}>
                                    <View style={styles.storeMarker}>
                                        <View style={styles.storeMarkerInner}>
                                            <Ionicons name="home" size={16} color="#B45309" />
                                        </View>
                                    </View>
                                </Marker>
                                <Marker coordinate={destinationCoords!} title="Delivery address" anchor={{ x: 0.5, y: 1 }}>
                                    <View style={styles.destinationMarker}>
                                        <Ionicons name="bag-handle" size={17} color="#FFFFFF" />
                                    </View>
                                </Marker>
                                {riderCoords ? (
                                    <Marker.Animated coordinate={riderAnimatedCoord as any} title="Rider" anchor={{ x: 0.5, y: 0.5 }}>
                                        <View style={styles.riderMarker}>
                                            <Ionicons name="bicycle" size={18} color="#111827" />
                                        </View>
                                    </Marker.Animated>
                                ) : null}
                            </MapView>
                            <TouchableOpacity style={styles.mapFloatingButton} activeOpacity={0.85}>
                                <Ionicons name="expand-outline" size={18} color="#111827" />
                            </TouchableOpacity>
                        </View>
                       
                    </View>
                ) : null}

                {shouldShowAssignSoonMessage && (
                    <View style={styles.deliveryPartnerCard}>
                        <View style={styles.deliveryPartnerContent}>
                            <View style={styles.deliveryPartnerAvatar}>
                                <Ionicons name="time-outline" size={26} color="#8B5E00" />
                            </View>
                            <View style={styles.deliveryPartnerTextWrap}>
                                <Text style={styles.deliveryPartnerIntro}>Your delivery partner will be assigned soon</Text>
                                <Text style={styles.deliveryPartnerPendingText}>We will share the rider details here shortly</Text>
                            </View>
                            <View style={styles.deliveryPartnerPendingBadge}>
                                <Ionicons name="hourglass-outline" size={18} color="#9CA3AF" />
                            </View>
                        </View>
                    </View>
                )}

                {shouldShowDeliveryPartnerDetails && (
                    <View style={styles.deliveryPartnerCard}>
                        <View style={styles.deliveryPartnerContent}>
                            <View style={styles.deliveryPartnerAvatar}>
                                    <Image
                                        source={require('@/assets/icons/partnerIcon.png')}
                                        style={styles.deliveryPartnerAvatarImage}
                                        contentFit="cover"
                                    />
                                
                            </View>
                            <View style={styles.deliveryPartnerTextWrap}>
                                <Text style={styles.deliveryPartnerIntro}>
                                    {`I'm ${deliveryPartnerStatus.deliveryPartner.name || 'your delivery partner'}, your delivery partner`}
                                </Text>
                                <Text style={styles.deliveryPartnerContactText}>
                                    I have picked up your order, and I am on the way
                                </Text>
                            </View>
                            {!!deliveryPartnerStatus.deliveryPartner.contact && (
                                <TouchableOpacity
                                    style={styles.deliveryPartnerCallButton}
                                    onPress={handleDeliveryPartnerCall}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Call ${deliveryPartnerStatus.deliveryPartner.name || 'delivery partner'}`}
                                >
                                    <Ionicons name="call" size={20} color="#16A34A" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Line items – single card like cart */}
                <View style={styles.orderItemsSection}>
                    {/* Order summary header */}
                    <View style={styles.summaryRow}>
                        <Text style={styles.sectionTitle}>Order Items</Text>
                        <TouchableOpacity style={styles.orderIdRow} onPress={copyOrderId}>
                            <Text style={styles.orderIdText}>Order ID #{displayOrderId}</Text>
                            <Ionicons name="copy-outline" size={18} color="#717680" style={styles.copyIcon} />
                        </TouchableOpacity>
                    </View>
                    {(order.lineItems?.edges || []).map((edge: any, index: number) => {
                        const item = edge.node;
                        const price = parseFloat(item.originalTotalPrice?.amount || item.price?.amount || '0');
                        const variantTitle = item.variant?.title && item.variant.title !== 'Default Title' ? item.variant.title : null;
                        const giftWrapImage = getGiftWrapImageSource(item.title);
                        const imageSource = item.variant?.image?.url
                            ? { uri: item.variant.image.url }
                            : giftWrapImage
                                ? giftWrapImage
                                : null;
                        const edges = order.lineItems?.edges || [];
                        const isLast = index === edges.length - 1;
                        return (
                            <View key={`${item.title}-${index}`} style={[styles.itemRow, isLast && styles.itemRowLast]}>
                                {imageSource ? (
                                    <Image source={imageSource} style={styles.itemImage} contentFit="cover" />
                                ) : (
                                    <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                                        <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                                    </View>
                                )}
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                                    <View style={styles.itemMetaRow}>
                                        <View style={styles.itemMetaWrap}>
                                            <Text style={styles.itemMetaPrice}>
                                                ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </Text>
                                            {variantTitle ? <Text style={styles.itemMeta}>Size: {variantTitle}</Text> : null}
                                        </View>
                                        <Text style={styles.itemQty}>QTY:{item.quantity || 1}</Text>
                                    </View>
                                    {(() => {
                                        const bookingDate = getBookingDateDisplay(item);
                                        if (!bookingDate) return null;
                                        return (
                                            <View style={styles.bookingDateRow}>
                                                <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                                                <Text style={styles.bookingDateText}>Booked for: {bookingDate}</Text>
                                            </View>
                                        );
                                    })()}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Bill details – subtotal = items before discount; discount = derived or from API; total = order total */}
                {(() => {
                    const discountAmount = Math.max(0, subtotalDisplay + shipping + tax - total);
                    const isHeyKiddo = couponCode?.toUpperCase() === 'HEYKIDDO';
                    const displayDiscount = isHeyKiddo ? 0 : (couponValue > 0 ? couponValue : discountAmount);
                    return (
                        <View style={styles.billCard}>
                            <Text style={styles.billTitle}>Bill details</Text>
                            <View style={styles.billRow}>
                                <Text style={styles.billLabel}>Subtotal</Text>
                                <Text style={styles.billValue}>{formatCurrency(subtotalDisplay)}</Text>
                            </View>
                            {(displayDiscount > 0 || couponCode) && (
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>
                                        {couponCode ? `Coupon (${couponCode})` : 'Discount'}
                                    </Text>
                                    <Text style={[styles.billValue, (displayDiscount > 0 || (couponValue > 0 && !isHeyKiddo) || isHeyKiddo) && styles.billDiscountValue]}>
                                        {isHeyKiddo ? 'Free Shoe' : (displayDiscount > 0 ? `-${formatCurrency(displayDiscount)}` : formatCurrency(0))}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.billDivider} />
                            <View style={styles.billRow}>
                                <Text style={styles.billTotalLabel}>Total</Text>
                                <Text style={styles.billTotalValue}>{formatCurrency(total)}</Text>
                            </View>
                        </View>
                    );
                })()}

                {/* Payment method */}
                <View style={styles.paymentMethodCard}>
                    <Text style={styles.billTitle}>Payment method</Text>
                    <Text style={styles.paymentMethodLabel}>
                        {order?.financialStatus === 'PAID'
                            ? 'Paid online'
                            : order?.financialStatus === 'PENDING'
                                ? 'Cash on Delivery (COD)'
                                : order?.financialStatus === 'REFUNDED'
                                    ? 'Refunded'
                                    : order?.financialStatus
                                        ? `Payment: ${order.financialStatus}`
                                        : '—'}
                    </Text>
                </View>

                {/* Delivery address – hide when order has only ticketing products */}
                {order?.shippingAddress && !isOnlyTicketingOrder(order) && (
                    <View style={styles.addressCard}>
                        <Text style={styles.billTitle}>Order Details</Text>

                        {/* Status and address below bill details */}
                        <View style={styles.belowBillSection}>
                            <Text style={styles.belowBillTitle}>{headerStatusText}</Text>
                        </View>
                        <Text style={styles.billTitle}>Delivery address</Text>
                        <View style={styles.addressBlock}>
                            {[
                                order.shippingAddress.firstName || order.shippingAddress.lastName
                                    ? [order.shippingAddress.firstName, order.shippingAddress.lastName].filter(Boolean).join(' ').replace(/_+$/, '')
                                    : null,
                                order.shippingAddress.address1,
                                order.shippingAddress.address2,
                                [order.shippingAddress.city, order.shippingAddress.province].filter(Boolean).join(', '),
                                order.shippingAddress.zip,
                                order.shippingAddress.country,
                            ]
                                .filter(Boolean)
                                .map((line, i) => (
                                    <Text key={i} style={styles.addressLine}>
                                        {line}
                                    </Text>
                                ))}
                        </View>
                        
                    </View>
                )}



                {/* <NeedHelpChatCard onCallPress={openSupportCall} /> */}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 20,
        paddingTop: Platform.OS === 'ios' ? 14 : 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F0E8',
    },
    backBtn: {
        padding: 4,
        marginRight: 12,
    },
    headerCenter: {
        flex: 1,
    },
    headerTitle: {
        fontSize: Fonts.LargeFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#1A1A1A',
    },
    headerStatusPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        marginLeft: 12,
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: 150,
    },
    headerStatusText: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
        textAlign: 'center',
    },
    headerAddress: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
        marginTop: 4,
    },
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
    },
    errorText: {
        fontSize: 15,
        fontFamily: Fonts.Medium,
        color: '#374151',
        textAlign: 'center',
    },
    scroll: {
        flex: 1,
        backgroundColor: '#FDF6EC',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 100,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        padding: 16,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
            android: { elevation: 2 },
        }),
    },
    helpIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    helpTextWrap: {
        flex: 1,
    },
    helpTitle: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    helpSub: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
        marginTop: 2,
    },
    chatLink: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    mapPlaceholder: {
        height: 180,
        backgroundColor: '#E5E7EB',
        borderRadius: CARD_RADIUS,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapPlaceholderText: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#9CA3AF',
        marginTop: 8,
    },
    orderDetailImageWrap: {
        marginBottom: 12,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        backgroundColor: '#F3F4F6',
    },
    orderDetailImage: {
        width: '100%',
        aspectRatio: 2,
        minHeight: 120,
    },
    deliveryIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    deliveryText: {
        flex: 1,
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#717680',
    },
    orderIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        color: '#717680',
    },
    orderIdText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendRegular,
        color: '#717680',
    },
    copyIcon: {
        marginLeft: 6,
    },
    orderItemsSection: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        paddingHorizontal: 12,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    itemRowLast: {
        marginBottom: 0,
    },
    itemImage: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        marginRight: 12,
    },
    itemImagePlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
        minWidth: 0,
    },
    itemMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    itemTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
        lineHeight: 20,
    },
    itemMetaWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    itemMetaPrice: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#414651',
    },
    itemMeta: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
    },
    itemQty: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#717680',
    },
    bookingDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    bookingDateText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: Colors.primary,
    },
    footerSpacer: {
        height: 32,
    },
    belowBillSection: {

        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        marginBottom: 16,
    },
    belowBillTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#1A1A1A',
    },
    belowBillAddress: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
        marginTop: 4,
    },
    paymentMethodCard: {
        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        marginBottom: 16,
        padding: 12,
    },
    paymentMethodLabel: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
    },
    billCard: {
        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        marginBottom: 16,
        marginTop: 16,
        padding: 12,
    },
    billTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#717680',
        marginBottom: 8,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    billLabel: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
    },
    billValue: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendRegular,
        color: '#181D27',
    },
    billDiscountValue: {
        color: '#099250',
    },
    billDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 8,
    },
    billTotalLabel: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#1A1A1A',
    },
    billTotalValue: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#1A1A1A',
    },
    addressCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        marginTop: 0,
        padding: 12,
    },
    addressBlock: {
        marginTop: 0,
        fontFamily: Fonts.LexendRegular,
    },
    addressLine: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
        lineHeight: 22,
    },
    trackingWrap: {
        marginTop: 0,
        borderRadius: 14,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    trackingHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
    },
    trackingTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
    },
    trackingStatusPill: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    trackingStatusText: {
        fontSize: 11,
        fontFamily: Fonts.SemiBold,
    },
    trackingMap: {
        width: '100%',
        height: 220,
    },
    trackingMapFrame: {
        position: 'relative',
    },
    mapFloatingButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    storeMarker: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#D1D5DB',
    },
    storeMarkerInner: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    destinationMarker: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    riderMarker: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FACC15',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    trackingCaption: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
    },
    deliveryPartnerCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        padding: 14,
    },
    deliveryPartnerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deliveryPartnerAvatar: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    
    deliveryPartnerAvatarImage: {
        width: '100%',
        height: '100%',
    },
    deliveryPartnerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    deliveryPartnerIntro: {
        fontSize: Fonts.SmallFontSize,
        lineHeight: 20,
        fontFamily: Fonts.LexendBold,
        color: '#414651',
    },
    deliveryPartnerContactText: {
        marginTop: 4,
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#717680',
    },
    deliveryPartnerCallButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        marginLeft: 12,
    },
    deliveryPartnerPendingBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        marginLeft: 12,
    },
    deliveryPartnerPendingText: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
        marginTop: 4,
    },
    primaryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#fff',
    },
});
