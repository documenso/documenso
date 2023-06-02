import { useState } from "react";
import { classNames } from "@documenso/lib";
import { STRIPE_PLANS, fetchCheckoutSession, useSubscription } from "@documenso/lib/stripe";
import { Button } from "@documenso/ui";
import { Switch } from "@headlessui/react";

export const BillingPlans = () => {
  const { subscription, isLoading } = useSubscription();
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div>
      {!subscription &&
        STRIPE_PLANS.map((plan) => (
          <div key={plan.name} className="rounded-lg border py-4 px-6">
            <h3 className="text-center text-lg font-medium leading-6 text-gray-900">{plan.name}</h3>

            <div className="my-4 flex justify-center">
              <Switch.Group as="div" className="flex items-center">
                <Switch
                  checked={isAnnual}
                  onChange={setIsAnnual}
                  className={classNames(
                    isAnnual ? "bg-neon-600" : "bg-gray-200",
                    "focus:ring-neon-600 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                  )}>
                  <span
                    aria-hidden="true"
                    className={classNames(
                      isAnnual ? "translate-x-5" : "translate-x-0",
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    )}
                  />
                </Switch>
                <Switch.Label as="span" className="ml-3 text-sm">
                  <span className="font-medium text-gray-900">Annual billing</span>{" "}
                  <span className="text-gray-500">(Save $60)</span>
                </Switch.Label>
              </Switch.Group>
            </div>

            <p className="mt-2 text-center text-gray-500">
              ${(isAnnual ? plan.prices.yearly.price : plan.prices.monthly.price).toFixed(2)}{" "}
              <span className="text-sm text-gray-400">{isAnnual ? "/yr" : "/mo"}</span>
            </p>

            <p className="mt-4 text-center text-sm text-gray-500">
              All you need for easy signing. <br></br>Includes everthing we build this year.
            </p>
            <div className="mt-4">
              <Button
                className="w-full"
                disabled={isLoading}
                onClick={() =>
                  fetchCheckoutSession({
                    priceId: isAnnual ? plan.prices.yearly.priceId : plan.prices.monthly.priceId,
                  }).then((res) => {
                    if (res.success) {
                      window.location.href = res.url;
                    }
                  })
                }>
                Subscribe
              </Button>
            </div>
          </div>
        ))}
    </div>
  );
};
