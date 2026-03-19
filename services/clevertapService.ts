/**
 * CleverTap in-app events and profile.
 * All events from mixpanelHelpers are also sent here so CleverTap has full coverage.
 * Safe no-op when clevertap-react-native is not installed or not initialized.
 */
let CleverTap: any = null;

try {
  const ct = require('clevertap-react-native');
  CleverTap = ct?.default ?? ct;
} catch {
  // SDK not installed or not linked; all methods no-op
}

function getCT(): any {
  return CleverTap ?? null;
}

export const clevertapService = {
  recordEvent(eventName: string, properties?: Record<string, any>): void {
    try {
      const ct = getCT();
      if (!ct?.recordEvent) return;
      if (properties && Object.keys(properties).length > 0) {
        ct.recordEvent(eventName, properties);
      } else {
        ct.recordEvent(eventName);
      }
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] recordEvent error:', e);
    }
  },

  onUserLogin(profile: {
    Identity?: string;
    Email?: string;
    Phone?: string;
    Name?: string;
    [k: string]: any;
  }): void {
    try {
      const ct = getCT();
      if (!ct?.onUserLogin) return;
      ct.onUserLogin(profile);
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] onUserLogin error:', e);
    }
  },

  logout(): void {
    try {
      const ct = getCT();
      if (ct?.logout) ct.logout();
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] logout error:', e);
    }
  },

  /**
   * CleverTap Charged event for revenue (order/payment). Call once per successful order.
   */
  recordCharged(
    orderId: string,
    amount: number,
    itemCount: number,
    paymentMethod?: string,
    currency: string = 'INR'
  ): void {
    try {
      const ct = getCT();
      if (!ct?.recordChargedEvent) return;
      const chargeDetails: Record<string, any> = {
        totalValue: amount,
        orderId,
        currency,
        itemCount,
      };
      if (paymentMethod) chargeDetails.paymentMethod = paymentMethod;
      ct.recordChargedEvent(chargeDetails, []);
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] recordCharged error:', e);
    }
  },
};
