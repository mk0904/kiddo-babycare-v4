import { NativeModules, Share } from 'react-native';
import appsFlyer from 'react-native-appsflyer';

import { APPSFLYER_REFERRAL_DEEP_LINK_VALUE } from '@/config/appsflyer';
import { appConfigService } from '@/services/appConfigService';
import { isAppsFlyerReady } from '@/services/appsflyerService';

export interface ShareReferralParams {
  currentUserId: string;
  uniqueReferralCode: string;
  /** Reward amount (INR) shown in share message copy */
  friendRewardAmount?: number;
}

function canGenerateInviteLink(): boolean {
  return isAppsFlyerReady() && Boolean(NativeModules.RNAppsFlyer);
}

function buildShareMessage(shortLinkUrl: string, uniqueReferralCode: string, friendRewardAmount: number) {
  return (
    `Hey! 👋 Try out Kiddo—everything is carefully picked for kids! 🎁 ` +
    `Use my personal link to sign up and get ₹${friendRewardAmount} wallet credit instantly:\n\n` +
    `${shortLinkUrl}\n\nReferral Code: ${uniqueReferralCode}`
  );
}

/** Fallback when AppsFlyer invite API is unavailable (Expo Go, missing dev key, etc.) */
export async function shareReferralFallback(
  uniqueReferralCode: string,
  friendRewardAmount: number,
): Promise<void> {
  const appDownloadConfig = appConfigService.getAppDownloadConfig();
  const iosUrl =
    appDownloadConfig?.ios?.url ||
    'https://apps.apple.com/in/app/kiddo-baby-care-in-minutes/id6755881583';
  const androidUrl =
    appDownloadConfig?.android?.url ||
    'https://play.google.com/store/apps/details?id=com.barereactnativeapp072';

  const message =
    `Hey! Download Kiddo App and use my referral code ${uniqueReferralCode} ` +
    `to get ₹${friendRewardAmount} off on your first order!\n\n` +
    `Download here:\nAndroid: ${androidUrl}\niOS: ${iosUrl}`;

  await Share.share({ message, title: 'Join me on Kiddo!' });
}

/**
 * Generate an AppsFlyer OneLink invite URL and open the native share sheet.
 * Payload matches the UDL listener in Step 2 (`referral_signup` + `deep_link_sub1`).
 */
export function generateAndShareReferralLink({
  currentUserId,
  uniqueReferralCode,
  friendRewardAmount = 100,
}: ShareReferralParams): Promise<void> {
  const code = uniqueReferralCode.trim();
  const userId = currentUserId.trim();

  if (!code) {
    return Promise.reject(new Error('Referral code is required'));
  }

  if (!canGenerateInviteLink()) {
    if (__DEV__) {
      console.warn('[AppsFlyer] Invite link unavailable — using store URL fallback');
    }
    return shareReferralFallback(code, friendRewardAmount);
  }

  return new Promise((resolve, reject) => {
    appsFlyer.generateInviteLink(
      {
        channel: 'User_Invite',
        campaign: 'parent_referrals_v1',
        customerID: userId || undefined,
        userParams: {
          pid: 'User_invite',
          af_xp: 'referral',
          deep_link_value: APPSFLYER_REFERRAL_DEEP_LINK_VALUE,
          deep_link_sub1: code,
        },
      },
      (shortLinkUrl) => {
        const url =
          typeof shortLinkUrl === 'string'
            ? shortLinkUrl
            : String((shortLinkUrl as { link?: string })?.link ?? shortLinkUrl ?? '');

        if (!url) {
          shareReferralFallback(code, friendRewardAmount).then(resolve).catch(reject);
          return;
        }

        const messageContent = buildShareMessage(url, code, friendRewardAmount);
        Share.share({
          message: messageContent,
          title: 'Join me on Kiddo!',
        })
          .then(() => resolve())
          .catch(reject);
      },
      (error) => {
        console.error('[AppsFlyer] Link generation failed:', error);
        shareReferralFallback(code, friendRewardAmount).then(resolve).catch(reject);
      },
    );
  });
}
