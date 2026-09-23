import { appConfigService } from '@/services/appConfigService';
import { ResizeMode, Video } from 'expo-av';
import * as NavigationBar from 'expo-navigation-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Platform,
    StatusBar,
    StyleSheet
} from 'react-native';
import { SvgUri } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

const MAX_SPLASH_TIMEOUT = 2500;
const MIN_SPLASH_DURATION = 1000;
const FADE_OUT_DURATION = 350;
const SPLASH_BG = '#F4EEE5';

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

const isSvgUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    const clean = url.split('?')[0].toLowerCase();
    return clean.endsWith('.svg');
};

const isValidUrl = (url: string | null | undefined): url is string => {
    if (!url) return false;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
    return trimmed.startsWith('http://') || trimmed.startsWith('https://');
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
    const [fallbackToLocal, setFallbackToLocal] = useState(false);

    const [dynamicUrl, setDynamicUrl] = useState<string | null>(() => {
        return propSplashUrl ?? appConfigService.getSplashUrl();
    });

    useEffect(() => {
        if (propSplashUrl) {
            setDynamicUrl(propSplashUrl);
            return;
        }
        const currentUrl = appConfigService.getSplashUrl();
        if (currentUrl) {
            setDynamicUrl(currentUrl);
        }
        appConfigService.loadAppConfig().then((cfg) => {
            const url = Platform.OS === 'android' ? cfg?.androidSplashUrl : cfg?.iosSplashUrl;
            if (url && isValidUrl(url)) {
                setDynamicUrl(url);
            }
        }).catch(() => { });

        const unsubscribe = appConfigService.subscribe(() => {
            const updatedUrl = appConfigService.getSplashUrl();
            if (updatedUrl && isValidUrl(updatedUrl)) {
                setDynamicUrl(updatedUrl);
            }
        });
        return unsubscribe;
    }, [propSplashUrl]);

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

            // Safety fallback in case animation callback is skipped
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

        // Hard watchdog: under NO circumstance hold the splash screen longer than 2.5s
        maxTimeoutRef.current = setTimeout(() => {
            if (!hasFinishedRef.current) {
                if (__DEV__) console.warn('[AnimatedSplashScreen] Max timeout reached – finishing splash');
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
        if (!fallbackToLocal && activeUrl) {
            // Immediately fallback to local bundled media
            setFallbackToLocal(true);
        } else if (!hasFinishedRef.current) {
            finishSplash(true);
        }
    };

    const rawUrl = propSplashUrl ?? dynamicUrl;
    const activeUrl = !fallbackToLocal && isValidUrl(rawUrl) ? rawUrl.trim() : null;
    const isSvg = activeUrl ? isSvgUrl(activeUrl) : false;
    const isVideo = activeUrl ? isVideoUrl(activeUrl) : !isSvg && Platform.OS === 'ios';

    const videoSource = activeUrl
        ? { uri: activeUrl }
        : Platform.OS === 'ios'
            ? require('../../assets/images/splash-screen.mp4')
            : null;

    const imageSource = activeUrl
        ? { uri: activeUrl }
        : Platform.OS === 'android'
            ? require('../../assets/images/new-splash-screen.png')
            : null;

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            {isSvg && activeUrl ? (
                <SvgUri
                    uri={activeUrl}
                    width="100%"
                    height="100%"
                    onError={handleMediaError}
                    onLoad={() => {
                        finishSplash();
                    }}
                />
            ) : isVideo && videoSource ? (
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
            ) : imageSource ? (
                <Image
                    source={imageSource}
                    style={styles.splashImage}
                    resizeMode="cover"
                    onError={handleMediaError}
                    onLoadEnd={() => {
                        finishSplash();
                    }}
                />
            ) : null}
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
