// AuthContext - Bridge between React Context and Zustand store
// Provides backward compatibility while using the new userStore

import { Customer } from '@/services/customerService';
import { selectAuthStatus, selectHasRehydrated, selectHasSkippedLogin, selectIsAuthenticated, selectIsGuest, selectUser, UserProfile, useUserStore } from '@/store/userStore';
import React, { createContext, ReactNode, useContext } from 'react';

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
  const hasRehydrated = useUserStore(selectHasRehydrated);
  const storeLogin = useUserStore(state => state.login);
  const storeLogout = useUserStore(state => state.logout);
  const storeSkipLogin = useUserStore(state => state.skipLogin);

  // Show loading until rehydration completes - prevents false redirect to login on cold start
  // Only after we've read auth state from AsyncStorage can we safely make routing decisions
  const loading = !hasRehydrated || status === 'loading';

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
