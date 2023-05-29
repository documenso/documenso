import { CheckoutSessionRequest, CheckoutSessionResponse } from "../handlers/checkout-session"

export type FetchCheckoutSessionOptions = CheckoutSessionRequest['body']

export const fetchCheckoutSession = async ({ 
    id,
    priceId
}: FetchCheckoutSessionOptions) => {
    const response = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id,
            priceId
        })
    });

    const json: CheckoutSessionResponse = await response.json();

    return json;
}