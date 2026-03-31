import { getBackendApiPath } from './backendBase';

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
