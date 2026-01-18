import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';

export interface EmptyStateProps {
    icon?: keyof typeof Ionicons.glyphMap;
    iconSize?: number;
    iconColor?: string;
    title: string;
    subtitle?: string;
    buttonText?: string;
    onButtonPress?: () => void;
    style?: StyleProp<ViewStyle>;
    variant?: 'default' | 'error' | 'empty';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon = 'alert-circle-outline',
    iconSize = 48,
    iconColor = '#D1D5DB',
    title,
    subtitle,
    buttonText,
    onButtonPress,
    style,
    variant = 'default',
}) => {
    return (
        <View style={[styles.container, style]}>
            <View style={styles.iconContainer}>
                <Ionicons name={icon} size={iconSize} color={iconColor} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && (
                <Text style={styles.subtitle}>{subtitle}</Text>
            )}
            {buttonText && onButtonPress && (
                <TouchableOpacity
                    style={styles.button}
                    onPress={onButtonPress}
                    activeOpacity={0.7}
                >
                    <Text style={styles.buttonText}>{buttonText}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        minHeight: 280,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        color: Colors.text,
        fontFamily: Fonts.Bold,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontFamily: Fonts.Regular,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    button: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
    },
    buttonText: {
        color: Colors.backgroundWhite,
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
    },
});




