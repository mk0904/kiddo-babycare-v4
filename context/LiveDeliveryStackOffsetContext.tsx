import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type LiveDeliveryStackOffsetContextValue = {
    /** Extra pixels stacked above the tab bar for the live-delivery pill (`LiveDeliveryTabBanner` layout). */
    stackExtraPx: number;
    setStackExtraPx: (px: number) => void;
};

const LiveDeliveryStackOffsetContext = createContext<LiveDeliveryStackOffsetContextValue | null>(null);

export function LiveDeliveryStackOffsetProvider({ children }: { children: React.ReactNode }) {
    const [stackExtraPx, setStackExtraPxState] = useState(0);
    const setStackExtraPx = useCallback((px: number) => {
        setStackExtraPxState(px);
    }, []);

    const value = useMemo(
        () => ({ stackExtraPx, setStackExtraPx }),
        [stackExtraPx, setStackExtraPx],
    );

    return (
        <LiveDeliveryStackOffsetContext.Provider value={value}>
            {children}
        </LiveDeliveryStackOffsetContext.Provider>
    );
}

export function useLiveDeliveryStackOffset(): LiveDeliveryStackOffsetContextValue {
    const ctx = useContext(LiveDeliveryStackOffsetContext);
    if (!ctx) {
        return { stackExtraPx: 0, setStackExtraPx: () => {} };
    }
    return ctx;
}
