import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface DemoCancelModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirmCancel: (reason: string) => void;
    loading?: boolean;
    onEditDemo?: () => void;
}

const DEMO_IMAGE_URL =
    'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/08733a2192a952536958cb74bb5830bb723113fa.png?v=1781594101';

const CANCEL_REASONS = [
    'Changed my mind',
    'Booked a demo for the wrong item',
    'Selected the wrong address',
    'My reason not listed',
];

export const DemoCancelModal = ({ visible, onClose, onConfirmCancel, loading, onEditDemo }: DemoCancelModalProps) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (visible) {
            setStep(1);
            setSelectedReason(null);
        }
    }, [visible]);

    const handleYesCancel = () => {
        setStep(2);
    };

    const handleConfirm = () => {
        if (selectedReason) {
            onConfirmCancel(selectedReason);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={styles.sheet}>
                    {step === 1 ? (
                        <>
                            {/* Step 1: Are you sure? */}
                            <View style={styles.header}>
                                <Text style={styles.headerTitle}>
                                    Are you sure you want to{'\n'}cancel the demo?
                                </Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={12}>
                                    <Ionicons name="close" size={24} color="#4A4A4A" />
                                </TouchableOpacity>
                            </View>

                            <Image
                                source={{ uri: DEMO_IMAGE_URL }}
                                style={styles.demoImage}
                                resizeMode="cover"
                            />

                            <View style={styles.bulletPoints}>
                                <Text style={styles.bulletText}>• Kiddo partner visits for a 30-minute demo</Text>
                                <Text style={styles.bulletText}>• Ensures product meets personalized needs</Text>
                                <Text style={styles.bulletText}>• Option to buy via digital payment or cash</Text>
                            </View>

                            <View style={styles.buttonsContainer}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={handleYesCancel}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.cancelButtonText}>Yes, I want to cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.keepButton}
                                    onPress={onClose}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.keepButtonText}>No, I'll take the demo</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            {/* Step 2: Please tell us why */}
                            <View style={styles.header}>
                                <Text style={styles.headerTitle}>Please tell us why</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={12}>
                                    <Ionicons name="close" size={24} color="#4A4A4A" />
                                </TouchableOpacity>
                            </View>

                            <Image
                                source={{ uri: DEMO_IMAGE_URL }}
                                style={styles.demoImage}
                                resizeMode="cover"
                            />

                            <View style={styles.reasonsList}>
                                {CANCEL_REASONS.map((reason) => {
                                    const isSelected = selectedReason === reason;
                                    const showEditOption = reason === 'Selected the wrong address' && isSelected;
                                    return (
                                        <View key={reason}>
                                            <TouchableOpacity
                                                style={styles.reasonRow}
                                                onPress={() => setSelectedReason(reason)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.reasonText}>{reason}</Text>
                                                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                                                    {isSelected && <View style={styles.radioDot} />}
                                                </View>
                                            </TouchableOpacity>
                                            {showEditOption && onEditDemo && (
                                                <TouchableOpacity
                                                    style={styles.editDemoOption}
                                                    onPress={() => {
                                                        onClose();
                                                        onEditDemo();
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={styles.editDemoText}>Edit Demo Instead</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={styles.buttonsContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.confirmCancelButton,
                                        !selectedReason && styles.confirmCancelButtonDisabled,
                                    ]}
                                    onPress={handleConfirm}
                                    activeOpacity={0.8}
                                    disabled={!selectedReason || loading}
                                >
                                    <Text
                                        style={[
                                            styles.confirmCancelButtonText,
                                            !selectedReason && styles.confirmCancelButtonTextDisabled,
                                        ]}
                                    >
                                        {loading ? 'Cancelling...' : 'Confirm cancellation'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
        flex: 1,
        marginRight: 16,
        lineHeight: 30,
    },
    closeButton: {
        padding: 4,
        marginTop: 2,
    },
    demoImage: {
        width: '100%',
        height: 180,
        borderRadius: 12,
        marginBottom: 16,
    },
    // Step 1 styles
    bulletPoints: {
        marginBottom: 24,
        gap: 8,
    },
    bulletText: {
        fontSize: 15,
        fontFamily: Fonts.LexendRegular,
        color: '#535862',
        lineHeight: 22,
    },
    buttonsContainer: {
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#E8E8E8',
        paddingTop: 20,
    },
    cancelButton: {
        backgroundColor: '#E84E4E',
        borderRadius: 999,
        paddingVertical: 16,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 17,
        fontFamily: Fonts.LexendBold,
        color: '#FFFFFF',
    },
    keepButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 999,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    keepButtonText: {
        fontSize: 17,
        fontFamily: Fonts.LexendBold,
        color: '#E84E4E',
    },
    // Step 2 styles
    reasonsList: {
        marginBottom: 8,
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    reasonText: {
        fontSize: 16,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
        flex: 1,
        marginRight: 12,
    },
    radio: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#D0D0D0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: {
        borderColor: '#E84E4E',
    },
    radioDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#E84E4E',
    },
    confirmCancelButton: {
        backgroundColor: '#E84E4E',
        borderRadius: 999,
        paddingVertical: 16,
        alignItems: 'center',
    },
    confirmCancelButtonDisabled: {
        backgroundColor: '#F5F5F5',
    },
    confirmCancelButtonText: {
        fontSize: 17,
        fontFamily: Fonts.LexendBold,
        color: '#FFFFFF',
    },
    confirmCancelButtonTextDisabled: {
        color: '#C0C0C0',
    },
    editDemoOption: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 4,
    },
    editDemoText: {
        fontSize: 15,
        fontFamily: Fonts.LexendBold,
        color: '#E84E4E',
    },
});
