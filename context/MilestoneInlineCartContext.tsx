import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type MilestoneInlineCartContextValue = {
    /** When true, the Home row renders the cart CTA in `MilestoneCartRow`; `FloatingCartButton` must stay hidden. */
    active: boolean;
    setMilestoneInlineCartInRow: (active: boolean) => void;
};

const MilestoneInlineCartContext = createContext<MilestoneInlineCartContextValue | null>(null);

export function MilestoneInlineCartProvider({ children }: { children: React.ReactNode }) {
    const [active, setActive] = useState(false);
    const setMilestoneInlineCartInRow = useCallback((v: boolean) => {
        setActive(v);
    }, []);
    const value = useMemo(
        () => ({ active, setMilestoneInlineCartInRow }),
        [active, setMilestoneInlineCartInRow]
    );
    return <MilestoneInlineCartContext.Provider value={value}>{children}</MilestoneInlineCartContext.Provider>;
}

export function useMilestoneInlineCartActive(): boolean {
    return useContext(MilestoneInlineCartContext)?.active ?? false;
}

export function useMilestoneInlineCartController(): MilestoneInlineCartContextValue | null {
    return useContext(MilestoneInlineCartContext);
}
