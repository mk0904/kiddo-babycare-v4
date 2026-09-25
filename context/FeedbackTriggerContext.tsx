import React, { createContext, useCallback, useContext, useRef } from 'react';

interface FeedbackTriggerContextType {
  setFeedbackTrigger: (callback: (order: any) => void) => void;
  triggerFeedback: (order: any) => void;
}

const FeedbackTriggerContext = createContext<FeedbackTriggerContextType | null>(null);

export function FeedbackTriggerProvider({ children }: { children: React.ReactNode }) {
  const triggerCallbackRef = useRef<((order: any) => void) | null>(null);

  const setFeedbackTrigger = useCallback((callback: (order: any) => void) => {
    triggerCallbackRef.current = callback;
  }, []);

  const triggerFeedback = useCallback((order: any) => {
    if (triggerCallbackRef.current) {
      triggerCallbackRef.current(order);
    }
  }, []);

  return (
    <FeedbackTriggerContext.Provider value={{ setFeedbackTrigger, triggerFeedback }}>
      {children}
    </FeedbackTriggerContext.Provider>
  );
}

export function useFeedbackTrigger() {
  const context = useContext(FeedbackTriggerContext);
  if (!context) {
    throw new Error('useFeedbackTrigger must be used within FeedbackTriggerProvider');
  }
  return context;
}
