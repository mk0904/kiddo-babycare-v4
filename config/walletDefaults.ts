import { appConfigService } from '@/services/appConfigService';
import { WalletConfig } from '@/types/appConfig';

export const WALLET_THEME_COLOR = '#0CB6FF';

export const WALLET_PRESET_AMOUNTS = [250, 500, 1000, 2500] as const;

export const defaultWalletConfig: WalletConfig = {
    walletScreen: {
        title: 'Kiddo Cash',
        balanceLabel: 'Your Balance',
        earnedLabel: 'Kiddo Cash Earned',
        ctaText: 'Add Balance',
    },
    carousel: [],
    notes: [
        'Kiddo Cash balances are valid for 1 year from date of credit on Kiddo App',
        'Kiddo Cash cannot be transferred to your bank account as per RBI guidelines',
        'Kiddo Cash balance cannot be used to purchase precious jewelry items, including gold, silver & similar valuables.',
    ],
    howItWorks: {
        themeColor: WALLET_THEME_COLOR,
        title: 'How it works',
        steps: [],
    },
    faqs: [
        {
            question: 'How do I add money to my Kiddo Wallet?',
            answer:
                'You can load your wallet using UPI, debit/credit cards, or net banking from the Wallet tab. Tap Add Balance and follow the payment steps.',
        },
        {
            question: 'Where can I use Kiddo Cash?',
            answer:
                'Kiddo Cash can be applied at checkout on eligible prepaid orders. The available balance is shown before you place your order.',
        },
        {
            question: 'How do I earn Kiddo Cash?',
            answer:
                'Earn Kiddo Cash through prepaid order cashback, referrals, and promotional offers shown on this screen.',
        },
        {
            question: 'Does Kiddo Cash expire?',
            answer:
                'Expiry rules may apply to promotional credits. Your wallet balance and transaction history show the latest status for each credit.',
        },
    ],
};

/** Merges remote `walletConfig` from backend with local defaults. */
export function getMergedWalletConfig(): WalletConfig {
    const remote = appConfigService.getWalletConfig();

    return {
        walletScreen: {
            ...defaultWalletConfig.walletScreen,
            ...remote?.walletScreen,
        },
        howItWorks: remote?.howItWorks ?? defaultWalletConfig.howItWorks,
        faqs: remote?.faqs?.length ? remote.faqs : defaultWalletConfig.faqs ?? [],
        carousel: remote?.carousel?.length ? remote.carousel : defaultWalletConfig.carousel ?? [],
        notes: remote?.notes?.length ? remote.notes : defaultWalletConfig.notes ?? [],
    };
}
