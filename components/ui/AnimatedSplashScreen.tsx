import { ResizeMode, Video } from 'expo-av';
import * as NavigationBar from 'expo-navigation-bar'; // Added NavigationBar import
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Platform,
    StatusBar,
    StyleSheet
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

const REMOTE_VIDEO_TIMEOUT = 6000;
const MIN_SPLASH_DURATION = 1200;
const FADE_OUT_DURATION = 400;
const SPLASH_BG = '#F4EEE5';

interface AnimatedSplashScreenProps {
    onFinish?: () => void;
}

export const AnimatedSplashScreen = ({ onFinish }: AnimatedSplashScreenProps) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const [startTime] = useState(Date.now());
    const timeoutRef = useRef<any>(null);
    const videoLoadTimeoutRef = useRef<any>(null);
    const hasFinishedRef = useRef(false);

    const finishSplash = () => {
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
    };

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
    }, []);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleVideoError = () => {
        if (!hasFinishedRef.current) {
            finishSplash();
        }
    };

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            {Platform.OS === 'android' ? (
                <Image
                    source={require('../../assets/images/new-splash-screen.png')}
                    style={styles.splashImage}
                    resizeMode="cover"
                    onLoadEnd={() => {
                        if (videoLoadTimeoutRef.current) {
                            clearTimeout(videoLoadTimeoutRef.current);
                            videoLoadTimeoutRef.current = null;
                        }
                        finishSplash();
                    }}
                />
            ) : (
                <Video
                    source={require('../../assets/images/splash-screen.mp4')}
                    style={styles.splashImage}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping={false}
                    onError={handleVideoError}
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
        width: '100%',
        height: '100%',
        flex: 1,
    },
});
