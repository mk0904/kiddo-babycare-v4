import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';

interface TabBarVisibilityContextType {
    isVisible: boolean;
    scrollProgress: number; // 0 = fully visible, 1 = fully shrunk
    setScrollDirection: (scrollY: number, isAtTop?: boolean) => void;
    reset: () => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextType | undefined>(undefined);

export const useTabBarVisibility = () => {
    const context = useContext(TabBarVisibilityContext);
    if (!context) {
        throw new Error('useTabBarVisibility must be used within TabBarVisibilityProvider');
    }
    return context;
};

export const TabBarVisibilityProvider = ({ children }: { children: ReactNode }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [scrollProgress, setScrollProgress] = useState(0); // 0 = fully visible, 1 = fully shrunk
    const lastScrollY = useRef(0);
    const scrollThreshold = useRef(0);

    const setScrollDirection = useCallback((scrollY: number, isAtTop = false) => {
        // If at top, always show
        if (isAtTop) {
            setScrollProgress(0);
            lastScrollY.current = scrollY;
            scrollThreshold.current = 0;
            return;
        }

        // Calculate scroll direction
        const scrollDelta = scrollY - lastScrollY.current;

        // Only update if scroll delta is significant (more than 5px) to avoid jitter
        if (Math.abs(scrollDelta) < 5) {
            return;
        }

        // Update threshold based on scroll direction
        if (scrollDelta > 0) {
            // Scrolling down - decrease threshold (negative = shrink)
            scrollThreshold.current = Math.max(scrollThreshold.current - scrollDelta, -50);
        } else {
            // Scrolling up - increase threshold (positive = expand)
            scrollThreshold.current = Math.min(scrollThreshold.current - scrollDelta, 50);
        }

        // Calculate scroll progress (0 to 1) based on threshold
        // Only shrink when scrolling down (threshold negative)
        // When scrolling up (threshold positive), always be fully visible (progress = 0)
        let progress;
        if (scrollThreshold.current < 0) {
            progress = Math.min(1, Math.abs(scrollThreshold.current) / 50);
        } else {
            progress = 0;
        }
        setScrollProgress(progress);

        // Update visibility based on scroll progress
        // Consider tab bar hidden when progress > 0.8 (shrunk more than 80%)
        setIsVisible(progress < 0.8);

        lastScrollY.current = scrollY;
    }, []);

    const reset = useCallback(() => {
        setIsVisible(true);
        setScrollProgress(0);
        lastScrollY.current = 0;
        scrollThreshold.current = 0;
    }, []);

    return (
        <TabBarVisibilityContext.Provider
            value={{
                isVisible,
                scrollProgress,
                setScrollDirection,
                reset,
            }}
        >
            {children}
        </TabBarVisibilityContext.Provider>
    );
};
