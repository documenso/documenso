declare module 'stripe' {
  namespace Stripe {
    interface Product {
      features?: Array<{ name: string }>;
    }
  }
}
