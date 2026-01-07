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
    iconSize = 80,
    iconColor = Colors.textSecondary,
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
        paddingHorizontal: 40,
    },
    iconContainer: {
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        color: Colors.text,
        fontFamily: Fonts.Bold,
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        fontFamily: Fonts.Regular,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    button: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 25,
    },
    buttonText: {
        color: Colors.backgroundWhite,
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
    },
});



