import { describe, expect, test } from "bun:test";
import { isFullPayment, supportedPaymentMethods } from "./payment-rules";

describe("Existing manual payment rules", () => {
  test("supports only dinheiro, pix, crédito and débito", () => {
    expect([...supportedPaymentMethods]).toEqual(["cash", "pix", "credit", "debit"]);
  });
  test("requires the full amount and rejects partial or empty payments", () => {
    expect(isFullPayment(103.4, 103.4)).toBe(true);
    expect(isFullPayment(50, 103.4)).toBe(false);
    expect(isFullPayment(104, 103.4)).toBe(false);
    expect(isFullPayment(0, 0)).toBe(false);
  });
});