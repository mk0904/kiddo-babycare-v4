import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ReferralAttributionState {
  /** Referral code from AppsFlyer UDL / invite link, pending until login screen consumes it */
  pendingReferralCode: string | null;
  setPendingReferralCode: (code: string) => void;
  /** Read and clear — used when login screen auto-fills the field */
  consumePendingReferralCode: () => string | null;
  clearPendingReferralCode: () => void;
}

export const useReferralAttributionStore = create<ReferralAttributionState>()(
  persist(
    (set, get) => ({
      pendingReferralCode: null,
      setPendingReferralCode: (code: string) => {
        const trimmed = code.trim();
        if (!trimmed) return;
        set({ pendingReferralCode: trimmed });
      },
      consumePendingReferralCode: () => {
        const code = get().pendingReferralCode;
        if (code) set({ pendingReferralCode: null });
        return code;
      },
      clearPendingReferralCode: () => set({ pendingReferralCode: null }),
    }),
    {
      name: 'referral_attribution_v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ pendingReferralCode: state.pendingReferralCode }),
    },
  ),
);
