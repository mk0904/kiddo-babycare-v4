import { getMergedWalletConfig, WALLET_PRESET_AMOUNTS } from '@/config/walletDefaults';
import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function parseAmountInput(text: string): number {
    const digits = text.replace(/[^0-9]/g, '');
    return parseInt(digits, 10) || 0;
}

function formatAmountDisplay(value: number): string {
    if (!value) return '';
    return value.toLocaleString('en-IN');
}

function formatCurrency(amount: number) {
    return `₹${amount.toLocaleString('en-IN')}`;
}

const FOOTER_HEIGHT = 76;

export default function AddBalanceScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ balance?: string }>();
    const currentBalance = Math.max(0, parseInt(params.balance ?? '0', 10) || 0);
    const notes = getMergedWalletConfig().notes ?? [];

    const scrollRef = useRef<ScrollView>(null);
    const [amountText, setAmountText] = useState('');
    const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [headerHeight, setHeaderHeight] = useState(0);

    const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
    const isValid = amountValue > 0;
    const ctaLabel = isValid ? `Add ${formatCurrency(amountValue)}` : 'Add Balance';

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (event) => {
                setKeyboardVisible(true);
                setKeyboardHeight(event.endCoordinates.height);
                setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                }, 100);
            },
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
                setKeyboardHeight(0);
            },
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const scrollBottomPadding =
        32 +
        FOOTER_HEIGHT +
        Math.max(insets.bottom, 16) +
        (Platform.OS === 'android' && keyboardVisible ? keyboardHeight : 0);

    const handleAmountChange = (text: string) => {
        const parsed = parseAmountInput(text);
        setAmountText(formatAmountDisplay(parsed));
        setSelectedPreset(null);
    };

    const handlePresetPress = (preset: number) => {
        setSelectedPreset(preset);
        setAmountText(formatAmountDisplay(preset));
    };

    const handleSubmit = () => {
        if (!isValid) return;
        Alert.alert(
            'Add Balance',
            `You are adding ${formatCurrency(amountValue)} to your Kiddo Cash wallet. Payment integration will be available soon.`,
            [{ text: 'OK' }],
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View
                style={styles.header}
                onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
                    <Ionicons name="arrow-back" size={24} color="#181D27" />
                </TouchableOpacity>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.headerTitle}>Kiddo Cash</Text>
                    <Text style={styles.headerSubtitle}>
                        Current Balance: {formatCurrency(currentBalance)}
                    </Text>
                </View>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
            >
                <ScrollView
                    ref={scrollRef}
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: scrollBottomPadding },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                    automaticallyAdjustKeyboardInsets
                >
                    <Text style={styles.inputLabel}>Enter amount</Text>
                    <View style={styles.inputRow}>
                        <Text style={styles.currencyPrefix}>₹</Text>
                        <TextInput
                            style={styles.amountInput}
                            value={amountText}
                            onChangeText={handleAmountChange}
                            onFocus={() => {
                                setTimeout(() => {
                                    scrollRef.current?.scrollToEnd({ animated: true });
                                }, 100);
                            }}
                            placeholder=""
                            placeholderTextColor="#9CA3AF"
                            keyboardType="number-pad"
                            maxLength={12}
                        />
                    </View>

                    <View style={styles.presetRow}>
                        {WALLET_PRESET_AMOUNTS.map((preset) => {
                            const isSelected = selectedPreset === preset && amountValue === preset;
                            return (
                                <TouchableOpacity
                                    key={preset}
                                    style={[styles.presetChip, isSelected && styles.presetChipSelected]}
                                    onPress={() => handlePresetPress(preset)}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={[
                                            styles.presetChipText,
                                            isSelected && styles.presetChipTextSelected,
                                        ]}
                                    >
                                        {formatCurrency(preset)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.noteBox}>
                        <Text style={styles.noteTitle}>Note</Text>
                        {notes.map((note, index) => (
                            <View key={index} style={styles.noteRow}>
                                <Text style={styles.noteBullet}>•</Text>
                                <Text style={styles.noteText}>{note}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                <View
                    style={[
                        styles.footer,
                        {
                            paddingBottom: Math.max(insets.bottom, 16),
                            borderTopWidth: keyboardVisible ? 0 : StyleSheet.hairlineWidth,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.ctaButton,
                            isValid ? styles.ctaButtonEnabled : styles.ctaButtonDisabled,
                        ]}
                        onPress={handleSubmit}
                        disabled={!isValid}
                        activeOpacity={0.9}
                    >
                        <Text
                            style={[
                                styles.ctaButtonText,
                                !isValid && styles.ctaButtonTextDisabled,
                            ]}
                        >
                            {ctaLabel}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: {
        padding: 4,
        marginRight: 12,
        marginTop: 2,
    },
    headerTextWrap: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: 'Fredoka_600SemiBold',
        color: '#181D27',
    },
    headerSubtitle: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#717680',
        marginTop: 4,
    },
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        flexGrow: 1,
    },
    inputLabel: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#414651',
        marginBottom: 10,
        paddingTop: 40,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === 'ios' ? 16 : 12,
        backgroundColor: '#FFFFFF',
    },
    currencyPrefix: {
        fontSize: 20,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
        marginRight: 8,
    },
    amountInput: {
        flex: 1,
        fontSize: 20,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
        padding: 0,
    },
    presetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 16,
    },
    presetChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    presetChipSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    presetChipText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
    },
    presetChipTextSelected: {
        color: '#FFFFFF',
    },
    noteBox: {
        marginTop: 28,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
    },
    noteTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#374151',
        marginBottom: 10,
    },
    noteRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    noteBullet: {
        fontSize: Fonts.ExtraSmallFontSize,
        color: '#6B7280',
        marginRight: 8,
        lineHeight: 20,
    },
    noteText: {
        flex: 1,
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
        lineHeight: 20,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        backgroundColor: '#FFFFFF',
        borderTopColor: '#F3F4F6',
    },
    ctaButton: {
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaButtonEnabled: {
        backgroundColor: Colors.primary,
    },
    ctaButtonDisabled: {
        backgroundColor: '#F3F4F6',
    },
    ctaButtonText: {
        fontSize: 16,
        fontFamily: Fonts.LexendSemiBold,
        color: '#FFFFFF',
    },
    ctaButtonTextDisabled: {
        color: '#D1D5DB',
    },
});
