import { useSubscription } from "@documenso/lib/stripe"
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { SubscriptionStatus } from '@prisma/client'
import Link from "next/link";

export const BillingWarning = () => {
    const { subscription } = useSubscription();

    return (
        <>
        {subscription?.status === SubscriptionStatus.PAST_DUE && (
            <div className="bg-yellow-50 p-4 sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-3xl items-start justify-center">
                <div className="flex-shrink-0">
                  <PaperAirplaneIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                </div>

                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Your subscription is past due.{" "}
                    <Link href="/account/billing" className="text-yellow-700 underline">
                      Please update your payment information to avoid any service interruptions.
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          )}

          {subscription?.status === SubscriptionStatus.INACTIVE && (
            <div className="bg-red-50 p-4 sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-3xl items-center justify-center">
                <div className="flex-shrink-0">
                  <PaperAirplaneIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>

                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    Your subscription is inactive. You can continue to view and edit your documents,
                    but you will not be able to send them or create new ones.{" "}
                    <Link href="/account/billing" className="text-red-700 underline">
                      You can update your payment information here
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
    )
}