import { AUTH_SCHEMA_VERSION } from '@/constants/versionConfig';
import useCheckoutStore from '@/store/checkoutStore';
import { useCartStore } from '@/store/cartStore';
import useUserStore, { getCachedRehydratedUserState, selectHasRehydrated } from '@/store/userStore';
import React, { useEffect, useRef } from 'react';

/**
 * Runs after user store rehydration. Uses the raw persisted state that was
 * cached during rehydration (before Zustand merged it with initial state), so we
 * detect old sessions saved before authSchemaVersion existed. If stored schema is
 * older than current, forces logout and clears checkout/cart.
 */
export function ForceReloginCheck() {
  const hasRehydrated = useUserStore(selectHasRehydrated);
  const didCheck = useRef(false);

  useEffect(() => {
    if (!hasRehydrated || didCheck.current) return;
    didCheck.current = true;

    const rawState = getCachedRehydratedUserState();
    const storedSchema =
      rawState != null && typeof rawState.authSchemaVersion === 'number'
        ? rawState.authSchemaVersion
        : 0;

    if (storedSchema < AUTH_SCHEMA_VERSION) {
      useUserStore.getState().logout();
      useCheckoutStore.getState().reset();
      useCartStore.getState().clearCart();
    }
  }, [hasRehydrated]);

  return null;
}
