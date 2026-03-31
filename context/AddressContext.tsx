import { customerService } from '@/services/customerService';
import { shopifyApi } from '@/services/shopifyApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';

export interface Address {
    id: string;
    shopifyId?: string;
    name: string;
    firstName: string;
    lastName: string;
    phone: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    state: string;
    zip: string;
    pincode: string;
    country: string;
    tag: 'home' | 'work' | 'other' | 'events';
    isDefault: boolean;
    latitude?: number;
    longitude?: number;
}

export type AddressTag = Address['tag'];

/** Map our tag to addressType value (Home/Work/Other/Events) for backend and for Shopify. */
export function tagToAddressType(tag: AddressTag): string {
  const m: Record<AddressTag, string> = { home: 'Home', work: 'Work', other: 'Other', events: 'Events' };
  return m[tag] ?? 'Home';
}

/** Map addressType value from Shopify response back to our tag when loading addresses. */
function addressTypeToTag(value: string | null | undefined): AddressTag {
  const s = (value ?? '').trim().toLowerCase();
  if (s === 'work') return 'work';
  if (s === 'other') return 'other';
  if (s === 'events') return 'events';
  return 'home';
}

/** Shopify Customer Address API uses this key for address type; we send our addressType value here. */
const SHOPIFY_ADDRESS_TYPE_KEY = 'company' as const;
const SHOPIFY_ADDRESS_GEO_PREFIX = 'kiddo_geo:';

function encodeShopifyAddressType(tag: AddressTag, latitude?: number, longitude?: number): string {
    const base = tagToAddressType(tag);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return base;
    return `${base} | ${SHOPIFY_ADDRESS_GEO_PREFIX}${latitude},${longitude}`;
}

function parseShopifyAddressType(value: string | null | undefined): { tag: AddressTag; latitude?: number; longitude?: number } {
    const raw = (value ?? '').trim();
    if (!raw) return { tag: 'home' };

    const [tagPart, ...rest] = raw.split('|').map((part) => part.trim()).filter(Boolean);
    const tag = addressTypeToTag(tagPart || raw);
    const geoPart = rest.find((part) => part.startsWith(SHOPIFY_ADDRESS_GEO_PREFIX));
    if (!geoPart) return { tag };

    const coords = geoPart.slice(SHOPIFY_ADDRESS_GEO_PREFIX.length).split(',').map((part) => Number(part.trim()));
    const [latitude, longitude] = coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { tag };

    return { tag, latitude, longitude };
}

export type DetectedLocationStatus = 'idle' | 'loading' | 'serviceable' | 'unserviceable' | 'denied' | 'error';

interface AddressContextType {
    addresses: Address[];
    defaultAddress: Address | null;
    loading: boolean;
    /** Set by home when auto-detecting location (no saved address). Cart uses this to show "Area unserviceable" instead of default ETA. */
    detectedLocationStatus: DetectedLocationStatus;
    detectedEta: number | null;
    setDetectedLocation: (status: DetectedLocationStatus, eta?: number | null) => void;
    addAddress: (addressData: Partial<Address>) => Promise<Address>;
    updateAddress: (addressId: string, addressData: Partial<Address>) => Promise<void>;
    deleteAddress: (addressId: string) => Promise<void>;
    setDefaultAddressById: (addressId: string) => Promise<void>;
    loadAddresses: () => Promise<void>;
}

const AddressContext = createContext<AddressContextType | undefined>(undefined);

export const useAddress = () => {
    const context = useContext(AddressContext);
    if (!context) {
        throw new Error('useAddress must be used within an AddressProvider');
    }
    return context;
};

