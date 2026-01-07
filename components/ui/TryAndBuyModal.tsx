import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { BaseModal } from '@/components/content/BaseModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TryAndBuyModalProps {
    visible: boolean;
    onClose: () => void;
}

const TryAndBuyModal: React.FC<TryAndBuyModalProps> = ({ visible, onClose }) => {
    const features = [
        {
            icon: 'hand-left-outline' as const,
            text: 'Order Try & Buy eligible products',
        },
        {
            icon: 'remove-circle-outline' as const,
            text: 'No minimum order value',
        },
        {
            icon: 'home-outline' as const,
            text: 'Try at home for 30 mins',
        },
        {
            icon: 'wallet-outline' as const,
            text: 'Pay on Delivery Available',
        },
        {
            icon: 'return-down-back-outline' as const,
            text: 'Keep what you love, return the rest- instantly',
        },
        {
            icon: 'cash-outline' as const,
            text: 'Quick & Easy refund',
        },
    ];

    // Map to Block config structure for BaseModal
    const modalBlock = {
        id: 'try-and-buy-modal',
        type: 'modal',
        data: {
            title: 'Try Before You Buy',
            content: (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Features Grid */}
                    <View style={styles.featuresGrid}>
                        {features.map((feature, index) => (
                            <View key={index} style={styles.featureCard}>
                                <View style={styles.featureIconContainer}>
                                    <Ionicons
                                        name={feature.icon}
                                        size={28}
                                        color={Colors.primary}
                                    />
                                </View>
                                <Text style={styles.featureText}>{feature.text}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Important Notes */}
                    <View style={styles.notesSection}>
                        <Text style={styles.notesTitle}>Important Notes:</Text>
                        <View style={styles.noteItem}>
                            <Text style={styles.noteBullet}>•</Text>
                            <Text style={styles.noteText}>
                                Note: Items kept after Try & Buy aren't eligible for return or exchange.
                            </Text>
                        </View>
                        <Text style={styles.noteText}>
                            Please ensure the product and tags are in original condition and the outer packaging is kept intact on returning the product.
                        </Text>
                    </View>
                </ScrollView>
            )
        },
        modalConfig: {
            dismissible: true,
            fullScreen: false
        }
    };

    return (
        <BaseModal
            block={modalBlock as any}
            visible={visible}
            onClose={onClose}
        />
    );
};

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 30,
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    featureCard: {
        width: (SCREEN_WIDTH - 60) / 2,
        backgroundColor: Colors.backgroundSecondary,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        alignItems: 'center',
        minHeight: 120,
        justifyContent: 'center',
    },
    featureIconContainer: {
        marginBottom: 8,
    },
    featureText: {
        fontSize: 12,
        color: Colors.text,
        textAlign: 'center',
        // fontFamily: Fonts.Regular,
        lineHeight: 16,
    },
    notesSection: {
        backgroundColor: Colors.backgroundSecondary,
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    notesTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 12,
        // fontFamily: Fonts.SemiBold,
    },
    noteItem: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    noteBullet: {
        fontSize: 16,
        color: Colors.text,
        marginRight: 8,
        // fontFamily: Fonts.Regular,
    },
    noteText: {
        flex: 1,
        fontSize: 14,
        color: Colors.text,
        lineHeight: 20,
        // fontFamily: Fonts.Regular,
    },
});

export default TryAndBuyModal;
