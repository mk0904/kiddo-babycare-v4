import {
    DARK_STORE_LOCATION,
    DEFAULT_ETA_MINUTES,
    geocodeAddress,
    getDeliveryEta,
} from '@/config/deliveryConfig';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { appConfigService } from '@/services/appConfigService';
import {
    getDeliveryPartnerOrderStatus,
    getDeliveryRouteForOrder,
    type DeliveryPartnerOrderStatus,
} from '@/services/deliveryPartnerService';
import { shopifyAdminApi } from '@/services/shopifyAdminApi';
import { shopifyApi } from '@/services/shopifyApi';
import { useUserStore } from '@/store/userStore';
import type { OrderDetailConfig } from '@/types/appConfig';
import { sizeLabelFromVariantTitle } from '@/utils/tryAndBuyProduct';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const PARTNER_AVATAR_FALLBACK = require('@/assets/icons/partnerIcon.png');

function orderDetailPartnerAvatarSource(cfg: OrderDetailConfig | null | undefined) {
    const png = cfg?.partnerImageUrl?.trim();
    if (png) return { uri: png };
    const icon = cfg?.partnerIconUrl?.trim();
    if (icon) return { uri: icon };
    return PARTNER_AVATAR_FALLBACK;
}

function orderDetailRiderMarkerUri(cfg: OrderDetailConfig | null | undefined): string | null {
    const icon = cfg?.partnerIconUrl?.trim();
    if (icon) return icon;
    const img = cfg?.partnerImageUrl?.trim();
    return img || null;
}

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

/** Storefront `node(id:)` expects a Shopify GID; checkout sometimes returns numeric id only. */
function normalizeStorefrontOrderGid(rawId: string): string {
    const id = rawId.trim();
    if (!id) return id;
    const base = id.includes('?') ? id.split('?')[0] : id;
    if (base.startsWith('gid://shopify/Order/')) return id;
    if (base.startsWith('gid://')) return id;
    if (/^\d+$/.test(base)) {
        const q = id.includes('?') ? `?${id.split('?')[1]}` : '';
        return `gid://shopify/Order/${base}${q}`;
    }
    return id;
}

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

