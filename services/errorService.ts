import crashlytics from '@react-native-firebase/crashlytics';

/**
 * Cleanly integrates Google Crashlytics for error reporting.
 * Includes safety checks to prevent crashes if the native module is missing.
 */
export const errorService = {
  /**
   * Helper to safely access crashlytics
   */
  get instance() {
    try {
      return crashlytics();
    } catch (e) {
      return null;
    }
  },

  /**
   * Logs a non-fatal error to Crashlytics.
   * @param error - The error object or message
   * @param context - Optional context information
   */
  logError(error: any, context?: Record<string, any>): void {
    if (__DEV__) {
      console.error('[ErrorService]', error, context);
    }

    const instance = this.instance;
    if (!instance) return;

    try {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          instance.setAttribute(key, String(value));
        });
      }
      
      instance.recordError(errorObj);
    } catch (e) {
      if (__DEV__) {
        console.warn('[ErrorService] Failed to log to Crashlytics:', e);
      }
    }
  },

  /**
   * Logs a breadcrumb message to Crashlytics.
   */
  logBreadcrumb(message: string): void {
    const instance = this.instance;
    if (!instance) return;

    try {
      instance.log(message);
    } catch (e) {
      // Ignore
    }
  },

  /**
   * Sets user information for Crashlytics.
   */
  setUserInfo(userId: string, email?: string): void {
    const instance = this.instance;
    if (!instance) return;

    try {
      instance.setUserId(userId);
      if (email) {
        instance.setAttribute('email', email);
      }
    } catch (e) {
      // Ignore
    }
  },

  /**
   * Forces a native crash to verify Crashlytics integration.
   * WARNING: This will kill the app.
   */
  crash(): void {
    const instance = this.instance;
    if (instance) {
      instance.crash();
    }
  },
};
