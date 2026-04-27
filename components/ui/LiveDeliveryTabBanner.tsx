import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { appConfigService } from '@/services/appConfigService';
import {
  getDeliveryPartnerOrderStatus,
  liveTabBannerPhaseFromPartnerStatus,
  type DeliveryPartnerOrderStatus,
  type LiveTabBannerPhase
} from '@/services/deliveryPartnerService';
import { shopifyApi } from '@/services/shopifyApi';
import { useUserStore } from '@/store/userStore';
import type { OrderDetailConfig } from '@/types/appConfig';
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

const POLL_MS = 25_000;
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
  const { user, isAuthenticated } = useAuth();
  const persistedAccessToken = useUserStore((s) => s.accessToken);
  const { isVisible: tabBarVisible } = useTabBarVisibility();
  const [model, setModel] = useState<BannerModel | null>(null);
  const [seenOrderIdsInSession] = useState(() => new Set<string>());
  const [dismissedStateKeys, setDismissedStateKeys] = useState<Set<string>>(() => new Set());
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
      setDismissedStateKeys(next);
    } catch {
      setDismissedStateKeys(new Set());
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
    const orderIsNewInSession = !seenOrderIdsInSession.has(numericId);

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
      if (pollActiveRef.current) setModel(null);
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

      if (wasDeliveredBeforeSessionStart) {
        if (pollActiveRef.current) setModel(null);
        return;
      }
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
    if (phase === 'packing') {
      headerPrimary = 'Your order is getting packed';
    } else if (phase === 'tracking') {
      headerPrimary = 'Your delivery partner is out for delivery';
    } else if (phase === 'delivered') {
      headerPrimary = 'Your order has been delivered';
    }

    if (!pollActiveRef.current) return;
    setModel({ phase, order: fullOrder, partnerStatus: st, headerPrimary });
  }, [
    isAuthenticated,
    user?.customerAccessToken,
    user?.accessToken,
    persistedAccessToken,
    hideForRoute,
    dismissedStateKeys,
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
      style={[styles.wrap, { bottom: pillBottom }]}
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