/** Meters between two WGS84 points (haversine). */
function distanceMetersLatLng(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
): number {
    const R = 6371000;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function parsePartnerIsoToMs(iso: string | null | undefined): number | null {
    if (iso == null || !String(iso).trim()) return null;
    const t = Date.parse(String(iso));
    return Number.isFinite(t) ? t : null;
}

function formatClockEnIN(d: Date): string {
    const h = d.getHours();
    const m = d.getMinutes();
    const hour12 = h % 12 || 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

function formatShortDateEnIN(d: Date): string {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Backend may send these when the rider is at the drop-off (before Shopify shows delivered). */
const ARRIVED_AT_CUSTOMER_STATUSES = new Set([
    'arrived',
    'arrived_at_location',
    'at_destination',
    'at_delivery_location',
    'rider_arrived',
    'reached_destination',
    'reached_customer',
    'reached_location',
]);

/**
 * All statuses where the rider is actively en-route — used to gate WebSocket connection,
 * near-dropoff detection, and live ETA. Broader than the 2-string hardcoded list so that
 * backends using dispatched / on_the_way / in_transit etc. still work.
 */
const DELIVERY_ACTIVE_STATUSES = new Set([
    'rider_assigned',
    'out_for_delivery',
    'dispatched',
    'on_the_way',
    'in_transit',
    'transit',
    'picking_up',
    'picked_up',
    'delivery_started',
    'en_route',
]);

/** After rider has picked up — show pickedUpAt milestone from delivery-partner-service. */
const POST_PICKUP_DELIVERY_STATUSES = new Set([
    'out_for_delivery',
    'picked_up',
    'dispatched',
    'on_the_way',
    'in_transit',
    'transit',
    'delivery_started',
    'en_route',
]);

function coordsFromDeliveryStatusApi(result: {
    rider_lat?: number | string | null;
    rider_lng?: number | string | null;
    riderLatitude?: number | string | null;
    riderLongitude?: number | string | null;
} | null): { latitude: number; longitude: number } | null {
    if (!result) return null;
    const latRaw = result.rider_lat ?? result.riderLatitude;
    const lngRaw = result.rider_lng ?? result.riderLongitude;
    const lat = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw ?? ''));
    const lng = typeof lngRaw === 'number' ? lngRaw : parseFloat(String(lngRaw ?? ''));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
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

function lineItemCustomAttributesRecord(node: any): Record<string, string> {
    const attrs = node?.customAttributes;
    if (!Array.isArray(attrs)) return {};
    const out: Record<string, string> = {};
    attrs.forEach((a: any) => {
        if (a?.key != null && a.value != null) out[String(a.key)] = String(a.value);
    });
    return out;
}

/** Primary option label (e.g. size) from the purchased variant — matches cart display. */
function orderLinePrimarySizeLabel(variant: any): string {
    const t = variant?.title;
    if (!t || t === 'Default Title') return '';
    const fromTitle = sizeLabelFromVariantTitle(t);
    return fromTitle || String(t).trim();
}

function orderLineTryBuyTrialDisplay(attrRec: Record<string, string>): string {
    const fromKey = attrRec.try_buy_trial_option_value?.trim();
    if (fromKey) return fromKey;
    const raw = attrRec.try_buy_trial_variant_title;
    return sizeLabelFromVariantTitle(raw) || (raw ? String(raw).trim() : '');
}

/** Refetch road-snapped rider → customer route on this interval while tracking (ms). */
const DELIVERY_ROUTE_REFRESH_INTERVAL_MS = 10_000;

/**
 * How often to poll the backend for the rider's current GPS position.
 * Polling is more reliable than WebSocket for continuous path updates —
 * WS reconnections cause brief gaps where riderCoords becomes stale.
 */
const RIDER_LOCATION_POLL_MS = 4_000;

const DELIVERY_STATUS_LABELS: Record<string, string> = {
    placed: 'Placed',
    confirmed: 'Confirmed',
    packing: 'Packing',
    packed: 'Packed',
    rider_assigned: 'Rider Assigned',
    out_for_delivery: 'Out for Delivery',
    arrived: 'Arrived',
    at_destination: 'Arrived',
    rider_arrived: 'Arrived',
    reached_destination: 'Arrived',
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
    arrived: { bg: '#DCFCE7', text: '#15803D' },
    at_destination: { bg: '#DCFCE7', text: '#15803D' },
    rider_arrived: { bg: '#DCFCE7', text: '#15803D' },
    reached_destination: { bg: '#DCFCE7', text: '#15803D' },
    delivered: { bg: '#ECFDF3', text: '#15803D' },
    cancelled: { bg: '#FEF2F2', text: '#B91C1C' },
    return_requested: { bg: '#FFF7ED', text: '#C2410C' },
    returned: { bg: '#F5F3FF', text: '#6B21A8' },
};

export default function OrderDetailV2Screen() {
    /** Re-read app-config icons when screen is focused (config may load after first paint). */
    const [orderDetailCfgRev, setOrderDetailCfgRev] = useState(0);
    useFocusEffect(
        useCallback(() => {
            setOrderDetailCfgRev((n) => n + 1);
        }, []),
    );
    const orderDetailCfg = useMemo(() => appConfigService.getOrderDetailConfig(), [orderDetailCfgRev]);
    const cusLocUrl = orderDetailCfg?.cusLocUrl?.trim() || '';
    const darkStoreIconUrl = orderDetailCfg?.darkStoreIconUrl?.trim() || '';
    const riderMapIconUri = orderDetailRiderMarkerUri(orderDetailCfg);
    const partnerAvatarSrc = orderDetailPartnerAvatarSource(orderDetailCfg);

    const {
        id,
        estimatedDeliveryMinutes: paramEta,
        from,
        destinationLat: paramDestinationLat,
        destinationLng: paramDestinationLng,
    } = useLocalSearchParams<{
        id: string;
        estimatedDeliveryMinutes?: string;
        from?: string;
        /** Forwarded from checkout so the map can render before Shopify returns the order */
        destinationLat?: string;
        destinationLng?: string;
    }>();
    const router = useRouter();
    const goBack = () => (from === 'orders' ? router.back() : router.replace('/(tabs)'));
    const { user } = useAuth();
    /** Shopify Storefront customer token (order + tracking APIs). Prefer user.*, fall back to persisted store (same as login). */
    const persistedAccessToken = useUserStore((s) => s.accessToken);
    const shopifyCustomerToken = useMemo(
        () => String(user?.customerAccessToken ?? user?.accessToken ?? persistedAccessToken ?? '').trim(),
        [user?.customerAccessToken, user?.accessToken, persistedAccessToken],
    );
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [liveEtaMinutes, setLiveEtaMinutes] = useState<number | null>(null);
    const [deliveryPartnerStatus, setDeliveryPartnerStatus] = useState<DeliveryPartnerOrderStatus | null>(null);
    const [destinationCoords, setDestinationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [riderCoords, setRiderCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    /** Google Maps on Android needs tracksViewChanges=true briefly so custom marker bitmaps are captured after layout. */
    const [androidMarkersTracksView, setAndroidMarkersTracksView] = useState(Platform.OS === 'android');
    const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[] | null>(null);
    /** Incremented each time a new server route is received; drives Polyline key so Android redraws cleanly. */
    const [routeVersion, setRouteVersion] = useState(0);
    const trackingMapRef = useRef<MapView | null>(null);
    const orderRef = useRef(order);
    orderRef.current = order;
    const deliveryPartnerStatusRef = useRef(deliveryPartnerStatus);
    deliveryPartnerStatusRef.current = deliveryPartnerStatus;
    const destinationCoordsRef = useRef(destinationCoords);
    destinationCoordsRef.current = destinationCoords;
    const riderCoordsRef = useRef(riderCoords);
    riderCoordsRef.current = riderCoords;
    const deliveryRouteFetchGen = useRef(0);
    const liveEtaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const liveEtaLastRunRef = useRef<number>(0);
    /** Last rider+dest used for live ETA — when either changes, refetch right away (map / address update). */
    const liveEtaGeoRef = useRef<{
        rl: number;
        rm: number;
        dl: number;
        dm: number;
    } | null>(null);
    /** For immediate route re-fetch when rider coords first arrive per order. */
    const didFirstRiderRouteFetchRef = useRef(false);
    const firstRiderRouteOrderIdRef = useRef('');

    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    // Map destination from checkout (available before Storefront returns the order)
    useEffect(() => {
        const lat = parseFloat(String(paramDestinationLat ?? '').trim());
        const lng = parseFloat(String(paramDestinationLng ?? '').trim());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setDestinationCoords((prev) => prev ?? { latitude: lat, longitude: lng });
    }, [paramDestinationLat, paramDestinationLng]);

    // On mount (Android): let all custom markers render with tracksViewChanges=true, then freeze.
    useEffect(() => {
        if (Platform.OS !== 'android') return;
        const t = setTimeout(() => setAndroidMarkersTracksView(false), 2500);
        return () => clearTimeout(t);
    }, []);

    // Each time the rider moves (Android): re-enable tracking briefly so the bitmap refreshes.
    useEffect(() => {
        if (!riderCoords || Platform.OS !== 'android') return;
        setAndroidMarkersTracksView(true);
        const t = setTimeout(() => setAndroidMarkersTracksView(false), 2500);
        return () => clearTimeout(t);
    }, [riderCoords?.latitude, riderCoords?.longitude]);

    useEffect(() => {
        let cancelled = false;
        const fetchOrder = async () => {
            if (!id || typeof id !== 'string') {
                setLoading(false);
                setError('Invalid order ID');
                return;
            }
            setLoading(true);
            try {
                let orderId = normalizeStorefrontOrderGid(decodeURIComponent(id).trim());
                const baseId = orderId.includes('?') ? orderId.split('?')[0] : orderId;
                const queryPart = orderId.includes('?') ? orderId.split('?')[1] : '';
                const isDraftOrder = baseId.startsWith('gid://shopify/DraftOrder/');

                let fetchedOrder: any = null;
                if (shopifyCustomerToken && !isDraftOrder) {
                    try {
                        const customerOrders = await shopifyApi.getCustomerOrders(shopifyCustomerToken, 50);
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
                                        customAttributes: e.node.customAttributes || [],
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
                    const postCheckoutRetries = 10;
                    const retryDelayMs = 1200;
                    for (let attempt = 0; attempt < postCheckoutRetries; attempt++) {
                        if (cancelled) return;
                        fetchedOrder = await shopifyApi.getOrderById(orderId);
                        if (!fetchedOrder && queryPart) {
                            fetchedOrder = await shopifyApi.getOrderById(orderId.split('?')[0]);
                        }
                        if (fetchedOrder) break;
                        if (attempt < postCheckoutRetries - 1) await sleep(retryDelayMs);
                    }
                }

                if (cancelled) return;
                if (fetchedOrder) {
                    setOrder(fetchedOrder);
                    setError(null);
                } else {
                    setError('Order not found');
                }
            } catch (err: any) {
                if (!cancelled) setError(err.message || 'Failed to load order');
            }
            if (!cancelled) setLoading(false);
        };
        fetchOrder();
        return () => {
            cancelled = true;
        };
    }, [id, shopifyCustomerToken]);

    useEffect(() => {
        // Do not clear coords while order is still loading — that broke post-checkout map
        // (checkout forwards destinationLat/Lng until Storefront returns shippingAddress).
        if (!order) return;

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
    }, [order?.id, order?.shippingAddress?.address1, order?.shippingAddress?.address2, order?.shippingAddress?.city, order?.shippingAddress?.province, order?.shippingAddress?.zip, order?.shippingAddress?.country]);

    useEffect(() => {
        const statusKey = String(deliveryPartnerStatus?.status ?? '').trim().toLowerCase();
        const nearDrop =
            !!destinationCoords &&
            !!riderCoords &&
            DELIVERY_ACTIVE_STATUSES.has(statusKey) &&
            distanceMetersLatLng(riderCoords, destinationCoords) <= 110;
        const canUseLiveEta =
            DELIVERY_ACTIVE_STATUSES.has(statusKey) &&
            !!destinationCoords &&
            !!riderCoords &&
            !nearDrop &&
            !ARRIVED_AT_CUSTOMER_STATUSES.has(statusKey);
        if (!canUseLiveEta) {
            setLiveEtaMinutes(null);
            liveEtaGeoRef.current = null;
            if (liveEtaTimerRef.current) {
                clearTimeout(liveEtaTimerRef.current);
                liveEtaTimerRef.current = null;
            }
            return;
        }

        const currentGeo = {
            rl: riderCoords.latitude,
            rm: riderCoords.longitude,
            dl: destinationCoords.latitude,
            dm: destinationCoords.longitude,
        };
        const prevGeo = liveEtaGeoRef.current;
        const geoChanged =
            !prevGeo ||
            prevGeo.rl !== currentGeo.rl ||
            prevGeo.rm !== currentGeo.rm ||
            prevGeo.dl !== currentGeo.dl ||
            prevGeo.dm !== currentGeo.dm;

        let cancelled = false;
        const now = Date.now();
        const elapsed = now - liveEtaLastRunRef.current;
        // Rider/destination moved → refresh ETA for header + map context; else throttle status-only churn.
        const waitMs = geoChanged ? 200 : Math.max(0, 8000 - elapsed);

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
                liveEtaGeoRef.current = currentGeo;
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

            const r = result as DeliveryPartnerOrderStatus | null;
            const hasRiderOnPoll =
                !!r &&
                (r.rider_lat != null ||
                    r.rider_lng != null ||
                    r.riderLatitude != null ||
                    r.riderLongitude != null);
            const polled = coordsFromDeliveryStatusApi(r);
            if (hasRiderOnPoll && polled) {
                setRiderCoords(polled);
            }

            const statusKey = String(result?.status ?? '').trim().toLowerCase();
            if (TERMINAL_DELIVERY_POLL_STATUSES.has(statusKey) && intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        pollDeliveryStatus();
        intervalId = setInterval(pollDeliveryStatus, 25 * 1000);

        return () => {
            cancelled = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, [order?.id]);

    /**
     * Poll the backend every RIDER_LOCATION_POLL_MS for the rider's live GPS position.
     * This replaces the WebSocket approach — WS reconnections created brief gaps where
     * riderCoords became stale and the polyline jumped back to the dark-store fallback.
     * Polling is simpler, more reliable, and produces a smooth, consistent path on both
     * Android and iOS.
     */
    useEffect(() => {
        const rawOrderId = String(order?.id ?? '').trim();
        const shopifyOrderId = rawOrderId.includes('/Order/')
            ? rawOrderId.split('/').pop()?.split('?')[0]?.trim() || ''
            : '';
        const statusKey = String(deliveryPartnerStatus?.status ?? '').trim().toLowerCase();
        const isActive =
            !!shopifyOrderId &&
            (DELIVERY_ACTIVE_STATUSES.has(statusKey) || ARRIVED_AT_CUSTOMER_STATUSES.has(statusKey));

        if (!isActive) return;

        let cancelled = false;

        const fetchRiderLocation = async () => {
            if (cancelled) return;
            try {
                const result = await getDeliveryPartnerOrderStatus(shopifyOrderId);
                if (cancelled) return;
                const coords = coordsFromDeliveryStatusApi(result);
                if (coords) setRiderCoords(coords);
            } catch (_) {
                // keep last known position on transient network errors
            }
        };

        void fetchRiderLocation();
        const intervalId = setInterval(fetchRiderLocation, RIDER_LOCATION_POLL_MS);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [order?.id, deliveryPartnerStatus?.status]);

    useEffect(() => {
        const rawOrderId = String(order?.id ?? '').trim();
        const shopifyOrderId = rawOrderId.includes('/Order/')
            ? rawOrderId.split('/').pop()?.split('?')[0]?.trim() || ''
            : '';

        const shouldFetchRoute = (): boolean => {
            const o = orderRef.current;
            const dps = deliveryPartnerStatusRef.current;
            const dest = destinationCoordsRef.current;
            const rc = riderCoordsRef.current;
            const statusKey = String(dps?.status ?? '').trim().toLowerCase();
            const terminalStatus = ['delivered', 'cancelled', 'returned'].includes(statusKey);
            const fulfilled = o?.fulfillmentStatus === 'FULFILLED';
            const ticketingOnly = o ? isOnlyTicketingOrder(o) : true;
            const nearDrop =
                !!rc &&
                !!dest &&
                DELIVERY_ACTIVE_STATUSES.has(statusKey) &&
                distanceMetersLatLng(rc, dest) <= 110;
            const riderArrivedUi =
                ARRIVED_AT_CUSTOMER_STATUSES.has(statusKey) || (!!nearDrop && !fulfilled);
            return (
                !!shopifyOrderId &&
                !terminalStatus &&
                !fulfilled &&
                !ticketingOnly &&
                !riderArrivedUi
            );
        };

        if (!shopifyOrderId) {
            setRouteCoordinates(null);
            return;
        }

        const isTerminalStatus = () => {
            const sk = String(deliveryPartnerStatusRef.current?.status ?? '').trim().toLowerCase();
            return ['delivered', 'cancelled', 'returned'].includes(sk);
        };

        if (!shouldFetchRoute()) {
            // Only wipe the route for terminal orders — keep it visible during all other transitions
            // (e.g. status change from rider_assigned → out_for_delivery, near-drop check, etc.)
            if (isTerminalStatus()) setRouteCoordinates(null);
            return;
        }

        let cancelled = false;

        const runFetch = async () => {
            if (cancelled) return;
            if (!shouldFetchRoute()) {
                // Don't wipe the polyline mid-delivery — a momentary shouldFetchRoute=false
                // (near-drop check, status transitioning) would make the path disappear.
                if (!cancelled && isTerminalStatus()) setRouteCoordinates(null);
                return;
            }
            const fetchGen = ++deliveryRouteFetchGen.current;
            const rc = riderCoordsRef.current;
            const dest = destinationCoordsRef.current;
            const res = await getDeliveryRouteForOrder(
                shopifyOrderId,
                rc ? { latitude: rc.latitude, longitude: rc.longitude } : null,
                dest ? { latitude: dest.latitude, longitude: dest.longitude } : null,
            );
            if (cancelled || fetchGen !== deliveryRouteFetchGen.current) return;
            if (res?.coordinates && res.coordinates.length >= 2) {
                setRouteCoordinates(res.coordinates);
                // Bump the version so Android redraws the Polyline with the new path.
                // We do NOT wipe the old polyline first — the new one replaces it atomically.
                setRouteVersion((v) => v + 1);
            }
            // On fetch failure / empty response: keep the last good route visible.
            // The next interval tick will retry automatically.
        };

        void runFetch();
        const intervalId = setInterval(() => {
            void runFetch();
        }, DELIVERY_ROUTE_REFRESH_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [
        order?.id,
        order?.fulfillmentStatus,
        deliveryPartnerStatus?.status,
        destinationCoords?.latitude,
        destinationCoords?.longitude,
    ]);

    /**
     * Immediately re-fetch the route the first time rider coords arrive for this order.
     * Without this, the first rider-based route waits up to 10 s (the interval tick).
     */
    useEffect(() => {
        if (!riderCoords) return;
        const rawOrderId = String(orderRef.current?.id ?? '').trim();
        const shopifyOrderId = rawOrderId.includes('/Order/')
            ? rawOrderId.split('/').pop()?.split('?')[0]?.trim() || ''
            : '';
        if (!shopifyOrderId) return;
        // Reset per order
        if (firstRiderRouteOrderIdRef.current !== shopifyOrderId) {
            didFirstRiderRouteFetchRef.current = false;
            firstRiderRouteOrderIdRef.current = shopifyOrderId;
        }
        if (didFirstRiderRouteFetchRef.current) return;
        didFirstRiderRouteFetchRef.current = true;
        const destForRoute = destinationCoordsRef.current;
        void getDeliveryRouteForOrder(
            shopifyOrderId,
            riderCoords,
            destForRoute ? { latitude: destForRoute.latitude, longitude: destForRoute.longitude } : null,
        ).then((res) => {
            if (res?.coordinates && res.coordinates.length >= 2) {
                setRouteCoordinates(res.coordinates);
                setRouteVersion((v) => v + 1);
            }
        });
    }, [riderCoords?.latitude, riderCoords?.longitude]);

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

    const deliveryStatusKey = String(deliveryPartnerStatus?.status ?? '').trim().toLowerCase();
    const isDelivered = order?.fulfillmentStatus === 'FULFILLED';

    /** Shopify / checkout param only — not kiddo geocoded ETA (live rider ETA uses getDeliveryEta with GPS). */
    const staticEtaMinutes =
        (Number(paramEta ?? order?.estimatedDeliveryMinutes ?? DEFAULT_ETA_MINUTES) || DEFAULT_ETA_MINUTES);

    const partnerDeliveredAtMs = parsePartnerIsoToMs(deliveryPartnerStatus?.deliveredAt);
    const partnerPickedUpAtMs = parsePartnerIsoToMs(deliveryPartnerStatus?.pickedUpAt);
    const partnerAssignedAtMs = parsePartnerIsoToMs(deliveryPartnerStatus?.assignedAt);

    const isRiderNearDropoff =
        !!riderCoords &&
        !!destinationCoords &&
        DELIVERY_ACTIVE_STATUSES.has(deliveryStatusKey) &&
        distanceMetersLatLng(riderCoords, destinationCoords) <= 110;

    /** Same gates as live ETA fetch — updates when rider/dest moves and kiddo returns new minutes. */
    const showLiveEtaInHeader =
        liveEtaMinutes != null &&
        !!riderCoords &&
        !!destinationCoords &&
        DELIVERY_ACTIVE_STATUSES.has(deliveryStatusKey) &&
        !isRiderNearDropoff &&
        !ARRIVED_AT_CUSTOMER_STATUSES.has(deliveryStatusKey);

    const orderPlacedAt = order?.processedAt || order?.createdAt;
    const baseTime = orderPlacedAt ? new Date(orderPlacedAt) : new Date();
    const deliveryByDate = showLiveEtaInHeader
        ? new Date(Date.now() + Math.max(1, Math.round(liveEtaMinutes!)) * 60 * 1000)
        : new Date(baseTime.getTime() + staticEtaMinutes * 60 * 1000);
    const h = deliveryByDate.getHours();
    const m = deliveryByDate.getMinutes();
    const hour12 = h % 12 || 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    const timeStr = `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
    const dateStr = deliveryByDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const deliveryByTimeStr = `${timeStr}, ${dateStr}`;
    const hasArrivalTimePassed = deliveryByDate.getTime() < Date.now();

    const isRiderAtCustomer =
        !isDelivered &&
        (ARRIVED_AT_CUSTOMER_STATUSES.has(deliveryStatusKey) || isRiderNearDropoff);

    const headerStatusText = (() => {
        if (hasArrivalTimePassed) {
            const arrivedDateStr = deliveryByDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
            return `Arrived at ${timeStr}, ${arrivedDateStr}`;
        }
        if (isRiderAtCustomer && !isDelivered) {
            return 'Your rider has arrived at your address';
        }
        if (isDelivered) {
            if (partnerDeliveredAtMs != null) {
                const dd = new Date(partnerDeliveredAtMs);
                return `Delivered at ${formatClockEnIN(dd)}, ${formatShortDateEnIN(dd)}`;
            }
            return `Delivered by ${deliveryByTimeStr}`;
        }
        if (showLiveEtaInHeader) {
            const mins = Math.max(1, Math.round(liveEtaMinutes!));
            const liveArrival = new Date(Date.now() + mins * 60 * 1000);
            return `Arriving by ${formatClockEnIN(liveArrival)}, ${formatShortDateEnIN(liveArrival)} · ${mins} min (live)`;
        }
        const milestoneParts: string[] = [];
        if (deliveryStatusKey === 'rider_assigned' && partnerAssignedAtMs != null) {
            const d = new Date(partnerAssignedAtMs);
            milestoneParts.push(`Rider assigned ${formatClockEnIN(d)}, ${formatShortDateEnIN(d)}`);
        }
        if (partnerPickedUpAtMs != null && POST_PICKUP_DELIVERY_STATUSES.has(deliveryStatusKey)) {
            const d = new Date(partnerPickedUpAtMs);
            milestoneParts.push(`Picked up ${formatClockEnIN(d)}, ${formatShortDateEnIN(d)}`);
        }
        const arrivalLine = `Arriving by ${deliveryByTimeStr}`;
        if (milestoneParts.length) return `${milestoneParts.join(' · ')} · ${arrivalLine}`;
        return arrivalLine;
    })();
    const isPhysicalDeliveryOrder = !!order && !isOnlyTicketingOrder(order);
    const statusKeyForHeaderPill =
        isRiderAtCustomer && !ARRIVED_AT_CUSTOMER_STATUSES.has(deliveryStatusKey)
            ? 'arrived'
            : deliveryStatusKey
              ? deliveryStatusKey
              : isPhysicalDeliveryOrder
                ? 'placed'
                : '';
    const deliveryStatusLabel = !statusKeyForHeaderPill
        ? ''
        : (DELIVERY_STATUS_LABELS[statusKeyForHeaderPill] ??
              (deliveryPartnerStatus?.status
                  ? String(deliveryPartnerStatus.status).replace(/_/g, ' ')
                  : '')) || 'Placed';
    const deliveryStatusColors: { bg: string; text: string } = statusKeyForHeaderPill
        ? (DELIVERY_STATUS_COLORS[statusKeyForHeaderPill] ?? { bg: '#F3F4F6', text: '#374151' })
        : { bg: '#F3F4F6', text: '#374151' };
    const RIDER_LIVE_OR_DONE_STATUSES = new Set([
        'rider_assigned',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'returned',
        'return_requested',
        ...ARRIVED_AT_CUSTOMER_STATUSES,
    ]);
    /** Includes first paint after checkout when GET delivery-status has not returned yet (empty key). */
    const shouldShowAssignSoonMessage =
        isPhysicalDeliveryOrder &&
        !isDelivered &&
        !RIDER_LIVE_OR_DONE_STATUSES.has(deliveryStatusKey);
    const shouldShowDeliveryPartnerDetails =
        (['rider_assigned', 'out_for_delivery'].includes(deliveryStatusKey) ||
            ARRIVED_AT_CUSTOMER_STATUSES.has(deliveryStatusKey) ||
            isRiderNearDropoff) &&
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
    /** From order placed through packing: straight line dark store → customer; live route/rider once assigned. */
    const hideTrackingMapStatuses = new Set(['delivered', 'cancelled', 'returned']);
    const orderBlocksTrackingMap =
        !!order && (isOnlyTicketingOrder(order) || order?.fulfillmentStatus === 'FULFILLED');
    const shouldShowTrackingMap =
        !!destinationCoords &&
        !orderBlocksTrackingMap &&
        !hideTrackingMapStatuses.has(deliveryStatusKey) &&
        !isRiderAtCustomer;
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
        const pts = riderCoords
            ? [DARK_STORE_LOCATION, riderCoords, destinationCoords]
            : [DARK_STORE_LOCATION, destinationCoords];
        return pts.filter(
            (c): c is { latitude: number; longitude: number } =>
                !!c && isFinite(c.latitude) && isFinite(c.longitude),
        );
    }, [destinationCoords, riderCoords]);

    const trackingPolylineCoordinates = useMemo(() => {
        const raw =
            routeCoordinates && routeCoordinates.length >= 2
                ? routeCoordinates
                : trackingPathFallback;
        return raw.filter(
            (c): c is { latitude: number; longitude: number } =>
                !!c && isFinite(c.latitude) && isFinite(c.longitude),
        );
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
        const mapWhileLoading = shouldShowTrackingMap && mapRegion;
        const showPostCheckoutChrome = !!destinationCoords && !!id;
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={12}>
                        <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Order Summary</Text>
                    </View>
                    {showPostCheckoutChrome ? (
                        <View
                            style={[
                                styles.headerStatusPill,
                                { backgroundColor: DELIVERY_STATUS_COLORS.placed.bg },
                            ]}
                        >
                            <Text
                                style={[styles.headerStatusText, { color: DELIVERY_STATUS_COLORS.placed.text }]}
                            >
                                {DELIVERY_STATUS_LABELS.placed}
                            </Text>
                        </View>
                    ) : (
                        <View style={{ minWidth: 8 }} />
                    )}
                </View>
                {mapWhileLoading ? (
                    <View style={[styles.trackingWrap, { marginTop: 8, marginHorizontal: 16 }]}>
                        <View style={styles.trackingMapFrame}>
                            <MapView
                                ref={trackingMapRef}
                                provider={PROVIDER_GOOGLE}
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
                                onMapReady={() => {
                                    if (trackingPolylineCoordinates.length >= 2) {
                                        trackingMapRef.current?.fitToCoordinates(
                                            trackingPolylineCoordinates,
                                            { edgePadding: { top: 28, right: 28, bottom: 28, left: 28 }, animated: false },
                                        );
                                    }
                                }}
                            >
                                <Polyline
                                    coordinates={trackingPolylineCoordinates.length >= 2 ? trackingPolylineCoordinates : [DARK_STORE_LOCATION, DARK_STORE_LOCATION]}
                                    strokeColor={trackingPolylineCoordinates.length >= 2 ? "#2563EB" : "transparent"}
                                    strokeWidth={5}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                                <Marker
                                    coordinate={DARK_STORE_LOCATION}
                                    title="Dark store"
                                    anchor={{ x: 0.5, y: 1 }}
                                    tracksViewChanges={
                                        Platform.OS === 'android' ? androidMarkersTracksView : !!darkStoreIconUrl
                                    }
                                >
                                    <View collapsable={false} style={styles.storeMarker}>
                                        <View
                                            collapsable={false}
                                            style={[
                                                styles.storeMarkerInner,
                                                darkStoreIconUrl ? { backgroundColor: 'transparent' } : null,
                                            ]}
                                        >
                                            {darkStoreIconUrl ? (
                                                <Image
                                                    source={{ uri: darkStoreIconUrl }}
                                                    style={styles.orderMapRemoteIcon}
                                                    contentFit="contain"
                                                />
                                            ) : (
                                                <Ionicons name="home" size={16} color="#B45309" />
                                            )}
                                        </View>
                                    </View>
                                </Marker>
                                {Platform.OS === 'ios' ? (
                                    <Marker
                                        coordinate={destinationCoords ?? DARK_STORE_LOCATION}
                                        title="Delivery address"
                                        anchor={{ x: 0.5, y: 1 }}
                                        tracksViewChanges={!!cusLocUrl}
                                        zIndex={destinationCoords ? 500 : 0}
                                    >
                                        <View collapsable={false} style={[styles.destinationMarker, !destinationCoords && { opacity: 0 }]}>
                                            {cusLocUrl ? (
                                                <Image
                                                    source={{ uri: cusLocUrl }}
                                                    style={styles.orderMapRemoteIcon}
                                                    contentFit="contain"
                                                />
                                            ) : (
                                                <Ionicons name="bag-handle" size={17} color="#FFFFFF" />
                                            )}
                                        </View>
                                    </Marker>
                                ) : destinationCoords ? (
                                    <Marker
                                        coordinate={destinationCoords}
                                        title="Delivery address"
                                        anchor={{ x: 0.5, y: 1 }}
                                        tracksViewChanges={androidMarkersTracksView}
                                        zIndex={500}
                                    >
                                        <View collapsable={false} style={styles.destinationMarker}>
                                            {cusLocUrl ? (
                                                <Image
                                                    source={{ uri: cusLocUrl }}
                                                    style={styles.orderMapRemoteIcon}
                                                    contentFit="contain"
                                                />
                                            ) : (
                                                <Ionicons name="bag-handle" size={17} color="#FFFFFF" />
                                            )}
                                        </View>
                                    </Marker>
                                ) : null}
                            </MapView>
                        </View>
                    </View>
                ) : null}
                {showPostCheckoutChrome ? (
                    <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
                        <View style={styles.deliveryPartnerCard}>
                            <View style={styles.deliveryPartnerContent}>
                                <View style={styles.deliveryPartnerAvatar}>
                                    <Ionicons name="time-outline" size={26} color="#8B5E00" />
                                </View>
                                <View style={styles.deliveryPartnerTextWrap}>
                                    <Text style={styles.deliveryPartnerIntro}>
                                        Your delivery partner will be assigned soon
                                    </Text>
                                    <Text style={styles.deliveryPartnerPendingText}>
                                        We will share the rider details here shortly
                                    </Text>
                                </View>
                                <View style={styles.deliveryPartnerPendingBadge}>
                                    <Ionicons name="hourglass-outline" size={18} color="#9CA3AF" />
                                </View>
                            </View>
                        </View>
                    </View>
                ) : null}
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

                {isDelivered && orderDetailCfg?.imageUrl?.trim() ? (
                    <View style={styles.orderDetailImageWrap}>
                        <Image
                            source={{ uri: orderDetailCfg.imageUrl.trim() }}
                            style={styles.orderDetailImage}
                            contentFit="cover"
                        />
                    </View>
                ) : null}

                {shouldShowTrackingMap && mapRegion ? (
                    <View style={styles.trackingWrap}>
                        <View style={styles.trackingMapFrame}>
                            <MapView
                                ref={trackingMapRef}
                                provider={PROVIDER_GOOGLE}
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
                                onMapReady={() => {
                                    if (trackingPolylineCoordinates.length >= 2) {
                                        trackingMapRef.current?.fitToCoordinates(
                                            trackingPolylineCoordinates,
                                            { edgePadding: { top: 28, right: 28, bottom: 28, left: 28 }, animated: false },
                                        );
                                    }
                                }}
                            >
                                <Polyline
                                    coordinates={trackingPolylineCoordinates.length >= 2 ? trackingPolylineCoordinates : [DARK_STORE_LOCATION, DARK_STORE_LOCATION]}
                                    strokeColor={trackingPolylineCoordinates.length >= 2 ? "#2563EB" : "transparent"}
                                    strokeWidth={5}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                                <Marker
                                    coordinate={DARK_STORE_LOCATION}
                                    title="Dark store"
                                    anchor={{ x: 0.5, y: 1 }}
                                    tracksViewChanges={
                                        Platform.OS === 'android' ? androidMarkersTracksView : !!darkStoreIconUrl
                                    }
                                >
                                    <View collapsable={false} style={styles.storeMarker}>
                                        <View
                                            collapsable={false}
                                            style={[
                                                styles.storeMarkerInner,
                                                darkStoreIconUrl ? { backgroundColor: 'transparent' } : null,
                                            ]}
                                        >
                                            {darkStoreIconUrl ? (
                                                <Image
                                                    source={{ uri: darkStoreIconUrl }}
                                                    style={styles.orderMapRemoteIcon}
                                                    contentFit="contain"
                                                />
                                            ) : (
                                                <Ionicons name="home" size={16} color="#B45309" />
                                            )}
                                        </View>
                                    </View>
                                </Marker>
                                {Platform.OS === 'ios' ? (
                                    <Marker
                                        coordinate={destinationCoords ?? DARK_STORE_LOCATION}
                                        title="Delivery address"
                                        anchor={{ x: 0.5, y: 1 }}
                                        tracksViewChanges={!!cusLocUrl}
                                        zIndex={destinationCoords ? 500 : 0}
                                    >
                                        <View collapsable={false} style={[styles.destinationMarker, !destinationCoords && { opacity: 0 }]}>
                                            {cusLocUrl ? (
                                                <Image
                                                    source={{ uri: cusLocUrl }}
                                                    style={styles.orderMapRemoteIcon}
                                                    contentFit="contain"
                                                />
                                            ) : (
                                                <Ionicons name="bag-handle" size={17} color="#FFFFFF" />
                                            )}
                                        </View>
                                    </Marker>
                                ) : destinationCoords ? (
                                    <Marker
                                        coordinate={destinationCoords}
                                        title="Delivery address"
                                        anchor={{ x: 0.5, y: 1 }}
                                        tracksViewChanges={androidMarkersTracksView}
                                        zIndex={500}
                                    >
                                        <View collapsable={false} style={styles.destinationMarker}>
                                            {cusLocUrl ? (
                                                <Image
                                                    source={{ uri: cusLocUrl }}
                                                    style={styles.orderMapRemoteIcon}
                                                    contentFit="contain"
                                                />
                                            ) : (
                                                <Ionicons name="bag-handle" size={17} color="#FFFFFF" />
                                            )}
                                        </View>
                                    </Marker>
                                ) : null}
                                {Platform.OS === 'ios' ? (
                                    <Marker
                                        key="rider-marker"
                                        coordinate={riderCoords ?? DARK_STORE_LOCATION}
                                        title="Rider"
                                        anchor={{ x: 0.5, y: 0.5 }}
                                        zIndex={riderCoords ? 1000 : 0}
                                        tracksViewChanges={!!riderMapIconUri}
                                    >
                                        <View collapsable={false} style={[styles.riderMarker, !riderCoords && { opacity: 0 }]}>
                                            {riderMapIconUri ? (
                                                <Image
                                                    source={{ uri: riderMapIconUri }}
                                                    style={styles.orderMapRemoteIcon}
                                                    contentFit="contain"
                                                />
                                            ) : (
                                                <Ionicons name="bicycle" size={18} color="#111827" />
                                            )}
                                        </View>
                                    </Marker>
                                ) : riderCoords ? (
                                    <Marker
                                        key="rider-marker"
                                        coordinate={riderCoords}
                                        title="Rider"
                                        anchor={{ x: 0.5, y: 0.5 }}
                                        zIndex={1000}
                                        tracksViewChanges={androidMarkersTracksView}
                                    >
                                        <View collapsable={false} style={styles.riderMarker}>
                                            {riderMapIconUri ? (
                                                <Image
                                                    source={{ uri: riderMapIconUri }}
                                                    style={styles.orderMapRemoteIcon}
                                                    contentFit="contain"
                                                />
                                            ) : (
                                                <Ionicons name="bicycle" size={18} color="#111827" />
                                            )}
                                        </View>
                                    </Marker>
                                ) : null}
                            </MapView>
                            <TouchableOpacity style={styles.mapFloatingButton} activeOpacity={0.85}>
                                <Ionicons name="expand-outline" size={18} color="#111827" />
                            </TouchableOpacity>
                        </View>
                       
                    </View>
                ) : null}

                {isRiderAtCustomer && destinationCoords ? (
                    <View style={styles.arrivedAtCard}>
                        <View style={styles.arrivedAtIconWrap}>
                            <Ionicons name="checkmark-circle" size={28} color="#15803D" />
                        </View>
                        <View style={styles.arrivedAtTextWrap}>
                            <Text style={styles.arrivedAtTitle}>Rider has arrived</Text>
                            <Text style={styles.arrivedAtSubtitle}>
                                Your delivery partner is at your location. Please collect your order.
                            </Text>
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
                                    source={partnerAvatarSrc}
                                    style={styles.deliveryPartnerAvatarImage}
                                    contentFit="cover"
                                />
                            </View>
                            <View style={styles.deliveryPartnerTextWrap}>
                                <Text style={styles.deliveryPartnerIntro}>
                                    {`I'm ${deliveryPartnerStatus.deliveryPartner.name || 'your delivery partner'}, your delivery partner`}
                                </Text>
                                <Text style={styles.deliveryPartnerContactText}>
                                    {isRiderAtCustomer
                                        ? "I've arrived at your location. Please meet me for your delivery."
                                        : 'I have picked up your order, and I am on the way'}
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
                        const lineAttrs = lineItemCustomAttributesRecord(item);
                        const primarySize = orderLinePrimarySizeLabel(item.variant);
                        const sizeLineLabel =
                            primarySize || (variantTitle ? String(variantTitle).trim() : '');
                        const tryBuyTrialId = lineAttrs.try_buy_trial_variant_id?.trim();
                        const tryBuyTrialSize = tryBuyTrialId ? orderLineTryBuyTrialDisplay(lineAttrs) : '';
                        const showTryBuyBadge = !!tryBuyTrialId;
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
                                <View>
                                    {imageSource ? (
                                        <Image source={imageSource} style={styles.itemImage} contentFit="cover" />
                                    ) : (
                                        <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                                            <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                                        </View>
                                    )}
                                    {showTryBuyBadge ? (
                                        <View style={styles.tryAndBuyBadgeOrder} pointerEvents="none">
                                            <Text style={styles.tryAndBuyBadgeOrderText}>Try & Buy</Text>
                                        </View>
                                    ) : null}
                                </View>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                                    <View style={styles.itemMetaRow}>
                                        <View style={styles.itemMetaWrap}>
                                            <Text style={styles.itemMetaPrice}>
                                                ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </Text>
                                        </View>
                                        <Text style={styles.itemQty}>QTY:{item.quantity || 1}</Text>
                                    </View>
                                    {sizeLineLabel ? (
                                        <Text style={styles.itemSizeLineOrder}>Size: {sizeLineLabel}</Text>
                                    ) : null}
                                    {tryBuyTrialId && tryBuyTrialSize ? (
                                        <Text style={styles.itemTryBuySizeOrder}>Try & Buy size: {tryBuyTrialSize}</Text>
                                    ) : null}
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
    tryAndBuyBadgeOrder: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: '#FEF7C3',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderTopLeftRadius: 8,
        borderBottomRightRadius: 8,
        zIndex: 1,
    },
    tryAndBuyBadgeOrderText: {
        color: '#EAAA08',
        fontSize: 10,
        fontFamily: Fonts.Bold,
    },
    itemSizeLineOrder: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#374151',
        marginTop: 6,
    },
    itemTryBuySizeOrder: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#6B7280',
        marginTop: 2,
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
    arrivedAtCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF3',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#BBF7D0',
        padding: 14,
        marginBottom: 16,
    },
    arrivedAtIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    arrivedAtTextWrap: {
        flex: 1,
    },
    arrivedAtTitle: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#14532D',
        marginBottom: 4,
    },
    arrivedAtSubtitle: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#166534',
        lineHeight: 18,
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
    orderMapRemoteIcon: {
        width: 44,
        height: 44,
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
