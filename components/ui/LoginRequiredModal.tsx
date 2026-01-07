import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Changed from react-native-vector-icons
import { Colors, Fonts } from '@/constants/theme';
import { BaseModal } from '../content/BaseModal'; // Adjust import path as needed

interface LoginRequiredModalProps {
    visible: boolean;
    onClose: () => void;
    onLogin?: () => void;
    navigation?: any; // Using any for navigation to avoid deep type issues for now, or use NavigationProp
    message?: string;
}

const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({
    visible,
    onClose,
    onLogin,
    navigation,
    message
}) => {
    const handleLogin = () => {
        onClose();
        if (onLogin) {
            onLogin();
        } else if (navigation) {
            // Fallback or specific navigation logic if needed
            // For now, assuming standard router push or navigate
            // Check if navigation object has navigate (React Navigation) or push (Expo Router)
            // Since we are using Expo Router, we might want to use router.push('/login') or similar if strict
            // But to match Kiddo's logic which passed 'navigation':
            try {
                if (typeof navigation.navigate === 'function') {
                    navigation.navigate('login'); // Assuming 'login' route exists or mapped
                } else {
                    // Fallback for expo-router if navigation prop isn't standard
                    // But typically we'd use useRouter() inside the component if we weren't passed 'navigation'
                    // For exact port, we keep this structure.
                }
            } catch (e) {
                console.log("Navigation error in LoginRequiredModal", e);
            }
        }
    };

    // Construct a mock "block" for BaseModal since it expects one
    const modalBlock = {
        id: 'login-required',
        type: 'modal',
        data: {
            title: 'Login Required',
            content: (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconContainer}>
                        <Ionicons name="lock-closed" size={80} color={Colors.textSecondary} />
                    </View>
                    <Text style={styles.emptyTitle}>Login to Access</Text>
                    <Text style={styles.emptySubtitle}>
                        {message || 'Please log in to access this feature and continue shopping.'}
                    </Text>
                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={handleLogin}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="log-in" size={20} color="#FFF" style={styles.loginIcon} />
                        <Text style={styles.loginButtonText}>LOG IN</Text>
                    </TouchableOpacity>
                </View>
            )
        },
        modalConfig: {
            dismissible: true,
            fullScreen: false
        }
    };

    return (
        <BaseModal
            block={modalBlock as any} // Cast to satisfy type if needed, or structured correctly
            visible={visible}
            onClose={onClose}
        />
    );
};

const styles = StyleSheet.create({
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
        minHeight: 300,
    },
    emptyIconContainer: {
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
        fontFamily: Fonts.Bold,
        marginBottom: 12,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontFamily: Fonts.Regular,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
        paddingHorizontal: 20,
    },
    loginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        minWidth: 200,
    },
    loginIcon: {
        marginRight: 8,
    },
    loginButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
        fontFamily: Fonts.SemiBold,
    },
});

export default LoginRequiredModal;
