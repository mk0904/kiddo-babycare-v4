import { kiddoAddressService } from '@/services/kiddoAddressService';
import { customerService } from '@/services/customerService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';

export interface Address {
    id: string;
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

const SHOPIFY_ADDRESS_TYPE_KEY = 'company' as const;
const SHOPIFY_ADDRESS_GEO_PREFIX = 'kiddo_geo:';

function encodeShopifyAddressType(tag: AddressTag, latitude?: number, longitude?: number): string {
    const base = tagToAddressType(tag);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return base;
    return `${base} | ${SHOPIFY_ADDRESS_GEO_PREFIX}${latitude},${longitude}`;
}

export type DetectedLocationStatus = 'idle' | 'loading' | 'serviceable' | 'unserviceable' | 'denied' | 'error';

interface AddressContextType {
    addresses: Address[];
    defaultAddress: Address | null;
    loading: boolean;
    detectedLocationStatus: DetectedLocationStatus;
    detectedEta: number | null;
    setDetectedLocation: (status: DetectedLocationStatus, eta?: number | null) => void;
    currentLocationStatus: DetectedLocationStatus;
    isCurrentLocationServiceable: boolean | null;
    checkCurrentLocationServiceability: () => Promise<void>;
    addAddress: (addressData: Partial<Address>, makeDefault?: boolean) => Promise<Address>;
    updateAddress: (addressId: string, addressData: Partial<Address>) => Promise<void>;
    deleteAddress: (addressId: string) => Promise<void>;
    setDefaultAddressById: (addressId: string) => Promise<void>;
    loadAddresses: () => Promise<void>;
}

const AddressContext = createContext<AddressContextType | undefined>(undefined);

export const useAddress = () => {
    const context = useContext(AddressContext);
    if (!context) throw new Error('useAddress must be used within an AddressProvider');
    return context;
};

export const AddressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
    const [loading, setLoading] = useState(true);
    
    const [detectedLocationStatus, setDetectedLocationStatus] = useState<DetectedLocationStatus>('idle');
    const [detectedEta, setDetectedEta] = useState<number | null>(null);
    const [currentLocationStatus, setCurrentLocationStatus] = useState<DetectedLocationStatus>('idle');
    const [isCurrentLocationServiceable, setIsCurrentLocationServiceable] = useState<boolean | null>(null);

    const setDetectedLocation = useCallback((status: DetectedLocationStatus, eta?: number | null) => {
        setDetectedLocationStatus(status);
        setDetectedEta(eta ?? null);
    }, []);

    const checkCurrentLocationServiceability = useCallback(async () => {
        try {
            const { appConfigService } = require('@/services/appConfigService');
            if (!appConfigService.isConfigLoaded()) await appConfigService.loadAppConfig();

            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                setCurrentLocationStatus('denied');
                return;
            }

            setCurrentLocationStatus('loading');
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = location.coords;

            const isServiceable = appConfigService.isLocationServiceable(latitude, longitude);
            setIsCurrentLocationServiceable(isServiceable);
            setCurrentLocationStatus(isServiceable ? 'serviceable' : 'unserviceable');
        } catch (error) {
            console.error('[AddressContext] Error checking serviceability:', error);
            setCurrentLocationStatus('error');
        }
    }, []);

    const loadAddresses = useCallback(async () => {
        if (!user?.phone) return;
        try {
            setLoading(true);
            const data = await kiddoAddressService.getAddresses(user.phone);
            setAddresses(data);
            await AsyncStorage.setItem('user_addresses', JSON.stringify(data));
            
            const defAddr = data.find((a: Address) => a.isDefault) || data[0] || null;
            setDefaultAddress(defAddr);
            if (defAddr) await AsyncStorage.setItem('default_address_id', defAddr.id);
        } catch (error) {
            console.error('[AddressContext] Failed to load addresses', error);
        } finally {
            setLoading(false);
        }
    }, [user?.phone]);

    useEffect(() => {
        if (isAuthenticated) loadAddresses();
        checkCurrentLocationServiceability();
    }, [isAuthenticated, loadAddresses, checkCurrentLocationServiceability]);

    const addAddress = useCallback(async (addressData: Partial<Address>, makeDefault: boolean = true) => {
        if (!user?.phone) throw new Error('User not logged in');

        // First, save to Shopify (best-effort)
        const customerAccessToken = user?.customerAccessToken;
        if (customerAccessToken) {
            try {
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
                await customerService.createCustomerAddress(customerAccessToken, shopifyAddressData, makeDefault);
            } catch (err) {
                console.error('[AddressContext] Failed to sync address to Shopify:', err);
            }
        }

        const newAddr = await kiddoAddressService.addAddress({ ...addressData, customerPhone: user.phone, isDefault: makeDefault });
        
        let updated = [...addresses, newAddr];
        if (makeDefault) {
            updated = updated.map(a => ({ ...a, isDefault: a.id === newAddr.id }));
            setDefaultAddress(newAddr);
        }
        setAddresses(updated);
        await AsyncStorage.setItem('user_addresses', JSON.stringify(updated));
        return newAddr;
    }, [user?.phone, addresses]);

    const updateAddress = useCallback(async (addressId: string, addressData: Partial<Address>) => {
        if (!user?.phone) throw new Error('User not logged in');
        await kiddoAddressService.updateAddress(addressId, user.phone, addressData);
        
        const updated = addresses.map(a => a.id === addressId ? { ...a, ...addressData } : a);
        setAddresses(updated);
        await AsyncStorage.setItem('user_addresses', JSON.stringify(updated));
        if (defaultAddress?.id === addressId) setDefaultAddress({ ...defaultAddress, ...addressData } as Address);
    }, [user?.phone, addresses, defaultAddress]);

    const deleteAddress = useCallback(async (addressId: string) => {
        if (!user?.phone) return;
        await kiddoAddressService.deleteAddress(addressId, user.phone);
        
        const updated = addresses.filter(a => a.id !== addressId);
        setAddresses(updated);
        await AsyncStorage.setItem('user_addresses', JSON.stringify(updated));
        if (defaultAddress?.id === addressId) {
            setDefaultAddress(updated[0] || null);
        }
    }, [user?.phone, addresses, defaultAddress]);

    const setDefaultAddressById = useCallback(async (addressId: string) => {
        if (!user?.phone) return;
        await kiddoAddressService.updateAddress(addressId, user.phone, { isDefault: true });
        
        const updated = addresses.map(a => ({ ...a, isDefault: a.id === addressId }));
        setAddresses(updated);
        await AsyncStorage.setItem('user_addresses', JSON.stringify(updated));
        setDefaultAddress(updated.find(a => a.id === addressId) || null);
    }, [user?.phone, addresses]);

    return (
        <AddressContext.Provider value={{
            addresses, defaultAddress, loading, detectedLocationStatus, detectedEta,
            setDetectedLocation, currentLocationStatus, isCurrentLocationServiceable,
            checkCurrentLocationServiceability, addAddress, updateAddress, deleteAddress,
            setDefaultAddressById, loadAddresses
        }}>
            {children}
        </AddressContext.Provider>
    );
};
