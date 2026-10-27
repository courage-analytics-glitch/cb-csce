import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryLedger, LedgerValidationError, validateBalancedJournal } from "../packages/accounting/index.js";

const base = {
  organizationId: "org_test",
  businessReference: "TEST-PURCHASE-001",
  transactionType: "COMMODITY_PURCHASE",
  effectiveAt: "2026-10-27T00:00:00.000Z",
  idempotencyKey: "idem-test-purchase-001",
  lines: [
    { accountId: "1200", currencyCode: "USD" as const, debitAmount: "100000", creditAmount: "0" },
    { accountId: "2010", currencyCode: "USD" as const, debitAmount: "0", creditAmount: "100000" }
  ]
};

test("accepts a balanced journal independently in USD", () => {
  assert.doesNotThrow(() => validateBalancedJournal(base));
});

test("rejects a journal that is unbalanced", () => {
  assert.throws(() => validateBalancedJournal({ ...base, lines: [{ ...base.lines[0], debitAmount: "100001" }, base.lines[1]] }), LedgerValidationError);
});

test("rejects an account that is not registered or currency-compatible", () => {
  assert.throws(() => validateBalancedJournal({ ...base, lines: [{ ...base.lines[0], accountId: "9999" }, base.lines[1]] }), /not registered/);
  assert.throws(() => validateBalancedJournal({ ...base, lines: [{ ...base.lines[0], currencyCode: "AED" }, { ...base.lines[1], currencyCode: "AED" }] }), /restricted to USD/);
});

test("rejects amounts beyond configured currency precision", () => {
  assert.throws(() => validateBalancedJournal({ ...base, lines: [{ ...base.lines[0], debitAmount: "100000.001" }, { ...base.lines[1], creditAmount: "100000.001" }] }), /decimal places/);
});

test("returns the same persisted journal on an idempotent retry", () => {
  const ledger = new InMemoryLedger();
  const first = ledger.post(base);
  const second = ledger.post(base);
  assert.equal(first.journalId, second.journalId);
  assert.equal(ledger.list().length, 1);
});

test("rejects reuse of an idempotency key with a changed payload", () => {
  const ledger = new InMemoryLedger();
  ledger.post(base);
  assert.throws(() => ledger.post({ ...base, transactionType: "DIFFERENT_TRANSACTION" }), /different journal payload/);
});

test("rejects a duplicate business reference under a new idempotency key", () => {
  const ledger = new InMemoryLedger();
  ledger.post(base);
  assert.throws(() => ledger.post({ ...base, idempotencyKey: "idem-test-purchase-002" }), /already posted/);
});

test("reverses a posted journal instead of mutating it", () => {
  const ledger = new InMemoryLedger();
  const original = ledger.post(base);
  const reversal = ledger.reverse(original.journalId, "idem-test-reversal-001");
  assert.equal(reversal.lines[0]?.creditAmount, "100000");
  assert.equal(ledger.list().length, 2);
});
