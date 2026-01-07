import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    StyleSheet,
    Image,
    Dimensions,
    Animated,
    Platform,
    StatusBar,
} from 'react-native';
import * as NavigationBar from 'expo-navigation-bar'; // Added NavigationBar import

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

const SPLASH_IMAGE_URL = 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/splash.jpg';
const REMOTE_IMAGE_TIMEOUT = 3000;
const MIN_SPLASH_DURATION = 2000;
const FADE_OUT_DURATION = 400;

interface AnimatedSplashScreenProps {
    onFinish?: () => void;
}

export const AnimatedSplashScreen = ({ onFinish }: AnimatedSplashScreenProps) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const [imageSource, setImageSource] = useState(require('../../assets/images/splash.png'));
    const [imageLoaded, setImageLoaded] = useState(false);
    const [startTime] = useState(Date.now());
    const timeoutRef = useRef<any>(null);
    const imageLoadTimeoutRef = useRef<any>(null);

    useEffect(() => {
        if (Platform.OS === 'android') {
            // Hide bars completely for splash
            StatusBar.setHidden(true);
            NavigationBar.setVisibilityAsync('hidden');
            NavigationBar.setBehaviorAsync('overlay-swipe');
        }

        const loadRemoteImage = () => {
            const remoteImageSource = { uri: SPLASH_IMAGE_URL };

            Image.prefetch(SPLASH_IMAGE_URL)
                .then(() => {
                    if (!imageLoaded) {
                        setImageSource(remoteImageSource);
                        setImageLoaded(true);
                    }
                })
                .catch(() => {
                    if (!imageLoaded) {
                        setImageSource(require('../../assets/images/splash.png'));
                        setImageLoaded(true);
                    }
                });

            imageLoadTimeoutRef.current = setTimeout(() => {
                if (!imageLoaded) {
                    setImageSource(require('../../assets/images/splash.png'));
                    setImageLoaded(true);
                }
            }, REMOTE_IMAGE_TIMEOUT);
        };

        loadRemoteImage();

        return () => {
            // Restore bars when splash finishes
            if (Platform.OS === 'android') {
                StatusBar.setHidden(false);
                NavigationBar.setVisibilityAsync('visible');
            }
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (imageLoadTimeoutRef.current) clearTimeout(imageLoadTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const startFadeOut = () => {
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

        if (imageLoaded) {
            startFadeOut();
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [imageLoaded, fadeAnim, onFinish, startTime]);

    const handleImageError = () => {
        // Check if it's already the local image to avoid infinite loop
        // But since require return number, and uri returns object, we can check property
        if (imageSource && typeof imageSource === 'object' && 'uri' in imageSource) {
            setImageSource(require('../../assets/images/splash.png'));
            setImageLoaded(true);
        }
    };

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <Image
                source={imageSource}
                style={styles.splashImage}
                resizeMode="cover"
                onError={handleImageError}
                onLoad={() => {
                    // Either remote or local loaded
                    setImageLoaded(true);
                }}
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        height: SCREEN_HEIGHT,
        width: SCREEN_WIDTH,
        backgroundColor: '#ffffff',
        zIndex: 99999,
    },
    splashImage: {
        width: '100%',
        height: '100%',
        flex: 1,
    },
});
