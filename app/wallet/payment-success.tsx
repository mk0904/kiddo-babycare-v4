import { WalletPaymentResultScreen } from '@/components/wallet/WalletPaymentResultScreen';
import { useLocalSearchParams } from 'expo-router';

export default function WalletPaymentSuccessScreen() {
    const { balance, addedAmount } = useLocalSearchParams<{
        balance?: string;
        addedAmount?: string;
    }>();

    return (
        <WalletPaymentResultScreen
            variant="success"
            balance={balance}
            addedAmount={addedAmount}
        />
    );
}
