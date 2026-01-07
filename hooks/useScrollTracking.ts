import { useCallback, useEffect, useRef } from 'react';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';

/**
 * Custom hook to track scroll direction for tab bar visibility
 * Use this hook in any screen with ScrollView or FlatList
 * 
 * @returns {Object} Object containing handleScroll callback and reset function
 */
export const useScrollTracking = () => {
    const { setScrollDirection, reset } = useTabBarVisibility();
    const lastScrollY = useRef(0);

    const handleScroll = useCallback(
        (event: any) => {
            const offsetY = event.nativeEvent.contentOffset.y;
            const isAtTop = offsetY <= 0;
            setScrollDirection(offsetY, isAtTop);
            lastScrollY.current = offsetY;
        },
        [setScrollDirection]
    );

    // Reset scroll tracking when component unmounts or screen changes
    useEffect(() => {
        return () => {
            reset();
        };
    }, [reset]);

    return {
        handleScroll,
        reset,
    };
};
