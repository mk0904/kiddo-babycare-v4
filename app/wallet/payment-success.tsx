import { WalletPaymentResultScreen } from '@/components/wallet/WalletPaymentResultScreen';
import { useLocalSearchParams } from 'expo-router';

export default function WalletPaymentSuccessScreen() {
    const { balance } = useLocalSearchParams<{ balance?: string }>();

    return <WalletPaymentResultScreen variant="success" balance={balance} />;
}
