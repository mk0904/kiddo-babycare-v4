import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const SUPPORT_PHONE = '+919310993990';

interface NeedHelpChatCardProps {
    /** If provided, shows "Call us" and uses this handler (e.g. open tel:). Otherwise shows "Chat with us". */
    onCallPress?: () => void;
    /** Legacy: when onCallPress is not set, this is used for the primary action. */
    onChatPress?: () => void;
}

export function NeedHelpChatCard({ onCallPress, onChatPress }: NeedHelpChatCardProps) {
    const isCall = onCallPress != null;
    const handlePress = isCall ? onCallPress : onChatPress;

    return (
        <View style={styles.card}>
            <View style={styles.iconWrap}>
                <Ionicons
                    name={isCall ? 'call-outline' : 'chatbubble-ellipses-outline'}
                    size={24}
                    color={isCall ? '#1E88E5' : '#6B7280'}
                />
            </View>
            <View style={styles.textWrap}>
                <Text style={styles.title}>Need help?</Text>
                <Text style={styles.sub}>
                    {isCall
                        ? 'Speak with us for any issues related to your order'
                        : 'Chat with us for any issue related to your order'}
                </Text>
            </View>
            <TouchableOpacity
                style={styles.chatLinkWrap}
                onPress={handlePress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isCall ? 'Call us' : 'Chat with us'}
            >
                <Text style={styles.chatLink}>{isCall ? 'Call us' : 'Chat with us'}</Text>
            </TouchableOpacity>
        </View>
    );
}

/** Opens the default phone dialler with Kiddo support number (same as Account > Help & Support). */
export function openSupportCall() {
    Linking.openURL(`tel:${SUPPORT_PHONE}`);
}

const CARD_RADIUS = 12;

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
       
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textWrap: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#717680',
    },
    sub: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        marginTop: 2,
        lineHeight: 18,
        color: '#414651',
    },
    chatLinkWrap: {
        paddingVertical: 4,
        paddingLeft: 8,
    },
    chatLink: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
});
