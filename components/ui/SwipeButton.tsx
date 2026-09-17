import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';

interface SwipeButtonProps {
    onComplete: () => void;
    title: string;
    loading?: boolean;
}

const BUTTON_HEIGHT = 52;
const KNOB_SIZE = BUTTON_HEIGHT - 8;

export default function SwipeButton({ onComplete, title, loading }: SwipeButtonProps) {
    const [containerWidth, setContainerWidth] = useState(0);
    const [toggled, setToggled] = useState(false);
    const X = useSharedValue(0);
    const startX = useSharedValue(0);

    const handleComplete = useCallback(() => {
        setToggled(true);
        onComplete();
    }, [onComplete]);

    const maxTranslation = containerWidth - KNOB_SIZE - 8; // 4 padding on each side

    const panGesture = Gesture.Pan()
        .onBegin(() => {
            startX.value = X.value;
        })
        .onUpdate((event) => {
            if (toggled || containerWidth === 0) return;
            let nextPos = startX.value + event.translationX;
            if (nextPos < 0) nextPos = 0;
            if (nextPos > maxTranslation) nextPos = maxTranslation;
            X.value = nextPos;
        })
        .onEnd(() => {
            if (toggled || containerWidth === 0) return;
            if (X.value < maxTranslation * 0.7) {
                X.value = withSpring(0, { damping: 20, stiffness: 200 });
            } else {
                X.value = withSpring(maxTranslation, { damping: 20, stiffness: 200 });
                runOnJS(handleComplete)();
            }
        });

    const AnimatedStyles = {
        swipeable: useAnimatedStyle(() => {
            return {
                transform: [{ translateX: X.value }],
            };
        }),
        swipeText: useAnimatedStyle(() => {
            // maxTranslation might be 0 initially, avoid NaN
            const maxVal = maxTranslation > 0 ? maxTranslation : 1;
            return {
                opacity: withTiming(1 - (X.value / maxVal)),
                transform: [{ translateX: X.value / 2 }]
            };
        })
    };

    return (
        <View 
            style={[styles.container, { opacity: toggled ? 0.8 : 1 }]} 
            onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
        >
            <Animated.Text style={[styles.swipeText, AnimatedStyles.swipeText]}>
                {loading ? 'Processing...' : title}
            </Animated.Text>
            
            {containerWidth > 0 && (
                <GestureDetector gesture={loading || toggled ? Gesture.Pan().enabled(false) : panGesture}>
                    <Animated.View style={[styles.swipeable, AnimatedStyles.swipeable]}>
                        {loading ? (
                            <ActivityIndicator color={Colors.primary} size="small" />
                        ) : (
                            <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
                        )}
                    </Animated.View>
                </GestureDetector>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: BUTTON_HEIGHT,
        width: '100%',
        backgroundColor: Colors.primary,
        borderRadius: BUTTON_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        position: 'relative',
    },
    swipeable: {
        position: 'absolute',
        left: 4,
        height: KNOB_SIZE,
        width: KNOB_SIZE,
        borderRadius: KNOB_SIZE,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    swipeText: {
        color: '#FFFFFF',
        fontFamily: Fonts.LexendSemiBold,
        fontSize: 16,
        zIndex: 2,
    },
});
