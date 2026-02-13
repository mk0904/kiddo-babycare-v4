// AuthContext - Bridge between React Context and Zustand store
// Provides backward compatibility while using the new userStore

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useUserStore, selectUser, selectIsAuthenticated, selectAuthStatus, selectIsGuest, selectHasSkippedLogin, UserProfile } from '@/store/userStore';
import { Customer } from '@/services/customerService';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  hasSkippedLogin: boolean;
  login: (userData: Customer, accessToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  skipLogin: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Use Zustand store
  const user = useUserStore(selectUser);
  const isAuthenticated = useUserStore(selectIsAuthenticated);
  const isGuest = useUserStore(selectIsGuest);
  const hasSkippedLogin = useUserStore(selectHasSkippedLogin);
  const status = useUserStore(selectAuthStatus);
  const storeLogin = useUserStore(state => state.login);
  const storeLogout = useUserStore(state => state.logout);
  const storeSkipLogin = useUserStore(state => state.skipLogin);

  // Fix stuck 'idle'/'loading' status - if AsyncStorage rehydration hangs, force unauthenticated
  React.useEffect(() => {
    if (status === 'idle' || status === 'loading') {
      // Shorter timeout for faster recovery (1.5 seconds)
      const timeout = setTimeout(() => {
        const currentStatus = useUserStore.getState().status;
        if (currentStatus === 'idle' || currentStatus === 'loading') {
          console.warn('⚠️ Auth status stuck in idle/loading - forcing unauthenticated');
          useUserStore.setState({ status: 'unauthenticated' });
        }
      }, 1500); // 1.5 second timeout (faster recovery)

      return () => clearTimeout(timeout);
    }
  }, [status]);

  // Determine loading state - only show loading if actively loading, not if stuck in idle
  // If status is 'idle' for more than 1.5s, it's likely stuck, so don't show loading
  const loading = status === 'loading'; // Only show loading for active loading, not idle

  // Bridge login function
  const login = async (userData: Customer, accessToken?: string) => {
    await storeLogin(userData as UserProfile, accessToken);
  };

  // Bridge logout function
  const logout = async () => {
    await storeLogout();
  };

  // Bridge skip login function
  const skipLogin = () => {
    storeSkipLogin();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isGuest,
        hasSkippedLogin,
        login,
        logout,
        skipLogin,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Re-export store for direct access when needed
export { useUserStore } from '@/store/userStore';
