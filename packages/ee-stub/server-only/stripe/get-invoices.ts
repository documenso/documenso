/**
 * Stub implementation for getting invoices.
 * In the stub version, returns a mock invoice object with required fields.
 */

export const getInvoices = async ({ customerId }: { customerId: string }) => {
  return {
    data: [
      {
        id: 'in_stub',
        invoice_pdf: 'https://example.com/invoice.pdf',
        hosted_invoice_url: 'https://example.com/invoice',
        status: 'paid',
        subtotal: 5000,
        total: 5000,
        amount_paid: 5000,
        amount_due: 0,
        created: Date.now() / 1000,
        paid: true,
        lines: {
          data: [
            {
              quantity: 5,
            },
          ],
        },
        currency: 'usd',
      },
    ],
  };
};
