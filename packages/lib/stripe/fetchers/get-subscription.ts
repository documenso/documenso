import { GetSubscriptionResponse } from "../handlers/get-subscription";

export const fetchSubscription = async () => {
  const response = await fetch("/api/stripe/subscription", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const json: GetSubscriptionResponse = await response.json();

  return json;
};
