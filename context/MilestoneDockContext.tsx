import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type MilestoneDockContextValue = {
    /** Measured height of the bottom milestone strip (0 when no host screen reports layout). */
    dockHeight: number;
    setMilestoneDockHeight: (height: number) => void;
};

const MilestoneDockContext = createContext<MilestoneDockContextValue | null>(null);

export function MilestoneDockProvider({ children }: { children: React.ReactNode }) {
    const [dockHeight, setDockHeight] = useState(0);

    const setMilestoneDockHeight = useCallback((height: number) => {
        setDockHeight((prev) => {
            const next = Math.max(0, Math.round(height));
            return next === prev ? prev : next;
        });
    }, []);

    const value = useMemo(
        () => ({ dockHeight, setMilestoneDockHeight }),
        [dockHeight, setMilestoneDockHeight]
    );

    return <MilestoneDockContext.Provider value={value}>{children}</MilestoneDockContext.Provider>;
}

export function useMilestoneDock(): MilestoneDockContextValue {
    const ctx = useContext(MilestoneDockContext);
    if (!ctx) {
        throw new Error('useMilestoneDock must be used within MilestoneDockProvider');
    }
    return ctx;
}

/** Tab bar / floating UI may render outside the provider in tests — treat as no dock. */
export function useMilestoneDockHeightSafe(): number {
    return useContext(MilestoneDockContext)?.dockHeight ?? 0;
}
