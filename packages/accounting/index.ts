import { Decimal } from "decimal.js";
import { z } from "zod";

export const currencyCodes = ["GHS", "USD", "AED", "CNY", "RUB"] as const;
export type CurrencyCode = (typeof currencyCodes)[number];

export const currencyPolicy: Record<CurrencyCode, { label: string; decimals: number }> = {
  GHS: { label: "Ghanaian cedi", decimals: 2 },
  USD: { label: "US dollar", decimals: 2 },
  AED: { label: "UAE dirham", decimals: 2 },
  CNY: { label: "Chinese renminbi", decimals: 2 },
  RUB: { label: "Russian ruble", decimals: 2 }
};

export type AccountDefinition = { id: string; accountCode: string; currencyCode: CurrencyCode; status: "ACTIVE" | "INACTIVE" };

export const defaultAccounts: Record<string, AccountDefinition> = {
  "1200": { id: "1200", accountCode: "1200", currencyCode: "USD", status: "ACTIVE" },
  "2010": { id: "2010", accountCode: "2010", currencyCode: "USD", status: "ACTIVE" },
  "1300": { id: "1300", accountCode: "1300", currencyCode: "AED", status: "ACTIVE" },
  "2030": { id: "2030", accountCode: "2030", currencyCode: "AED", status: "ACTIVE" }
};

export const journalLineSchema = z.object({
  accountId: z.string().min(1),
  currencyCode: z.enum(currencyCodes),
  debitAmount: z.string().regex(/^\d+(\.\d+)?$/),
  creditAmount: z.string().regex(/^\d+(\.\d+)?$/),
  description: z.string().max(240).optional()
});

export const postJournalSchema = z.object({
  organizationId: z.string().min(1),
  businessReference: z.string().min(3).max(80),
  transactionType: z.string().min(2).max(80),
  effectiveAt: z.string().datetime(),
  idempotencyKey: z.string().min(8).max(120),
  lines: z.array(journalLineSchema).min(2)
});

export type JournalLineInput = z.infer<typeof journalLineSchema>;
export type PostJournalInput = z.infer<typeof postJournalSchema>;

export type PostedJournal = PostJournalInput & {
  journalId: string;
  journalNumber: string;
  status: "POSTED";
  postedAt: string;
};

export class LedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerValidationError";
  }
}

function amount(value: string): Decimal {
  const parsed = new Decimal(value);
  if (!parsed.isFinite() || parsed.isNegative() || parsed.isZero()) {
    throw new LedgerValidationError("Debit and credit amounts must be positive finite decimals.");
  }
  return parsed;
}

function assertPrecision(value: Decimal, currency: CurrencyCode): void {
  const allowed = currencyPolicy[currency].decimals;
  if (value.decimalPlaces() > allowed) throw new LedgerValidationError(`${currency} supports at most ${allowed} decimal places.`);
}

export function validateBalancedJournal(input: PostJournalInput, accounts: Record<string, AccountDefinition> = defaultAccounts): void {
  const parsed = postJournalSchema.safeParse(input);
  if (!parsed.success) throw new LedgerValidationError(parsed.error.issues[0]?.message ?? "Invalid journal.");

  const byCurrency = new Map<CurrencyCode, { debit: Decimal; credit: Decimal }>();
  for (const line of input.lines) {
    const account = accounts[line.accountId];
    if (!account) throw new LedgerValidationError(`Account ${line.accountId} is not registered.`);
    if (account.status !== "ACTIVE") throw new LedgerValidationError(`Account ${line.accountId} is inactive.`);
    if (account.currencyCode !== line.currencyCode) throw new LedgerValidationError(`Account ${line.accountId} is restricted to ${account.currencyCode}.`);

    const debit = line.debitAmount === "0" ? new Decimal(0) : amount(line.debitAmount);
    const credit = line.creditAmount === "0" ? new Decimal(0) : amount(line.creditAmount);
    assertPrecision(debit, line.currencyCode);
    assertPrecision(credit, line.currencyCode);
    if (!debit.isZero() && !credit.isZero()) throw new LedgerValidationError("A journal line cannot contain both debit and credit amounts.");
    if (debit.isZero() && credit.isZero()) throw new LedgerValidationError("Every journal line must contain a positive debit or credit amount.");

    const current = byCurrency.get(line.currencyCode) ?? { debit: new Decimal(0), credit: new Decimal(0) };
    current.debit = current.debit.plus(debit);
    current.credit = current.credit.plus(credit);
    byCurrency.set(line.currencyCode, current);
  }

  for (const [currency, totals] of byCurrency.entries()) {
    if (!totals.debit.eq(totals.credit)) throw new LedgerValidationError(`${currency} journal is unbalanced: debits ${totals.debit.toFixed()} vs credits ${totals.credit.toFixed()}.`);
  }
}

function fingerprint(input: PostJournalInput): string {
  return JSON.stringify({
    organizationId: input.organizationId,
    businessReference: input.businessReference,
    transactionType: input.transactionType,
    effectiveAt: input.effectiveAt,
    lines: input.lines
  });
}

export class InMemoryLedger {
  private readonly journals: PostedJournal[] = [];
  private readonly idempotency = new Map<string, { fingerprint: string; journal: PostedJournal }>();
  private readonly businessReferences = new Map<string, string>();
  private sequence = 1000;

  post(input: PostJournalInput): PostedJournal {
    validateBalancedJournal(input);
    const inputFingerprint = fingerprint(input);
    const existing = this.idempotency.get(input.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== inputFingerprint) throw new LedgerValidationError("Idempotency key was already used with a different journal payload.");
      return existing.journal;
    }

    const businessKey = `${input.organizationId}:${input.businessReference}`;
    if (this.businessReferences.has(businessKey)) throw new LedgerValidationError(`Business reference ${input.businessReference} is already posted for this organization.`);

    const posted: PostedJournal = {
      ...input,
      journalId: `jrnl_${this.journals.length + 1}`,
      journalNumber: `JRN-${this.sequence++}`,
      status: "POSTED",
      postedAt: new Date().toISOString()
    };
    this.journals.push(posted);
    this.idempotency.set(input.idempotencyKey, { fingerprint: inputFingerprint, journal: posted });
    this.businessReferences.set(businessKey, posted.journalId);
    return posted;
  }

  list(): readonly PostedJournal[] {
    return this.journals;
  }

  reverse(journalId: string, idempotencyKey: string): PostedJournal {
    const original = this.journals.find((journal) => journal.journalId === journalId);
    if (!original) throw new LedgerValidationError("Journal to reverse was not found.");
    return this.post({
      organizationId: original.organizationId,
      businessReference: `${original.businessReference}-REVERSAL`,
      transactionType: "REVERSAL",
      effectiveAt: new Date().toISOString(),
      idempotencyKey,
      lines: original.lines.map((line) => ({ ...line, debitAmount: line.creditAmount, creditAmount: line.debitAmount, description: `Reversal of ${original.journalNumber}` }))
    });
  }
}
