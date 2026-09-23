import { appConfigService } from '@/services/appConfigService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResizeMode, Video } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import * as NavigationBar from 'expo-navigation-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Platform,
    StatusBar,
    StyleSheet
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

const MAX_SPLASH_TIMEOUT = Platform.OS === 'android' ? 1800 : 2800;
const MIN_SPLASH_DURATION = Platform.OS === 'android' ? 900 : 1300;
const FADE_OUT_DURATION = 250;
const SPLASH_BG = '#F4EEE5';
const CACHE_WAIT_TIMEOUT = 100; // ms to wait for cache/backend before defaulting to local asset

const CACHED_ANDROID_SPLASH_KEY = '@cached_splash_url_android';
const CACHED_IOS_SPLASH_KEY = '@cached_splash_url_ios';

const isVideoUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    const clean = url.split('?')[0].toLowerCase();
    return (
        clean.endsWith('.mp4') ||
        clean.endsWith('.mov') ||
        clean.endsWith('.m4v') ||
        clean.endsWith('.webm') ||
        clean.endsWith('.m3u8')
    );
};

const isValidUrl = (url: string | null | undefined): url is string => {
    if (!url) return false;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://');
};

interface AnimatedSplashScreenProps {
    onFinish?: () => void;
    splashUrl?: string | null;
}

export const AnimatedSplashScreen = ({ onFinish, splashUrl: propSplashUrl }: AnimatedSplashScreenProps) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const [startTime] = useState(Date.now());
    const timeoutRef = useRef<any>(null);
    const maxTimeoutRef = useRef<any>(null);
    const hasFinishedRef = useRef(false);

    // Initial check: if splashUrl is already resolved synchronously, start immediately
    const initialSyncUrl = propSplashUrl ?? appConfigService.getSplashUrl();
    const [activeUrl, setActiveUrl] = useState<string | null>(
        isValidUrl(initialSyncUrl) ? initialSyncUrl.trim() : null
    );
    const [isSourceResolved, setIsSourceResolved] = useState<boolean>(
        Boolean(initialSyncUrl)
    );
    const isLockedRef = useRef<boolean>(Boolean(initialSyncUrl));

    // Resolve source once (from cache or backend) before starting playback so we NEVER switch sources mid-stream
    useEffect(() => {
        if (isLockedRef.current) return;

        let isCancelled = false;
        const cacheKey = Platform.OS === 'android' ? CACHED_ANDROID_SPLASH_KEY : CACHED_IOS_SPLASH_KEY;

        const resolveSource = async () => {
            try {
                // 1. Check AsyncStorage cache
                const cached = await AsyncStorage.getItem(cacheKey);
                if (isCancelled || isLockedRef.current) return;
                if (isValidUrl(cached)) {
                    isLockedRef.current = true;
                    setActiveUrl(cached.trim());
                    setIsSourceResolved(true);
                    return;
                }

                // 2. Check appConfigService
                const serviceUrl = appConfigService.getSplashUrl();
                if (isCancelled || isLockedRef.current) return;
                if (isValidUrl(serviceUrl)) {
                    isLockedRef.current = true;
                    setActiveUrl(serviceUrl.trim());
                    setIsSourceResolved(true);
                    return;
                }
            } catch (e) {
                // Ignore error
            }

            // 3. Fallback to local asset if no remote URL resolved within timeout
            if (!isCancelled && !isLockedRef.current) {
                isLockedRef.current = true;
                setActiveUrl(null);
                setIsSourceResolved(true);
            }
        };

        const timer = setTimeout(() => {
            if (!isLockedRef.current) {
                isLockedRef.current = true;
                setActiveUrl(null);
                setIsSourceResolved(true);
            }
        }, CACHE_WAIT_TIMEOUT);

        resolveSource();

        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, []);

    const finishSplash = useCallback((immediate = false) => {
        if (hasFinishedRef.current) return;
        hasFinishedRef.current = true;

        if (maxTimeoutRef.current) {
            clearTimeout(maxTimeoutRef.current);
            maxTimeoutRef.current = null;
        }

        const elapsed = Date.now() - startTime;
        const remainingTime = immediate ? 0 : Math.max(0, MIN_SPLASH_DURATION - elapsed);

        timeoutRef.current = setTimeout(() => {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: FADE_OUT_DURATION,
                useNativeDriver: true,
            }).start(() => {
                onFinish?.();
            });

            // Safety fallback
            setTimeout(() => {
                onFinish?.();
            }, FADE_OUT_DURATION + 100);
        }, remainingTime);
    }, [fadeAnim, onFinish, startTime]);

    useEffect(() => {
        if (Platform.OS === 'android') {
            StatusBar.setHidden(true);
            NavigationBar.setVisibilityAsync('hidden');
            NavigationBar.setBehaviorAsync('overlay-swipe');
        }

        // Global watchdog: unconditionally dismiss splash after MAX_SPLASH_TIMEOUT
        maxTimeoutRef.current = setTimeout(() => {
            if (!hasFinishedRef.current) {
                if (__DEV__) console.warn('[AnimatedSplashScreen] Watchdog timeout – finishing splash');
                finishSplash(true);
            }
        }, MAX_SPLASH_TIMEOUT);

        return () => {
            if (Platform.OS === 'android') {
                StatusBar.setHidden(false);
                NavigationBar.setVisibilityAsync('visible');
            }
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
        };
    }, [finishSplash]);

    const handleMediaError = (error?: any) => {
        if (__DEV__) {
            console.warn('[AnimatedSplashScreen] Media error loading splash:', error);
        }
        if (!hasFinishedRef.current) {
            finishSplash(true);
        }
    };

    if (!isSourceResolved) {
        // Plain matching background while resolving the single media source (<= 300ms)
        return <Animated.View style={[styles.container, { opacity: fadeAnim }]} />;
    }

    const isVideo = activeUrl ? isVideoUrl(activeUrl) : Platform.OS === 'ios';

    const videoSource = activeUrl && isVideo
        ? { uri: activeUrl }
        : (Platform.OS === 'ios' ? require('../../assets/images/splash-screen.mp4') : null);

    const imageSource = activeUrl && !isVideo
        ? { uri: activeUrl }
        : require('../../assets/images/new-splash-screen.png');

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            {isVideo && videoSource ? (
                <Video
                    source={videoSource}
                    style={StyleSheet.absoluteFill}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isMuted={true}
                    isLooping={false}
                    onError={handleMediaError}
                    onPlaybackStatusUpdate={(status) => {
                        if (!status.isLoaded) return;
                        if (status.didJustFinish) {
                            finishSplash(true);
                        }
                    }}
                />
            ) : (
                <ExpoImage
                    source={imageSource}
                    style={styles.splashImage}
                    contentFit="cover"
                    priority="high"
                    cachePolicy="memory-disk"
                    onError={handleMediaError}
                    onLoad={() => {
                        finishSplash();
                    }}
                />
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        height: SCREEN_HEIGHT,
        width: SCREEN_WIDTH,
        backgroundColor: SPLASH_BG,
        zIndex: 99999,
    },
    splashImage: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
});
