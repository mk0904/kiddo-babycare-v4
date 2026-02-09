import { Colors, Fonts } from '@/constants/theme';
import { configService } from '@/services/configService';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SHOE_IMAGE_WIDTH = (SCREEN_WIDTH - 60) / 4 - 8; // 4 boxes with spacing

interface FreeShoesOfferProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (shoeName: string) => void;
    selectedShoe?: string | null;
}

// Default shoe options (fallback if config not loaded)
const DEFAULT_SHOE_OPTIONS = [
    { id: 'shoe-1', name: 'Shoe 1', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/ChatGPT_Image_Feb_8_2026_02_19_53_AM.png?v=1770497452' },
    { id: 'shoe-2', name: 'Shoe 2', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/ChatGPT_Image_Feb_8_2026_02_19_53_AM.png?v=1770497452' },
    { id: 'shoe-3', name: 'Shoe 3', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/ChatGPT_Image_Feb_8_2026_02_19_53_AM.png?v=1770497452' },
    { id: 'shoe-4', name: 'Shoe 4', imageUrl: 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/ChatGPT_Image_Feb_8_2026_02_19_53_AM.png?v=1770497452' },
];

export const FreeShoesOffer = ({ visible, onClose, onSelect, selectedShoe }: FreeShoesOfferProps) => {
    const [localSelected, setLocalSelected] = useState<string | null>(selectedShoe || null);
    const [shoeOptions, setShoeOptions] = useState(DEFAULT_SHOE_OPTIONS);

    // Load shoe options from config
    useEffect(() => {
        const loadShoeOptions = () => {
            try {
                const config = configService.getFreeShoesOfferConfig();
                if (config && config.enabled && config.shoes && config.shoes.length > 0) {
                    setShoeOptions(config.shoes);
                } else {
                    // Use default if config not available or disabled
                    setShoeOptions(DEFAULT_SHOE_OPTIONS);
                }
            } catch (error) {
                console.error('[FreeShoesOffer] Error loading shoe options from config:', error);
                setShoeOptions(DEFAULT_SHOE_OPTIONS);
            }
        };

        loadShoeOptions();
    }, [visible]);

    const handleSelect = (shoeId: string) => {
        setLocalSelected(shoeId);
        onSelect(shoeId);
    };

    const handleConfirm = () => {
        if (localSelected) {
            onSelect(localSelected);
        }
        onClose();
    };

    const handleRemove = () => {
        setLocalSelected(null);
        onSelect('');
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Free Shoes Offer</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Offer Card */}
                        <View style={styles.offerCard}>
                            {/* Introductory Offer Badge */}
                            <View style={styles.badgeContainer}>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>Introductory Offer</Text>
                                </View>
                            </View>

                            {/* Checkmark and Offer Text */}
                            <View style={styles.offerHeader}>
                                <View style={styles.checkmarkContainer}>
                                    <Ionicons name="checkmark" size={24} color="#000" />
                                </View>
                                <Text style={styles.offerText}>Get free pair of shoes from Kiddo</Text>
                            </View>

                            {/* Shoe Selection Boxes */}
                            <View style={styles.shoeSelectionContainer}>
                                {shoeOptions.map((shoe) => {
                                    const isSelected = localSelected === shoe.id;
                                    return (
                                        <TouchableOpacity
                                            key={shoe.id}
                                            style={[
                                                styles.shoeBox,
                                                isSelected && styles.shoeBoxSelected,
                                            ]}
                                            onPress={() => handleSelect(shoe.id)}
                                        >
                                            <Image
                                                source={{ uri: shoe.imageUrl }}
                                                style={styles.shoeImage}
                                                contentFit="cover"
                                                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                                                transition={200}
                                            />
                                            {isSelected && (
                                                <View style={styles.selectedOverlay}>
                                                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Terms and Conditions */}
                            <View style={styles.termsContainer}>
                                <Text style={styles.termText}>
                                    • Offer only eligible if you have a fashion item in your cart.
                                </Text>
                                <Text style={styles.termText}>
                                    • Only applicable once per user
                                </Text>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        {selectedShoe && (
                            <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
                                <Ionicons name="trash-outline" size={18} color="#FF4444" />
                                <Text style={styles.removeButtonText}>Remove</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.confirmButton,
                                !localSelected && styles.confirmButtonDisabled
                            ]}
                            onPress={handleConfirm}
                            disabled={!localSelected}
                        >
                            <Text style={styles.confirmButtonText}>
                                {localSelected ? 'Confirm Selection' : 'Select a Shoe'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '90%',
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#000',
    },
    closeButton: {
        padding: 4,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    offerCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#000',
        padding: 20,
        marginBottom: 20,
    },
    badgeContainer: {
        marginBottom: 12,
    },
    badge: {
        backgroundColor: '#FF0000',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignSelf: 'flex-start',
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
    },
    offerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    checkmarkContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#E0E0E0',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    offerText: {
        flex: 1,
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#000',
    },
    shoeSelectionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 8,
    },
    shoeBox: {
        width: SHOE_IMAGE_WIDTH,
        height: SHOE_IMAGE_WIDTH,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#000',
        overflow: 'hidden',
        backgroundColor: '#f9f9f9',
        position: 'relative',
    },
    shoeBoxSelected: {
        borderColor: Colors.primary,
        borderWidth: 2,
    },
    shoeImage: {
        width: '100%',
        height: '100%',
    },
    selectedOverlay: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 12,
        padding: 2,
    },
    termsContainer: {
        marginTop: 12,
    },
    termText: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#666',
        marginBottom: 6,
        lineHeight: 18,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingBottom: 20,
        flexDirection: 'row',
        gap: 15,
    },
    removeButton: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ff4444',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    removeButtonText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#ff4444',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    confirmButtonDisabled: {
        backgroundColor: '#ccc',
        shadowOpacity: 0,
        elevation: 0,
    },
    confirmButtonText: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#fff',
    },
});

