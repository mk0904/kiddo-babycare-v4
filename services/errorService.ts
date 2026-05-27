/**
 * Error reporting service.
 */
export const errorService = {
  /**
   * Logs a non-fatal error.
   * @param error - The error object or message
   * @param context - Optional context information
   */
  logError(error: any, context?: Record<string, any>): void {
    if (__DEV__) {
      console.error('[ErrorService]', error, context);
    }
  },

  /**
   * Logs a breadcrumb message.
   */
  logBreadcrumb(message: string): void {
    // Ignore
  },

  /**
   * Sets user information.
   */
  setUserInfo(userId: string, email?: string): void {
    // Ignore
  },

  /**
   * Forces a crash to verify integration.
   */
  crash(): void {
    // Ignore
  },
};
