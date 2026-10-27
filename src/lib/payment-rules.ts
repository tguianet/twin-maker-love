export const supportedPaymentMethods = ["cash", "pix", "credit", "debit"] as const;
export type PaymentMethod = typeof supportedPaymentMethods[number];

export function isFullPayment(amount: number, total: number) {
  return Number.isFinite(amount) && total > 0 && Math.round(amount * 100) === Math.round(total * 100);
}