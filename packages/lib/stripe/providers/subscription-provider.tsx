import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchSubscription } from "../fetchers/get-subscription";
import { Subscription, SubscriptionStatus } from "@prisma/client";
import { useSession } from "next-auth/react";


export type SubscriptionContextValue = {
  subscription: Subscription | null;
  hasSubscription: boolean;
  isLoading: boolean;
};

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  hasSubscription: false,
  isLoading: false,
});

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error(`useSubscription must be used within a SubscriptionProvider`);
  }

  return context;
};

export interface SubscriptionProviderProps {
  children: React.ReactNode;
  initialSubscription?: Subscription;
}

export const SubscriptionProvider = ({
  children,
  initialSubscription,
}: SubscriptionProviderProps) => {
  const session = useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(
    initialSubscription || null
  );

  const hasSubscription = useMemo(() => {
    console.log({
      "process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS": process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS,
      enabled: process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS === "true",
      "subscription.status": subscription?.status,
      "subscription.periodEnd": subscription?.periodEnd,
    });

    if (process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS === "true") {
      return (
        subscription?.status === SubscriptionStatus.ACTIVE &&
        !!subscription?.periodEnd &&
        new Date(subscription.periodEnd) > new Date()
      );
    }

    return true;
  }, [subscription]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS === "true" && session.data) {
      setIsLoading(true);
      fetchSubscription().then((res) => {
        if (res.success) {
          setSubscription(res.subscription);
        } else {
          setSubscription(null);
        }

        setIsLoading(false);
      });
    }
  }, [session.data]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        hasSubscription,
        isLoading,
      }}>
      {children}
    </SubscriptionContext.Provider>
  );
};