import { InMemoryLedger, type PostedJournal } from "../packages/accounting/index.js";
import { auditEvents, complianceCases, documents, fxRates, journalFixtures, settlements, shipments, summary, trades, type Provenance } from "./seed.js";

export type RuntimeMode = "MANAGED_DATABASE" | "DEMO_SYNTHETIC";
export type DemoActor = { id: string; role: string; organizationId: string };

export class OperationsRepository {
  readonly mode: RuntimeMode = "DEMO_SYNTHETIC";
  private readonly ledger = new InMemoryLedger();
  private readonly mutableTrades = structuredClone(trades);
  private readonly mutableAuditEvents = structuredClone(auditEvents);

  constructor() {
    for (const fixture of journalFixtures) {
      this.ledger.post({
        organizationId: "org_demo",
        businessReference: fixture.businessReference,
        transactionType: fixture.transactionType,
        effectiveAt: fixture.effectiveAt,
        idempotencyKey: `fixture:${fixture.journalId}`,
        lines: fixture.currency === "USD"
          ? [{ accountId: "1200", currencyCode: "USD", debitAmount: fixture.debit, creditAmount: "0" }, { accountId: "2010", currencyCode: "USD", debitAmount: "0", creditAmount: fixture.credit }]
          : [{ accountId: "1300", currencyCode: "AED", debitAmount: fixture.debit, creditAmount: "0" }, { accountId: "2030", currencyCode: "AED", debitAmount: "0", creditAmount: fixture.credit }]
      });
    }
  }

  provenance(): Provenance {
    return "DEMO_SYNTHETIC";
  }

  summary() {
    return { ...summary, provenance: this.provenance(), mode: this.mode, generatedAt: new Date().toISOString() };
  }

  listTrades(query?: string) {
    const normalized = query?.trim().toLowerCase();
    return this.mutableTrades.filter((trade) => !normalized || [trade.tradeReference, trade.commodity, trade.buyer, trade.destinationCountry, trade.status].some((field) => field.toLowerCase().includes(normalized)));
  }

  getTrade(id: string) {
    return this.mutableTrades.find((trade) => trade.id === id);
  }

  placeTradeOnHold(id: string, actor: DemoActor, reason: string) {
    const trade = this.getTrade(id);
    if (!trade) return undefined;
    trade.status = "ON_HOLD";
    trade.readiness = Math.min(trade.readiness, 49);
    trade.blockers = [...new Set([...trade.blockers, reason])];
    trade.updatedAt = new Date().toISOString();
    this.recordAudit({ action: "TRADE_HOLD_APPLIED", actor, entity: id, result: "ON_HOLD", metadata: { reason } });
    return trade;
  }

  journals() {
    return this.ledger.list().map((journal) => ({
      ...journal,
      currency: journal.lines[0]?.currencyCode,
      debit: journal.lines.reduce((total, line) => total + Number(line.debitAmount), 0).toFixed(2),
      credit: journal.lines.reduce((total, line) => total + Number(line.creditAmount), 0).toFixed(2),
      provenance: this.provenance()
    }));
  }

  postJournal(input: Parameters<InMemoryLedger["post"]>[0], actor: DemoActor): PostedJournal {
    const journal = this.ledger.post(input);
    this.recordAudit({ action: "JOURNAL_POSTED", actor, entity: journal.journalId, result: journal.status, metadata: { journalNumber: journal.journalNumber, idempotencyKey: input.idempotencyKey } });
    return journal;
  }

  reverseJournal(journalId: string, idempotencyKey: string, actor: DemoActor): PostedJournal {
    const reversal = this.ledger.reverse(journalId, idempotencyKey);
    this.recordAudit({ action: "JOURNAL_REVERSED", actor, entity: reversal.journalId, result: reversal.status, metadata: { reversalOf: journalId } });
    return reversal;
  }

  private recordAudit(event: { action: string; actor: DemoActor; entity: string; result: string; metadata?: Record<string, unknown> }) {
    this.mutableAuditEvents.unshift({
      id: `audit_runtime_${this.mutableAuditEvents.length + 1}`,
      time: new Date().toISOString().slice(11, 19),
      action: event.action,
      actor: `${event.actor.id} · ${event.actor.role}`,
      entity: event.entity,
      result: event.result,
      metadata: event.metadata,
      provenance: this.provenance()
    });
  }

  get datasets() {
    return { complianceCases, documents, settlements, shipments, fxRates, auditEvents: this.mutableAuditEvents };
  }
}
