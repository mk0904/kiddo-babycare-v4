import { DARK_STORE_LOCATION, geocodeAddress, getDeliveryEta } from '@/config/deliveryConfig';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { appConfigService } from '@/services/appConfigService';
import {
  getDeliveryPartnerOrderStatus,
  liveTabBannerPhaseFromPartnerStatus,
  riderCoordsFromDeliveryStatus,
  type DeliveryPartnerOrderStatus,
  type LiveTabBannerPhase,
} from '@/services/deliveryPartnerService';
import { shopifyApi } from '@/services/shopifyApi';
import { useUserStore } from '@/store/userStore';
import type { OrderDetailConfig } from '@/types/appConfig';
import {
  ARRIVED_AT_CUSTOMER_STATUSES,
  computeDeliveryHeaderStatusText,
  DELIVERY_ACTIVE_STATUSES,
  distanceMetersLatLng,
  shippingAddressString,
} from '@/utils/orderDeliveryHeaderText';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const RIDER_ICON = require('@/assets/icons/riderIcon.png');
const ARRIVED_ICON = require('@/assets/icons/arrivedIcon.png');
const PARTNER_FALLBACK = require('@/assets/icons/partnerIcon.png');

const POLL_MS = 45_000;
const DISMISS_PREFIX = '@kiddo/liveTabDeliveredDismissed:';
const DELIVERED_AUTO_HIDE_MS = 48 * 60 * 60 * 1000;
const RECENT_ORDER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function partnerAvatarSource(cfg: OrderDetailConfig | null | undefined) {
  const png = cfg?.partnerImageUrl?.trim();
  if (png) return { uri: png };
  const icon = cfg?.partnerIconUrl?.trim();
  if (icon) return { uri: icon };
  return PARTNER_FALLBACK;
}

