import { getBackendApiPath, getBackendBase } from './backendBase';

export interface AssignedDeliveryPartner {
  name: string | null;
  contact: string | null;
}

export interface DeliveryPartnerOrderStatus {
  shopifyOrderId: string;
  status: string;
  deliveryPartner: AssignedDeliveryPartner;
}

export type DeliveryTrackingMessage =
  | { type: 'location'; lat?: number; lng?: number; timestamp?: string | number; riderOnline?: boolean }
  | { type: 'rider_online'; lat?: number | null; lng?: number | null; timestamp?: string | number | null }
  | { type: 'rider_offline' }
  | { type: 'order_delivered' }
  | { type: 'rider_assigned'; riderId?: string };

export type DeliveryTrackingHandlers = {
  onMessage: (message: DeliveryTrackingMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: unknown) => void;
};

function getDeliveryTrackingWsUrl(shopifyOrderId: string, accessToken: string): string {
  const base = getBackendBase().replace(/\/+$/, '');
  const wsBase = base.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  const prefix = wsBase.endsWith('/api/v1') ? wsBase : `${wsBase}/api/v1`;
  return `${prefix}/orders/${encodeURIComponent(shopifyOrderId)}/live-location/ws?access_token=${encodeURIComponent(accessToken)}`;
}

export async function getDeliveryPartnerOrderStatus(
  shopifyOrderId: string,
): Promise<DeliveryPartnerOrderStatus | null> {
  const normalized = String(shopifyOrderId || '').trim();
  if (!normalized) return null;

  try {
    const response = await fetch(getBackendApiPath(`orders/${encodeURIComponent(normalized)}/delivery-status`));
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as DeliveryPartnerOrderStatus;
  } catch (error) {
    console.error('Error fetching delivery partner status:', error);
    return null;
  }
}

export function subscribeToDeliveryTracking(
  shopifyOrderId: string,
  accessToken: string,
  handlers: DeliveryTrackingHandlers,
): () => void {
  const normalizedOrderId = String(shopifyOrderId || '').trim();
  const normalizedToken = String(accessToken || '').trim();
  if (!normalizedOrderId || !normalizedToken) {
    return () => {};
  }

  const socket = new WebSocket(getDeliveryTrackingWsUrl(normalizedOrderId, normalizedToken));

  socket.onopen = () => {
    handlers.onOpen?.();
  };
  socket.onerror = (error) => {
    handlers.onError?.(error);
  };
  socket.onclose = () => {
    handlers.onClose?.();
  };
  socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(String(event.data || '{}')) as DeliveryTrackingMessage;
      handlers.onMessage(parsed);
    } catch (error) {
      handlers.onError?.(error);
    }
  };

  return () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  };
}
