// Nector API Configuration
export const NECTOR_READ_ONLY_API_KEY = process.env.EXPO_PUBLIC_NECTOR_API_KEY ?? '';
export const NECTOR_WORKSPACE_ID = process.env.EXPO_PUBLIC_NECTOR_WORKSPACE_ID ?? '';
export const NECTOR_BASE_URL = 'https://platform.nector.io/api/v2/merchant';
export const NECTOR_LEAD_ID = process.env.EXPO_PUBLIC_NECTOR_LEAD_ID ?? '';
// App ID - using workspace ID as app identifier
export const NECTOR_APP_ID = process.env.EXPO_PUBLIC_NECTOR_WORKSPACE_ID ?? '';
// App Install Trigger ID (optional - set if you have app install reward configured)
export const NECTOR_APP_INSTALL_TRIGGER_ID = null; // Set this if you have an app install trigger configured
// Razorpay Magic Checkout Secret ID from Nector
export const NECTOR_RAZORPAY_SECRET_ID = process.env.EXPO_PUBLIC_NECTOR_RAZORPAY_SECRET_ID ?? '';