function extractShopifyOrderNumericId(orderId: unknown): string | null {
  if (orderId == null) return null;
  const s = String(orderId).trim();
  const gidMatch = s.match(/\/Order\/(\d+)/i);
  if (gidMatch) return gidMatch[1];
  if (/^\d+$/.test(s)) return s;
  return null;
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

function isTicketingLineItemNode(node: any): boolean {
  const itemTitle = node?.title || '';
  const variantTitle = node?.variant?.title || '';
  const attrs = node?.customAttributes || [];
  if (attrs.some((a: any) => a.key === 'booking_date' || a.key === 'booking_date_display')) return true;
  if (looksLikeTicketingDate(String(variantTitle))) return true;
  if (/(event|workshop|playhouse|petting|farm|ticket|zoo)/i.test(String(itemTitle))) return true;
  return false;
}

/** Latest Shopify order in the list should be skipped when every line is ticketing (events-only). */
function isOnlyTicketingOrderNode(o: any): boolean {
  const edges = o?.lineItems?.edges || [];
  if (edges.length === 0) return false;
  return edges.every((e: any) => isTicketingLineItemNode(e?.node));
}

function formatItemsSubtitle(order: any): string {
  const edges = order?.lineItems?.edges ?? [];
  const n = edges.length;
  if (n === 0) return '';
  const titles = edges
    .map((e: any) => String(e?.node?.title || '').trim())
    .filter(Boolean);
  const first = titles[0] || 'Order';
  const secondWord = titles[1] ? String(titles[1]).split(/\s+/)[0] : '';
  const head = first.length > 28 ? `${first.slice(0, 26)}…` : first;
  if (n === 1) return `1 item: ${head}`;
  if (secondWord) return `${n} items: ${head}, ${secondWord}…`;
  return `${n} items: ${head}…`;
}

type BannerModel = {
  phase: LiveTabBannerPhase;
  order: any;
  partnerStatus: DeliveryPartnerOrderStatus;
  headerPrimary: string;
};

export interface LiveDeliveryTabBannerProps {
  showTabBar: boolean;
  /** Tab bar row + home indicator (`TabBar` `totalHeight`). */
  tabStackHeight: number;
  onStackOffsetChange: (extraPx: number) => void;
}

export function LiveDeliveryTabBanner({
  showTabBar,
  tabStackHeight,
  onStackOffsetChange,
}: LiveDeliveryTabBannerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const persistedAccessToken = useUserStore((s) => s.accessToken);
  const { isVisible: tabBarVisible } = useTabBarVisibility();
  const [model, setModel] = useState<BannerModel | null>(null);
  const [dismissedDeliveredIds, setDismissedDeliveredIds] = useState<Set<string>>(() => new Set());
  const cfg = useMemo(() => appConfigService.getOrderDetailConfig(), []);
  const partnerUri = partnerAvatarSource(cfg);

  const hideForRoute =
    pathname?.includes('/orders/') || pathname === '/cart' || pathname?.startsWith('/cart/');

  const refreshDismissed = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const next = new Set<string>();
      for (const k of keys) {
        if (k.startsWith(DISMISS_PREFIX)) next.add(k.slice(DISMISS_PREFIX.length));
      }
      setDismissedDeliveredIds(next);
    } catch {
      setDismissedDeliveredIds(new Set());
    }
  }, []);

  useEffect(() => {
    refreshDismissed();
  }, [refreshDismissed]);

  const pollActiveRef = useRef(false);

  const fetchLive = useCallback(async () => {
    if (!isAuthenticated || hideForRoute) {
      setModel(null);
      return;
    }
    const token = String(
      user?.customerAccessToken ?? user?.accessToken ?? persistedAccessToken ?? '',
    ).trim();
    if (!token) {
      setModel(null);
      return;
    }

    let ordersConn: any;
    try {
      ordersConn = await shopifyApi.getCustomerOrders(token, 12);
    } catch {
      if (pollActiveRef.current) setModel(null);
      return;
    }
    const edges = ordersConn?.edges || [];
    const now = Date.now();

    const latestOrder = edges[0]?.node ?? null;
    if (!latestOrder) {
      if (pollActiveRef.current) setModel(null);
      return;
    }
    if (isOnlyTicketingOrderNode(latestOrder)) {
      if (pollActiveRef.current) setModel(null);
      return;
    }
    const latestProcessedMs = latestOrder.processedAt ? Date.parse(latestOrder.processedAt) : NaN;
    if (Number.isFinite(latestProcessedMs) && now - latestProcessedMs >= RECENT_ORDER_MAX_AGE_MS) {
      if (pollActiveRef.current) setModel(null);
      return;
    }

    const numericId = extractShopifyOrderNumericId(latestOrder.id);
    if (!numericId) {
      if (pollActiveRef.current) setModel(null);
      return;
    }

    let st: DeliveryPartnerOrderStatus | null = null;
    try {
      st = await getDeliveryPartnerOrderStatus(numericId);
    } catch {
      if (pollActiveRef.current) setModel(null);
      return;
    }
    if (!st) {
      if (pollActiveRef.current) setModel(null);
      return;
    }

    const phase = liveTabBannerPhaseFromPartnerStatus(st);
    if (phase == null) {
      if (pollActiveRef.current) setModel(null);
      return;
    }

    if (phase === 'delivered') {
      if (dismissedDeliveredIds.has(numericId)) {
        if (pollActiveRef.current) setModel(null);
        return;
      }
      const dm = st.deliveredAt ? Date.parse(String(st.deliveredAt)) : now;
      if (Number.isFinite(dm) && now - dm > DELIVERED_AUTO_HIDE_MS) {
        if (pollActiveRef.current) setModel(null);
        return;
      }
    }

    let fullOrder: any = latestOrder;
    if (phase === 'tracking' || phase === 'delivered') {
      try {
        const detailed = await shopifyApi.getOrderById(String(latestOrder.id));
        if (detailed) fullOrder = detailed;
      } catch {
        /* keep list node */
      }
    }

    let headerPrimary = '';
    if (phase === 'packing') {
      headerPrimary = 'Your order is getting packed';
    } else {
      const addr = shippingAddressString(fullOrder?.shippingAddress);
      let destinationCoords: { latitude: number; longitude: number } | null = null;
      if (addr) {
        try {
          destinationCoords = await geocodeAddress(addr);
        } catch {
          destinationCoords = null;
        }
      }
      const riderCoords = riderCoordsFromDeliveryStatus(st);
      const dk = String(st.status ?? '').trim().toLowerCase();
      const isOutForDelivery = dk === 'out_for_delivery';
      const nearDrop =
        isOutForDelivery &&
        !!riderCoords &&
        !!destinationCoords &&
        distanceMetersLatLng(riderCoords, destinationCoords) <= 110;
      const etaOrigin =
        isOutForDelivery && riderCoords
          ? riderCoords
          : !!destinationCoords
            ? DARK_STORE_LOCATION
            : null;
      const canUseLiveEta =
        DELIVERY_ACTIVE_STATUSES.has(dk) &&
        !!destinationCoords &&
        !!etaOrigin &&
        !nearDrop &&
        !ARRIVED_AT_CUSTOMER_STATUSES.has(dk);

      let liveEtaMinutes: number | null = null;
      if (canUseLiveEta && destinationCoords && etaOrigin) {
        try {
          const eta = await getDeliveryEta(destinationCoords.latitude, destinationCoords.longitude, {
            originLatitude: etaOrigin.latitude,
            originLongitude: etaOrigin.longitude,
          });
          liveEtaMinutes = eta?.etaMinutes ?? null;
        } catch {
          liveEtaMinutes = null;
        }
      }

      headerPrimary = computeDeliveryHeaderStatusText({
        order: fullOrder,
        paramEta: null,
        deliveryPartnerStatus: st,
        liveEtaMinutes,
        riderCoords,
        destinationCoords,
      });
    }

    if (!pollActiveRef.current) return;
    setModel({ phase, order: fullOrder, partnerStatus: st, headerPrimary });
  }, [
    isAuthenticated,
    user?.customerAccessToken,
    user?.accessToken,
    persistedAccessToken,
    hideForRoute,
    dismissedDeliveredIds,
  ]);

  const fetchGen = useRef(0);
  useEffect(() => {
    if (!showTabBar || !tabBarVisible || hideForRoute) {
      pollActiveRef.current = false;
      setModel(null);
      return;
    }
    pollActiveRef.current = true;
    let cancelled = false;
    const gen = ++fetchGen.current;
    const run = () => {
      if (cancelled || gen !== fetchGen.current) return;
      void fetchLive();
    };
    run();
    const t = setInterval(run, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => {
      cancelled = true;
      pollActiveRef.current = false;
      clearInterval(t);
      sub.remove();
    };
  }, [showTabBar, tabBarVisible, hideForRoute, fetchLive]);

  const visible = !!model && showTabBar && tabBarVisible && !hideForRoute;

  useEffect(() => {
    if (!visible) onStackOffsetChange(0);
  }, [visible, onStackOffsetChange]);

  const onLayoutBanner = useCallback(
    (e: LayoutChangeEvent) => {
      if (!visible) return;
      const h = e.nativeEvent.layout.height;
      onStackOffsetChange(Math.ceil(h) + 10);
    },
    [visible, onStackOffsetChange],
  );

  const subtitle = model ? formatItemsSubtitle(model.order) : '';

  const handleView = () => {
    if (!model?.order?.id) return;
    router.push({
      pathname: '/orders/[id]/v2',
      params: { id: encodeURIComponent(String(model.order.id)), from: 'tabs' },
    } as any);
  };

  const handleDismissDelivered = async () => {
    if (!model || model.phase !== 'delivered') return;
    const nid = extractShopifyOrderNumericId(model.order.id);
    if (!nid) return;
    try {
      await AsyncStorage.setItem(`${DISMISS_PREFIX}${nid}`, '1');
    } catch {
      /* ignore */
    }
    setDismissedDeliveredIds((prev) => new Set(prev).add(nid));
    setModel(null);
  };

  if (!visible || !model) {
    return null;
  }

  const showRiderImage = model.phase === 'packing' || model.phase === 'tracking';
  const showCheckImage = model.phase === 'delivered';

  return (
    <View
      style={[styles.wrap, { bottom: tabStackHeight + 10 }]}
      pointerEvents="box-none"
      onLayout={onLayoutBanner}
    >
      <View style={styles.pill}>
        <View style={styles.leftIcon}>
          {showRiderImage ? (
            <Image source={RIDER_ICON} style={styles.riderImg} contentFit="contain" />
          ) : showCheckImage ? (
            <Image source={ARRIVED_ICON} style={styles.arrivedImg} contentFit="contain" />
          ) : (
            <Image source={partnerUri} style={styles.riderImg} contentFit="cover" />
          )}
        </View>

        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={2}>
            {model.headerPrimary}
          </Text>
          {!!subtitle && (
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {model.phase === 'delivered' ? (
          <TouchableOpacity
            onPress={handleDismissDelivered}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Dismiss delivery notification"
          >
            <Ionicons name="close" size={22} color={Colors.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleView} style={styles.viewBtn} activeOpacity={0.85}>
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9998,
    elevation: 9998,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#111827',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  leftIcon: {
    width: 36,
    height: 36,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderImg: {
    width: 36,
    height: 36,
  },
  arrivedImg: {
    width: 36,
    height: 36,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: Fonts.SmallFontSize,
    fontFamily: Fonts.LexendMedium,
    color: Colors.light.text,
    lineHeight: 20,
  },
  sub: {
    marginTop: 2,
    fontSize: Fonts.ExtraSmallFontSize,
    fontFamily: Fonts.LexendMedium,
    color: '#6B7280',
  },
  viewBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  viewBtnText: {
    fontSize: 14,
    fontFamily: Fonts.SemiBold,
    color: Colors.primary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
