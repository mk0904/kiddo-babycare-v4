import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { appConfigService } from '@/services/appConfigService';
import {
    getDeliveryPartnerOrderStatus,
    getExternalOrderStatus,
    liveTabBannerPhaseFromPartnerStatus,
    type DeliveryPartnerOrderStatus,
    type ExternalOrderStatusResponse,
    type LiveTabBannerPhase
} from '@/services/deliveryPartnerService';
import { shopifyApi } from '@/services/shopifyApi';
import { useUserStore } from '@/store/userStore';
import type { OrderDetailConfig } from '@/types/appConfig';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AppState,
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';

const RIDER_ICON = require('@/assets/icons/riderIcon.png');
const ARRIVED_ICON = require('@/assets/icons/arrivedIcon.png');
const PARTNER_FALLBACK = require('@/assets/icons/partnerIcon.png');

const DEFAULT_POLL_FAST_MS = 25000;
const DEFAULT_POLL_SLOW_MS = 25000;
const DEFAULT_POLL_FAST_WINDOW_MS = 60000;
/**
 * Pixels to sit the delivery pill closer to the tab stack (subtracted from `bottom`).
 * Same value is subtracted from floating View cart + scroll-to-top `anchorExtraOffset` (`TabBar`, Home).
 */
export const LIVE_DELIVERY_DOWNSET_PX = 40;
const DISMISS_PREFIX = '@kiddo/liveTabDismissed:';
const DELIVERED_AUTO_HIDE_MS = 48 * 60 * 60 * 1000;
const RECENT_ORDER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_START_MS = Date.now();

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

/** Check if an order is a demo booking by line item or order custom attributes */
function isDemoOrderNode(o: any): boolean {
  const DEMO_ORDER_ATTR_KEYS = ['isDemoOrder', 'demo_request'];
  const orderAttrs = o?.customAttributes || [];
  if (
    orderAttrs.some(
      (a: any) =>
        DEMO_ORDER_ATTR_KEYS.includes(a.key) && String(a.value).toLowerCase() === 'true',
    )
  ) {
    return true;
  }
  const edges = o?.lineItems?.edges || [];
  return edges.some((edge: any) => {
    const attrs = edge?.node?.customAttributes || [];
    return attrs.some(
      (a: any) => a.key === 'demo_request' && String(a.value).toLowerCase() === 'true',
    );
  });
}

const isScheduledOrder = (order: any, dps?: any): boolean => {
  return order?.deliveryType === 'scheduled' || 
         !!(order?.scheduledDate && order?.scheduledTime) ||
         !!(order?.deliverySchedule?.date && order?.deliverySchedule?.time) ||
         dps?.is_scheduled_order === true || 
         !!(dps?.scheduled_date && dps?.scheduled_time);
};

const getScheduledTimeForBanner = (order: any, dps?: any): string | null => {
  return dps?.scheduled_time || order?.scheduledTime || order?.deliverySchedule?.time || null;
};


type BannerModel = {
  phase: LiveTabBannerPhase;
  order: any;
  partnerStatus: DeliveryPartnerOrderStatus;
  limechatStatus?: ExternalOrderStatusResponse | null;
  headerPrimary: string;
};

export interface LiveDeliveryTabBannerProps {
  showTabBar: boolean;
  /** Tab bar row + home indicator (`TabBar` `totalHeight`). */
  tabStackHeight: number;
  onStackOffsetChange: (extraPx: number) => void;
  /**
   * Extra `bottom` offset so the pill clears the home milestone strip (same stack order as View cart).
   * Supplied by TabBar when Home tab + tab bar visible.
   */
  milestoneStripBottomReserve?: number;
}

