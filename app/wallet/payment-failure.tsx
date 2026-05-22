import { WalletPaymentResultScreen } from '@/components/wallet/WalletPaymentResultScreen';
import { useLocalSearchParams } from 'expo-router';

export default function WalletPaymentFailureScreen() {
    const { balance } = useLocalSearchParams<{ balance?: string }>();

    return <WalletPaymentResultScreen variant="failure" balance={balance} />;
}
