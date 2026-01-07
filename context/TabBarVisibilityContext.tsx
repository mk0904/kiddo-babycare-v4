import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

interface TabBarVisibilityContextType {
    isVisible: boolean;
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
    const lastScrollY = useRef(0);
    const scrollThreshold = useRef(0);

    const setScrollDirection = useCallback((scrollY: number, isAtTop = false) => {
        // If at top, always show
        if (isAtTop) {
            if (!isVisible) {
                setIsVisible(true);
            }
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
            // Scrolling down - decrease threshold (negative = hide)
            scrollThreshold.current = Math.max(scrollThreshold.current - scrollDelta, -50);
        } else {
            // Scrolling up - increase threshold (positive = show)
            scrollThreshold.current = Math.min(scrollThreshold.current - scrollDelta, 50);
        }

        // Show/hide based on threshold: negative = hide, positive = show
        const shouldShow = scrollThreshold.current >= 0;

        if (shouldShow !== isVisible) {
            setIsVisible(shouldShow);
        }

        lastScrollY.current = scrollY;
    }, [isVisible]);

    const reset = useCallback(() => {
        setIsVisible(true);
        lastScrollY.current = 0;
        scrollThreshold.current = 0;
    }, []);

    return (
        <TabBarVisibilityContext.Provider
            value={{
                isVisible,
                setScrollDirection,
                reset,
            }}
        >
            {children}
        </TabBarVisibilityContext.Provider>
    );
};