export function LiveDeliveryTabBanner({
  showTabBar,
  tabStackHeight,
  onStackOffsetChange,
  milestoneStripBottomReserve = 0,
}: LiveDeliveryTabBannerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const persistedAccessToken = useUserStore((s) => s.accessToken);
  const { isVisible: tabBarVisible } = useTabBarVisibility();
  const [model, setModel] = useState<BannerModel | null>(null);
  const [seenOrderIdsInSession] = useState(() => new Set<string>());
  const [dismissedStateKeys, setDismissedStateKeys] = useState<Set<string>>(() => new Set());
  const [isDismissLoaded, setIsDismissLoaded] = useState(false);
  const cfg = useMemo(() => appConfigService.getOrderDetailConfig(), []);
  const pollingConfig = useMemo(() => appConfigService.getOrderSummaryConfig()?.pollingConfig, []);

  const pollFastMs = pollingConfig?.deliveryStatusPollFastMs ?? DEFAULT_POLL_FAST_MS;
  const pollSlowMs = pollingConfig?.deliveryStatusPollSlowMs ?? DEFAULT_POLL_SLOW_MS;
  const pollFastWindowMs = pollingConfig?.deliveryStatusPollFastWindowMs ?? DEFAULT_POLL_FAST_WINDOW_MS;

  const { width: windowWidth } = useWindowDimensions();
  const pillWidth = Math.min(368, windowWidth - 32);

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
      setDismissedStateKeys(next);
    } catch {
      setDismissedStateKeys(new Set());
    } finally {
      setIsDismissLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshDismissed();
  }, [refreshDismissed]);

  const pollActiveRef = useRef(false);

  const fetchLive = useCallback(async () => {
    if (!isAuthenticated || hideForRoute || !isDismissLoaded) {
      console.log('[LiveDeliveryTabBanner] Hiding because: isAuthenticated=', isAuthenticated, 'hideForRoute=', hideForRoute, 'isDismissLoaded=', isDismissLoaded);
      setModel(null);
      return;
    }
    const token = String(
      user?.customerAccessToken ?? user?.accessToken ?? persistedAccessToken ?? '',
    ).trim();
    if (!token) {
      console.log('[LiveDeliveryTabBanner] Hiding because: No token');
      setModel(null);
      return;
    }

    let ordersConn: any;
    try {
      ordersConn = await shopifyApi.getCustomerOrders(token, 12);
    } catch (err) {
      if ((err as any)?.message === 'UNAUTHORIZED_CUSTOMER') {
        console.warn('[LiveDeliveryTabBanner] Token expired or invalid, forcing logout');
        logout();
      }
      if (pollActiveRef.current) {
        console.log('[LiveDeliveryTabBanner] Hiding because: fetch orders failed', err);
        setModel(null);
      }
      return;
    }
    const edges = ordersConn?.edges || [];
    const now = Date.now();

    const latestOrder = edges[0]?.node ?? null;
    if (!latestOrder) {
      if (pollActiveRef.current) {
        console.log('[LiveDeliveryTabBanner] Hiding because: No latest order');
        setModel(null);
      }
      return;
    }
    if (isOnlyTicketingOrderNode(latestOrder)) {
      if (pollActiveRef.current) {
        console.log('[LiveDeliveryTabBanner] Hiding because: Only ticketing order');
        setModel(null);
      }
      return;
    }
    if (isDemoOrderNode(latestOrder)) {
      if (pollActiveRef.current) {
        console.log('[LiveDeliveryTabBanner] Hiding because: Demo order');
        setModel(null);
      }
      return;
    }
    const latestProcessedMs = latestOrder.processedAt ? Date.parse(latestOrder.processedAt) : NaN;
    if (Number.isFinite(latestProcessedMs) && now - latestProcessedMs >= RECENT_ORDER_MAX_AGE_MS) {
      if (pollActiveRef.current) {
        console.log('[LiveDeliveryTabBanner] Hiding because: Order too old');
        setModel(null);
      }
      return;
    }

    const numericId = extractShopifyOrderNumericId(latestOrder.id);
    if (!numericId) {
      if (pollActiveRef.current) setModel(null);
      return;
    }
    const orderIsNewInSession = !seenOrderIdsInSession.has(numericId);

    let st: DeliveryPartnerOrderStatus | null = null;
    let extSt: ExternalOrderStatusResponse | null = null;
    try {
      [st, extSt] = await Promise.all([
        getDeliveryPartnerOrderStatus(numericId),
        getExternalOrderStatus(numericId)
      ]);
    } catch {
      if (pollActiveRef.current) setModel(null);
      return;
    }
    if (!st) {
      if (pollActiveRef.current) setModel(null);
      return;
    }

    if (st.isEventOrder === true) {
      if (pollActiveRef.current) setModel(null);
      return;
    }

    const phase = liveTabBannerPhaseFromPartnerStatus(st);
    if (phase == null) {
      if (pollActiveRef.current) setModel(null);
      return;
    }

    const stateKey = `${numericId}:${phase}`;
    if (dismissedStateKeys.has(stateKey)) {
      if (pollActiveRef.current) {
        console.log('[LiveDeliveryTabBanner] Hiding because: dismissed');
        setModel(null);
      }
      return;
    }

    if (phase === 'delivered') {
      const dm = st.deliveredAt ? Date.parse(String(st.deliveredAt)) : NaN;
      /**
       * Delivered orders should only be visible if:
       * 1. They were delivered during THIS session (dm >= SESSION_START_MS)
       * 2. OR they transitioned to delivered while we were watching them (not orderIsNewInSession)
       */
      const isOldDelivery = Number.isFinite(dm) && dm < SESSION_START_MS;
      const wasDeliveredBeforeSessionStart = orderIsNewInSession && (isOldDelivery || Number.isNaN(dm));

      // if (wasDeliveredBeforeSessionStart) {
      //   if (pollActiveRef.current) {
      //     console.log('[LiveDeliveryTabBanner] Hiding because: old delivery');
      //     setModel(null);
      //   }
      //   return;
      // }
    }

    // Mark active orders as seen in session so we can show their transition to 'delivered' later
    if (phase === 'tracking' || phase === 'packing') {
      seenOrderIdsInSession.add(numericId);
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

    const scheduled = isScheduledOrder(fullOrder, st);
    const scheduledTime = getScheduledTimeForBanner(fullOrder, st);

    if (scheduled && phase === 'packing') {
      headerPrimary = `Your order has been scheduled for ${scheduledTime || 'your selected time'}`;
    }

    if (!headerPrimary) {
      if (phase === 'packing') {
        headerPrimary = 'Your order is getting packed';
      } else if (phase === 'tracking') {
        headerPrimary = 'Your delivery partner is out for delivery';
      } else if (phase === 'delivered') {
        headerPrimary = 'Your order has been delivered';
      }
    }

    if (!pollActiveRef.current) return;
    setModel({ phase, order: fullOrder, partnerStatus: st, limechatStatus: extSt, headerPrimary });
  }, [
    isAuthenticated,
    user?.customerAccessToken,
    user?.accessToken,
    persistedAccessToken,
    hideForRoute,
    dismissedStateKeys,
    isDismissLoaded,
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
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const fastWindowEnd = Date.now() + pollFastWindowMs;

    const gen = ++fetchGen.current;

    const tick = async () => {
      if (cancelled || gen !== fetchGen.current) return;
      await fetchLive();
      if (cancelled || gen !== fetchGen.current) return;

      const interval = Date.now() < fastWindowEnd ? pollFastMs : pollSlowMs;
      timerId = setTimeout(tick, interval);
    };

    tick();

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && !timerId) tick();
    });

    return () => {
      cancelled = true;
      pollActiveRef.current = false;
      if (timerId) clearTimeout(timerId);
      sub.remove();
    };
  }, [showTabBar, tabBarVisible, hideForRoute, fetchLive, pollFastMs, pollSlowMs, pollFastWindowMs]);

  const visible = !!model && showTabBar && tabBarVisible && !hideForRoute;

  useEffect(() => {
    if (!visible) onStackOffsetChange(0);
  }, [visible, onStackOffsetChange]);

  const onLayoutBanner = useCallback(
    (e: LayoutChangeEvent) => {
      if (!visible) return;
      const h = e.nativeEvent.layout.height;
      onStackOffsetChange(Math.ceil(h) + 32);
    },
    [visible, onStackOffsetChange],
  );


  const handleView = () => {
    if (!model?.order?.id) return;
    router.push({
      pathname: '/orders/[id]/v2',
      params: { id: encodeURIComponent(String(model.order.id)), from: 'tabs' },
    } as any);
  };

  const handleDismiss = async () => {
    if (!model) return;
    const nid = extractShopifyOrderNumericId(model.order.id);
    if (!nid) return;
    const stateKey = `${nid}:${model.phase}`;
    try {
      await AsyncStorage.setItem(`${DISMISS_PREFIX}${stateKey}`, '1');
    } catch {
      /* ignore */
    }
    setDismissedStateKeys((prev) => new Set(prev).add(stateKey));
    setModel(null);
  };

  if (!visible || !model) {
    return null;
  }

  const showRiderImage = model.phase === 'packing' || model.phase === 'tracking';
  const showCheckImage = model.phase === 'delivered';

  const pillBottom =
    tabStackHeight + milestoneStripBottomReserve + 8;

  return (
    <View
      style={[styles.wrap, { bottom: pillBottom, width: pillWidth, left: (windowWidth - pillWidth) / 2 }]}
      pointerEvents="box-none"
      onLayout={onLayoutBanner}
    >
      <TouchableOpacity style={styles.pill} onPress={handleView} activeOpacity={0.9}>
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
        </View>

        <TouchableOpacity onPress={handleView} style={styles.viewBtn}>
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Dismiss delivery notification"
        >
          <Ionicons name="close" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
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
    fontFamily: Fonts.LexendSemiBold,
    color: Colors.light.text,
    lineHeight: 20,
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
    fontFamily: Fonts.LexendSemiBold,
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
