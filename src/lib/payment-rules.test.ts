import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { isFullPayment, supportedPaymentMethods } from "./payment-rules";

describe("Existing manual payment rules", () => {
  test("supports only dinheiro, pix, crédito and débito", () => {
    assert.deepEqual([...supportedPaymentMethods], ["cash", "pix", "credit", "debit"]);
  });
  test("requires the full amount and rejects partial or empty payments", () => {
    assert.equal(isFullPayment(103.4, 103.4), true);
    assert.equal(isFullPayment(50, 103.4), false);
    assert.equal(isFullPayment(104, 103.4), false);
    assert.equal(isFullPayment(0, 0), false);
  });
});