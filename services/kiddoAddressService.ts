import { Address } from '@/context/AddressContext';

// Using the same URL pattern as getExternalOrderStatus
const BASE_URL = 'https://delivery-partner-service-874125225773.asia-south1.run.app/api/v1/addresses';

export const kiddoAddressService = {
  async getAddresses(phone: string): Promise<Address[]> {
    const cleaned = phone.replace(/\D/g, '').slice(-10); // get last 10 digits
    const response = await fetch(`${BASE_URL}?phone=${cleaned}`);
    if (!response.ok) throw new Error('Failed to fetch addresses');
    const data = await response.json();
    return data.addresses.map((a: any) => ({
      id: String(a.id),
      name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
      firstName: a.first_name,
      lastName: a.last_name,
      phone: a.phone,
      address1: a.address1,
      address2: a.address2 || '',
      city: a.city,
      province: a.state,
      state: a.state,
      zip: a.pincode,
      pincode: a.pincode,
      country: a.country || 'India',
      tag: a.tag || 'home',
      isDefault: a.is_default,
      latitude: a.latitude != null ? parseFloat(a.latitude) : undefined,
      longitude: a.longitude != null ? parseFloat(a.longitude) : undefined,
    }));
  },

  async addAddress(address: Partial<Address> & { customerPhone: string }): Promise<Address> {
    const payload = {
      customer_phone: address.customerPhone.replace(/\D/g, '').slice(-10),
      first_name: address.firstName,
      last_name: address.lastName,
      phone: address.phone,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      state: address.state || address.province,
      pincode: address.pincode || address.zip,
      country: address.country || 'India',
      latitude: address.latitude,
      longitude: address.longitude,
      tag: address.tag,
      is_default: address.isDefault || false,
    };

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Failed to create address');
    const data = await response.json();
    const a = data.address;
    return {
      id: String(a.id),
      name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
      firstName: a.first_name,
      lastName: a.last_name,
      phone: a.phone,
      address1: a.address1,
      address2: a.address2 || '',
      city: a.city,
      province: a.state,
      state: a.state,
      zip: a.pincode,
      pincode: a.pincode,
      country: a.country,
      tag: a.tag,
      isDefault: a.is_default,
      latitude: a.latitude != null ? parseFloat(a.latitude) : undefined,
      longitude: a.longitude != null ? parseFloat(a.longitude) : undefined,
    };
  },

  async updateAddress(id: string, phone: string, address: Partial<Address>): Promise<void> {
    const payload = {
      phone: phone.replace(/\D/g, '').slice(-10),
      first_name: address.firstName,
      last_name: address.lastName,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      state: address.state || address.province,
      pincode: address.pincode || address.zip,
      country: address.country || 'India',
      latitude: address.latitude,
      longitude: address.longitude,
      tag: address.tag,
      is_default: address.isDefault,
    };

    // Remove undefined fields
    Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Failed to update address');
  },

  async deleteAddress(id: string, phone: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.replace(/\D/g, '').slice(-10) }),
    });

    if (!response.ok) throw new Error('Failed to delete address');
  }
};