export const AddressProvider = ({ children }: { children: ReactNode }) => {
    const { user, updateUser } = useAuth();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
    const [loading, setLoading] = useState(true);
    const [detectedLocationStatus, setDetectedLocationStatus] = useState<DetectedLocationStatus>('idle');
    const [detectedEta, setDetectedEta] = useState<number | null>(null);

    const setDetectedLocation = useCallback((status: DetectedLocationStatus, eta?: number | null) => {
        setDetectedLocationStatus(status);
        setDetectedEta(eta ?? null);
    }, []);

    useEffect(() => {
        loadAddresses();
    }, [user]);

    const loadAddresses = useCallback(async () => {
        try {
            setLoading(true);

            // First, try to fetch from Shopify if user is logged in
            const customerAccessToken = user?.customerAccessToken;

            if (customerAccessToken) {
                try {
                    const result = await shopifyApi.getCustomerAddresses(customerAccessToken, 50);

                    if (result && result.addresses && result.addresses.length > 0) {
                        // Transform Shopify addresses to our format
                        const formattedAddresses: Address[] = result.addresses.map((addr: any) => {
                            const parsedMeta = parseShopifyAddressType((addr as any)[SHOPIFY_ADDRESS_TYPE_KEY]);
                            return {
                                id: addr.id,
                                shopifyId: addr.id,
                                firstName: addr.firstName || '',
                                lastName: addr.lastName || '',
                                name: [addr.firstName, addr.lastName].filter((p) => p && p.trim() !== '_').join(' ').trim() || 'Address',
                                address1: addr.address1 || '',
                                address2: addr.address2 || '',
                                city: addr.city || '',
                                province: addr.province || '',
                                state: addr.province || '',
                                zip: addr.zip || '',
                                pincode: addr.zip || '',
                                country: addr.country || 'India',
                                tag: parsedMeta.tag,
                                phone: addr.phone || '',
                                isDefault: result.defaultAddress?.id === addr.id,
                                latitude: parsedMeta.latitude,
                                longitude: parsedMeta.longitude,
                            };
                        });

                        // Save to AsyncStorage for offline access
                        await AsyncStorage.setItem('user_addresses', JSON.stringify(formattedAddresses));

                        // Set default address
                        if (result.defaultAddress) {
                            const defaultAddr = formattedAddresses.find(addr => addr.id === result.defaultAddress.id);
                            if (defaultAddr) {
                                setDefaultAddress(defaultAddr);
                                await AsyncStorage.setItem('default_address_id', defaultAddr.id);
                            } else if (formattedAddresses.length > 0) {
                                // Fallback to first address if default not found
                                const firstAddr = formattedAddresses[0];
                                setDefaultAddress(firstAddr);
                                await AsyncStorage.setItem('default_address_id', firstAddr.id);
                            }
                        } else if (formattedAddresses.length > 0) {
                            // If no default set, use first address
                            const firstAddr = formattedAddresses[0];
                            setDefaultAddress(firstAddr);
                            await AsyncStorage.setItem('default_address_id', firstAddr.id);
                        }

                        setAddresses(formattedAddresses);
                        return;
                    }
                } catch (shopifyError) {
                    console.log('Error fetching addresses from Shopify, falling back to local:', shopifyError);
                    // Fall through to load from AsyncStorage
                }
            }

            // Fallback: Load addresses from AsyncStorage
            const storedAddresses = await AsyncStorage.getItem('user_addresses');
            const storedDefault = await AsyncStorage.getItem('default_address_id');

            if (storedAddresses) {
                const parsedAddresses = JSON.parse(storedAddresses) as Address[];
                setAddresses(parsedAddresses);

                // Find default address
                if (storedDefault) {
                    const defaultAddr = parsedAddresses.find(addr => addr.id === storedDefault);
                    setDefaultAddress(defaultAddr || null);
                } else if (parsedAddresses.length > 0) {
                    // If no default set, use first address
                    const firstAddr = parsedAddresses[0];
                    setDefaultAddress(firstAddr);
                    await AsyncStorage.setItem('default_address_id', firstAddr.id);
                }
            } else {
                setAddresses([]);
                setDefaultAddress(null);
            }
        } catch (error) {
            console.error('Error loading addresses:', error);
            setAddresses([]);
            setDefaultAddress(null);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const addAddress = useCallback(async (addressData: Partial<Address>): Promise<Address> => {
        let shopifyAddressId: string | undefined;

        // First, save to Shopify
        const customerAccessToken = user?.customerAccessToken;
        if (customerAccessToken) {
            try {
                // Set as default if this is the first address
                const setAsDefault = addresses.length === 0;
                
                // Format address data for Shopify (addressType sent on Shopify's required key)
                const shopifyAddressData: Record<string, string> = {
                    firstName: addressData.firstName || '',
                    lastName: addressData.lastName || addressData.name?.split(' ')[1] || '',
                    address1: addressData.address1 || '',
                    address2: addressData.address2 || '',
                    city: addressData.city || '',
                    province: addressData.province || addressData.state || '',
                    country: addressData.country || 'India',
                    zip: addressData.zip || addressData.pincode || '',
                    phone: addressData.phone || '',
                };
                shopifyAddressData[SHOPIFY_ADDRESS_TYPE_KEY] = encodeShopifyAddressType(
                    addressData.tag || 'home',
                    addressData.latitude,
                    addressData.longitude
                );

                console.log('[AddressContext] Creating address in Shopify:', shopifyAddressData);
                
                const result = await customerService.createCustomerAddress(
                    customerAccessToken,
                    shopifyAddressData,
                    setAsDefault
                );

                if (result.success && result.address) {
                    shopifyAddressId = result.address.id;
                    console.log('[AddressContext] Address created successfully in Shopify:', shopifyAddressId);
                } else {
                    console.error('[AddressContext] Failed to create address in Shopify:', result.error);
                    // Don't throw - continue with local save
                }
            } catch (shopifyError: any) {
                console.error('[AddressContext] Error creating address in Shopify:', shopifyError);
                console.error('[AddressContext] Error message:', shopifyError.message);
                console.error('[AddressContext] Error stack:', shopifyError.stack);
                // Continue with local save even if Shopify fails, but log the error
                Alert.alert(
                    'Warning',
                    `Address saved locally but failed to sync with Shopify: ${shopifyError.message || 'Unknown error'}. Please check your connection and try again.`
                );
            }
        } else {
            console.warn('[AddressContext] No customer access token, saving locally only');
        }

        const newAddress: Address = {
            id: shopifyAddressId || `addr_${Date.now()}`,
            shopifyId: shopifyAddressId,
            name: addressData.name || [addressData.firstName, addressData.lastName].filter((p) => p && p.trim() !== '_').join(' ').trim() || 'Home',
            firstName: addressData.firstName || '',
            lastName: addressData.lastName && addressData.lastName.trim() !== '_' ? addressData.lastName : '',
            phone: addressData.phone || '',
            address1: addressData.address1 || '',
            address2: addressData.address2 || '',
            city: addressData.city || '',
            province: addressData.province || '',
            state: addressData.state || addressData.province || '',
            zip: addressData.zip || '',
            pincode: addressData.pincode || addressData.zip || '',
            country: addressData.country || 'India',
            tag: addressData.tag || 'home',
            isDefault: addresses.length === 0, // First address is default
            latitude: addressData.latitude,
            longitude: addressData.longitude,
        };

        const updatedAddresses = [...addresses, newAddress];
        await AsyncStorage.setItem('user_addresses', JSON.stringify(updatedAddresses));
        setAddresses(updatedAddresses);

        if (newAddress.isDefault || addresses.length === 0) {
            setDefaultAddress(newAddress);
            await AsyncStorage.setItem('default_address_id', newAddress.id);
        }

        return newAddress;
    }, [addresses, user]);

    const updateAddress = useCallback(async (addressId: string, addressData: Partial<Address>) => {
        // First, update in Shopify
        const customerAccessToken = user?.customerAccessToken;
        const address = addresses.find(addr => addr.id === addressId);
        const shopifyId = address?.shopifyId || addressId;

        if (customerAccessToken && shopifyId && shopifyId.startsWith('gid://')) {
            try {
                // Format address data for Shopify (addressType sent on Shopify's required key)
                const shopifyAddressData: Record<string, string> = {
                    firstName: addressData.firstName ?? address?.firstName ?? '',
                    lastName: addressData.lastName ?? address?.lastName ?? '',
                    address1: addressData.address1 ?? address?.address1 ?? '',
                    address2: addressData.address2 ?? address?.address2 ?? '',
                    city: addressData.city ?? address?.city ?? '',
                    province: addressData.province ?? addressData.state ?? address?.province ?? address?.state ?? '',
                    country: addressData.country ?? address?.country ?? 'India',
                    zip: addressData.zip ?? addressData.pincode ?? address?.zip ?? address?.pincode ?? '',
                    phone: addressData.phone ?? address?.phone ?? '',
                };
                shopifyAddressData[SHOPIFY_ADDRESS_TYPE_KEY] = encodeShopifyAddressType(
                    addressData.tag ?? address?.tag ?? 'home',
                    addressData.latitude ?? address?.latitude,
                    addressData.longitude ?? address?.longitude
                );

                console.log('[AddressContext] Updating address in Shopify:', shopifyId, shopifyAddressData);
                
                const result = await customerService.updateCustomerAddress(customerAccessToken, shopifyId, shopifyAddressData);
                if (result.success && result.address) {
                    console.log('[AddressContext] Address updated successfully in Shopify');
                } else {
                    console.error('[AddressContext] Failed to update address in Shopify:', result.error);
                }
            } catch (shopifyError: any) {
                console.error('[AddressContext] Error updating address in Shopify:', shopifyError);
                console.error('[AddressContext] Error message:', shopifyError.message);
                console.error('[AddressContext] Error stack:', shopifyError.stack);
                // Continue with local update even if Shopify fails, but log the error
                Alert.alert(
                    'Warning',
                    `Address updated locally but failed to sync with Shopify: ${shopifyError.message || 'Unknown error'}. Please check your connection and try again.`
                );
            }
        } else {
            console.warn('[AddressContext] No customer access token or invalid shopifyId, updating locally only');
        }

        const updatedAddresses = addresses.map(addr =>
            addr.id === addressId ? { ...addr, ...addressData } : addr
        );
        await AsyncStorage.setItem('user_addresses', JSON.stringify(updatedAddresses));
        setAddresses(updatedAddresses);

        if (defaultAddress?.id === addressId) {
            setDefaultAddress({ ...defaultAddress, ...addressData } as Address);
        }
    }, [addresses, defaultAddress, user]);

    const deleteAddress = useCallback(async (addressId: string) => {
        // First, delete from Shopify
        const customerAccessToken = user?.customerAccessToken;
        const address = addresses.find(addr => addr.id === addressId);
        const shopifyId = address?.shopifyId || addressId;

        if (customerAccessToken && shopifyId && shopifyId.startsWith('gid://')) {
            try {
                await customerService.deleteCustomerAddress(customerAccessToken, shopifyId);
            } catch (shopifyError) {
                console.error('Error deleting address from Shopify:', shopifyError);
                // Continue with local delete even if Shopify fails
            }
        }

        const updatedAddresses = addresses.filter(addr => addr.id !== addressId);
        await AsyncStorage.setItem('user_addresses', JSON.stringify(updatedAddresses));
        setAddresses(updatedAddresses);

        if (defaultAddress?.id === addressId) {
            if (updatedAddresses.length > 0) {
                const newDefault = updatedAddresses[0];
                setDefaultAddress(newDefault);
                await AsyncStorage.setItem('default_address_id', newDefault.id);
            } else {
                setDefaultAddress(null);
                await AsyncStorage.removeItem('default_address_id');
            }
        }
    }, [addresses, defaultAddress, user]);

    const setDefaultAddressById = useCallback(async (addressId: string) => {
        const address = addresses.find(addr => addr.id === addressId);
        if (!address) return;

        // Update in Shopify if we have access token
        const customerAccessToken = user?.customerAccessToken;
        if (customerAccessToken && address.shopifyId && address.shopifyId.startsWith('gid://')) {
            try {
                await shopifyApi.setDefaultAddress(customerAccessToken, address.shopifyId);
            } catch (shopifyError) {
                console.error('Error setting default address in Shopify:', shopifyError);
                // Continue with local update even if Shopify fails
            }
        }

        // Update all addresses to remove default flag
        const updatedAddresses = addresses.map(addr => ({
            ...addr,
            isDefault: addr.id === addressId,
        }));

        await AsyncStorage.setItem('user_addresses', JSON.stringify(updatedAddresses));
        await AsyncStorage.setItem('default_address_id', addressId);

        setAddresses(updatedAddresses);
        setDefaultAddress({ ...address, isDefault: true });
    }, [addresses, user]);

    return (
        <AddressContext.Provider
            value={{
                addresses,
                defaultAddress,
                loading,
                detectedLocationStatus,
                detectedEta,
                setDetectedLocation,
                addAddress,
                updateAddress,
                deleteAddress,
                setDefaultAddressById,
                loadAddresses,
            }}
        >
            {children}
        </AddressContext.Provider>
    );
};
