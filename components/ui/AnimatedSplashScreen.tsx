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

const REMOTE_VIDEO_TIMEOUT = 6000;
const MIN_SPLASH_DURATION = 1200;
const FADE_OUT_DURATION = 400;
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

interface AnimatedSplashScreenProps {
    onFinish?: () => void;
    splashUrl?: string | null;
}

export const AnimatedSplashScreen = ({ onFinish, splashUrl: propSplashUrl }: AnimatedSplashScreenProps) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const [startTime] = useState(Date.now());
    const timeoutRef = useRef<any>(null);
    const videoLoadTimeoutRef = useRef<any>(null);
    const hasFinishedRef = useRef(false);

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
            if (url) {
                setDynamicUrl(url);
            }
        }).catch(() => { });

        const unsubscribe = appConfigService.subscribe(() => {
            const updatedUrl = appConfigService.getSplashUrl();
            if (updatedUrl) {
                setDynamicUrl(updatedUrl);
            }
        });
        return unsubscribe;
    }, [propSplashUrl]);

    const finishSplash = useCallback(() => {
        if (hasFinishedRef.current) return;
        hasFinishedRef.current = true;
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_SPLASH_DURATION - elapsed);
        timeoutRef.current = setTimeout(() => {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: FADE_OUT_DURATION,
                useNativeDriver: true,
            }).start(() => {
                onFinish?.();
            });
        }, remainingTime);
    }, [fadeAnim, onFinish, startTime]);

    useEffect(() => {
        if (Platform.OS === 'android') {
            // Hide bars completely for splash
            StatusBar.setHidden(true);
            NavigationBar.setVisibilityAsync('hidden');
            NavigationBar.setBehaviorAsync('overlay-swipe');
        }

        videoLoadTimeoutRef.current = setTimeout(() => {
            if (!hasFinishedRef.current) {
                finishSplash();
            }
        }, REMOTE_VIDEO_TIMEOUT);

        return () => {
            // Restore bars when splash finishes
            if (Platform.OS === 'android') {
                StatusBar.setHidden(false);
                NavigationBar.setVisibilityAsync('visible');
            }
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (videoLoadTimeoutRef.current) clearTimeout(videoLoadTimeoutRef.current);
        };
    }, [finishSplash]);

    const handleMediaError = (error?: any) => {
        if (__DEV__) {
            console.warn('[AnimatedSplashScreen] Media error loading splash:', error);
        }
        if (!hasFinishedRef.current) {
            finishSplash();
        }
    };

    const rawUrl = propSplashUrl ?? dynamicUrl;
    const isValidUrl = (url: string | null | undefined): url is string => {
        if (!url) return false;
        const trimmed = url.trim();
        if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
        return trimmed.startsWith('http://') || trimmed.startsWith('https://');
    };
    const activeUrl = isValidUrl(rawUrl) ? rawUrl.trim() : null;
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
                        if (videoLoadTimeoutRef.current) {
                            clearTimeout(videoLoadTimeoutRef.current);
                            videoLoadTimeoutRef.current = null;
                        }
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
                        if (videoLoadTimeoutRef.current) {
                            clearTimeout(videoLoadTimeoutRef.current);
                            videoLoadTimeoutRef.current = null;
                        }
                        if (status.didJustFinish) {
                            finishSplash();
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
                        if (videoLoadTimeoutRef.current) {
                            clearTimeout(videoLoadTimeoutRef.current);
                            videoLoadTimeoutRef.current = null;
                        }
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
