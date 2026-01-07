import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { customerService } from '@/services/customerService';
import { shopifyApi } from '@/services/shopifyApi';

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
    tag: 'home' | 'work' | 'other';
    isDefault: boolean;
    latitude?: number;
    longitude?: number;
}

interface AddressContextType {
    addresses: Address[];
    defaultAddress: Address | null;
    loading: boolean;
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
                        const formattedAddresses: Address[] = result.addresses.map((addr: any) => ({
                            id: addr.id,
                            shopifyId: addr.id,
                            firstName: addr.firstName || '',
                            lastName: addr.lastName || '',
                            name: `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'Address',
                            address1: addr.address1 || '',
                            address2: addr.address2 || '',
                            city: addr.city || '',
                            province: addr.province || '',
                            state: addr.province || '',
                            zip: addr.zip || '',
                            pincode: addr.zip || '',
                            country: addr.country || 'India',
                            tag: 'home', // Default tag as Shopify doesn't store this
                            phone: addr.phone || '',
                            isDefault: result.defaultAddress?.id === addr.id,
                            latitude: undefined,
                            longitude: undefined,
                        }));

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
                const result = await customerService.createCustomerAddress(
                    customerAccessToken,
                    addressData,
                    setAsDefault
                );

                if (result.success && result.address) {
                    shopifyAddressId = result.address.id;
                }
            } catch (shopifyError) {
                console.error('Error creating address in Shopify:', shopifyError);
                // Continue with local save even if Shopify fails
            }
        }

        const newAddress: Address = {
            id: shopifyAddressId || `addr_${Date.now()}`,
            shopifyId: shopifyAddressId,
            name: addressData.name || 'Home',
            firstName: addressData.firstName || '',
            lastName: addressData.lastName || '_',
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
                const result = await customerService.updateCustomerAddress(customerAccessToken, shopifyId, addressData);
                if (result.success && result.address) {
                    // Successfully updated in Shopify
                    // Maybe update addressData with new ID if it changed, though unlikely for updates
                }
            } catch (shopifyError) {
                console.error('Error updating address in Shopify:', shopifyError);
                // Continue with local update even if Shopify fails
            }
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
