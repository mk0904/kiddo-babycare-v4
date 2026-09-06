import BaseModal from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Fonts } from '@/constants/theme';
import React, { useState } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface CancelOrderModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

const CANCEL_REASONS = [
    'Changed my mind',
    'Placed the order by mistake',
    'Selected the wrong address',
    'Forgot to add a few items',
    'My reason not listed',
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
    visible,
    onClose,
    onConfirm,
}) => {
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [customReason, setCustomReason] = useState('');

    const handleConfirm = () => {
        if (selectedReason === 'My reason not listed') {
            if (customReason.trim()) {
                onConfirm(customReason.trim());
            }
        } else if (selectedReason) {
            onConfirm(selectedReason);
        }
    };

    // Reset selection when modal opens
    React.useEffect(() => {
        if (visible) {
            setSelectedReason(null);
            setCustomReason('');
        }
    }, [visible]);

    const isConfirmDisabled = !selectedReason || (selectedReason === 'My reason not listed' && !customReason.trim());

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title="What went wrong?"
            type="centered"
            showDragHandle={false}
            closeButtonPosition="header"
            hideHeaderBorder={true}
        >
            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                {/* Illustration placeholder */}
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/cancel_img.png?v=1788258557' }}
                        style={styles.cancelImage}
                        resizeMode="contain"
                    />
                </View>

                <View style={styles.reasonsList}>
                    {CANCEL_REASONS.map((reason) => {
                        const isSelected = selectedReason === reason;
                        return (
                            <View key={reason}>
                                <TouchableOpacity
                                    style={styles.reasonRow}
                                    activeOpacity={0.7}
                                    onPress={() => setSelectedReason(reason)}
                                >
                                    <Text style={styles.reasonText}>{reason}</Text>
                                    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                                        {isSelected && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                                {isSelected && reason === 'My reason not listed' && (
                                    <TextInput
                                        style={styles.customInput}
                                        placeholder="Write your reason here"
                                        placeholderTextColor="#9CA3AF"
                                        value={customReason}
                                        onChangeText={setCustomReason}
                                        multiline
                                    />
                                )}
                            </View>
                        );
                    })}
                </View>

                <View style={styles.footer}>
                    <Button
                        title="Confirm reason"
                        onPress={handleConfirm}
                        disabled={isConfirmDisabled}
                        style={[styles.confirmButton, isConfirmDisabled && styles.confirmButtonDisabled]}
                        textStyle={styles.confirmButtonText}
                    />
                </View>
            </ScrollView>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    content: {
        maxHeight: '100%',
    },
    scrollContent: {
        paddingBottom: 24,
    },
    imageContainer: {
        paddingHorizontal: 0,
        marginVertical: 12,
        alignItems: 'center',
    },
    cancelImage: {
        width: 360,
        height: 180,
    },
    reasonsList: {
        paddingHorizontal: 16,
        marginTop: 12,
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    reasonText: {
        fontFamily: Fonts.LexendMedium,
        fontSize: 14,
        color: '#181D27',
    },
    customInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontFamily: Fonts.LexendMedium,
        fontSize: 14,
        color: '#1F2937',
        marginTop: 4,
        marginBottom: 16,
        minHeight: 48,
        textAlignVertical: 'top',
        backgroundColor: '#FFFFFF',
    },
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuterSelected: {
        borderColor: '#F05A5D',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#F05A5D',
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    confirmButton: {
        backgroundColor: '#F15E5E',
        borderRadius: 16,
        height: 44,
    },
    confirmButtonDisabled: {
        backgroundColor: '#F3F4F6',
        opacity: 1,
    },
    confirmButtonText: {
        fontFamily: Fonts.LexendSemiBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
});
