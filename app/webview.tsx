import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function WebViewScreen() {
    const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    if (!url) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <ScreenHeader 
                    title={title || 'Web View'} 
                    showBack={true}
                    showSearch={false}
                    onBackPress={() => router.back()}
                />
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
                </View>
            </SafeAreaView>
        );
    }

    // Ensure URL has protocol
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') 
        ? url 
        : `https://${url}`;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <ScreenHeader 
                title={title || 'Loading...'} 
                showBack={true}
                showSearch={false}
                onBackPress={() => router.back()}
            />
            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            )}
            <WebView
                source={{ uri: fullUrl }}
                style={styles.webview}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.error('WebView error: ', nativeEvent);
                    setLoading(false);
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scalesPageToFit={true}
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
    },
    webview: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
    },
    loadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.backgroundWhite,
        zIndex: 1,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
});
