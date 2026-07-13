import axios from 'axios';
import { getBackendApiPath, getBackendAuthHeaders } from './backendBase';

export interface ReferralProfile {
  id: string;
  customer_id: string;
  user_contact: string;
  referral_code: string;
  is_eligible: boolean;
  successful_referrals_count: number;
  created_at: string;
}

export interface ReferralWallet {
  id: string;
  customer_id: string;
  user_contact: string;
  actual_amount: number;
  referral_amount: number;
  earn_amount: number;
  total_amount: number;
  updated_at: string;
}

export interface ReferralItem {
  id: string;
  referrer_id: string;
  referee_id: string;
  status: string;
  created_at: string;
  completed_at?: string;
}

export interface ReferralTransaction {
  id: string;
  customer_id: string;
  user_contact: string;
  target_amount_type: string;
  type: string;
  amount: number;
  reference_id: string;
  description: string;
  created_at: string;
}

export interface ReferralStatusResponse {
  profile?: ReferralProfile;
  wallet?: ReferralWallet;
  referrals?: ReferralItem[];
  transactions?: ReferralTransaction[];
}

class ReferralService {
  private cleanPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `91${cleaned}`;
    }
    return cleaned;
  }

  async getReferralStatus(phone: string, page: number = 1, type?: 'credit' | 'debit'): Promise<ReferralStatusResponse> {
    try {
      const cleaned = this.cleanPhone(phone);
      let urlStr = `referral/status?phone=${cleaned}&page=${page}`;
      if (type) {
        urlStr += `&type=${type}`;
      }
      const url = getBackendApiPath(urlStr);
      console.log(`[Referral Service] Fetching status for ${cleaned} from ${url}`);
      const response = await axios.get<ReferralStatusResponse>(url, {
        headers: getBackendAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      console.error('[Referral Service] Error fetching referral status:', error);
      throw error;
    }
  }
}

export const referralService = new ReferralService();
