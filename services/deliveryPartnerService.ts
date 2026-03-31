import { configService } from './configService';

const PRODUCTION_BACKEND_URL = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';

function getBackendBase(): string {
  const raw = configService.getRawConfig();
  const base = raw?.providers?.backend?.baseUrl || PRODUCTION_BACKEND_URL;
  return String(base).replace(/\/+$/, '');
}

function getApiPath(path: string): string {
  const base = getBackendBase();
  const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  return `${prefix}/${path.replace(/^\//, '')}`;
}

export interface AssignedDeliveryPartner {
  name: string | null;
  contact: string | null;
}

export interface DeliveryPartnerOrderStatus {
  shopifyOrderId: string;
  status: string;
  deliveryPartner: AssignedDeliveryPartner;
}

export async function getDeliveryPartnerOrderStatus(
  shopifyOrderId: string,
): Promise<DeliveryPartnerOrderStatus | null> {
  const normalized = String(shopifyOrderId || '').trim();
  if (!normalized) return null;

  try {
    const response = await fetch(getApiPath(`orders/${encodeURIComponent(normalized)}/delivery-status`));
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as DeliveryPartnerOrderStatus;
  } catch (error) {
    console.error('Error fetching delivery partner status:', error);
    return null;
  }
}
