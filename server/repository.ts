import { randomUUID } from "node:crypto";
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { Decimal } from "decimal.js";
import { InMemoryLedger, type AccountDefinition, type PostedJournal, type PostJournalInput, validateBalancedJournal } from "../packages/accounting/index.js";
import { auditEvents, complianceCases, documents, fxRates, journalFixtures, settlements, shipments, summary, trades, type Provenance, type Trade } from "./seed.js";
import { migratePool } from "./migrate.js";

type JsonObject = Record<string, unknown>;
type DatabaseRow = RowDataPacket & Record<string, any>;
type OperationalRecordType = "compliance_case" | "document" | "settlement" | "shipment" | "fx_rate" | "counterparty" | "workflow" | "agent_finding" | "report";

export type RuntimeMode = "MANAGED_DATABASE" | "DEMO_SYNTHETIC";
export type DemoActor = { id: string; role: string; organizationId: string };

const ORGANIZATION_ID = "org_demo";

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function jsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function compactMillions(value: Decimal): string {
  return `${value.div(1_000_000).toDecimalPlaces(2).toFixed(2)}M`;
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

const managedCounterparties = [
  { id: "cp_7001", party: "Sino-Atlantic Materials Ltd", type: "Buyer", jurisdiction: "China", ownership: "Verified", screening: "STALE_REVIEW" },
  { id: "cp_7002", party: "Emirates Cocoa Trading FZE", type: "Buyer", jurisdiction: "UAE", ownership: "Verified", screening: "CLEAR" },
  { id: "cp_7003", party: "Keta Marine Logistics", type: "Carrier", jurisdiction: "Ghana", ownership: "Pending refresh", screening: "REVIEW_REQUIRED" }
];

export class OperationsRepository {
  private readonly ledger = new InMemoryLedger();
  private readonly mutableTrades = structuredClone(trades);
  private readonly mutableAuditEvents = structuredClone(auditEvents);
  private pool: Pool | undefined;
  private initialized = false;
  private runtimeMode: RuntimeMode = "DEMO_SYNTHETIC";

  constructor() {
    this.seedInMemoryLedger();
  }

  get mode(): RuntimeMode {
    return this.runtimeMode;
  }

  /**
   * Explicit startup boundary. The API tests and local unit consumers can construct a
   * repository without touching the shared database; the production server calls this
   * method before it begins listening and fails closed if the managed database is unavailable.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      this.initialized = true;
      return;
    }

    this.pool = mysql.createPool(databaseUrl);
    try {
      await migratePool(this.pool);
      await this.seedManagedDatabase();
      this.runtimeMode = "MANAGED_DATABASE";
      this.initialized = true;
    } catch (error) {
      await this.pool.end();
      this.pool = undefined;
      throw error;
    }
  }

  provenance(): Provenance {
    return this.mode;
  }

  async summary() {
    if (!this.isManaged()) return { ...summary, provenance: this.provenance(), mode: this.mode, generatedAt: new Date().toISOString() };

    const persistedTrades = await this.listTrades();
    const activeTrades = persistedTrades.filter((trade) => !["CLOSED", "CANCELLED", "SETTLED"].includes(trade.status));
    const byCurrency = new Map<string, Decimal>();
    const byCommodity = new Map<string, Decimal>();
    let totalQuantity = new Decimal(0);
    for (const trade of activeTrades) {
      const value = new Decimal(trade.contractValue.replaceAll(",", ""));
      byCurrency.set(trade.contractCurrency, (byCurrency.get(trade.contractCurrency) ?? new Decimal(0)).plus(value));
      byCommodity.set(trade.commodity, (byCommodity.get(trade.commodity) ?? new Decimal(0)).plus(value.div(1_000_000)));
      totalQuantity = totalQuantity.plus(new Decimal(trade.quantity.replaceAll(",", "")));
    }

    return {
      ...summary,
      kpis: {
        ...summary.kpis,
        activeTradeValue: [...byCurrency.entries()].map(([currency, value]) => ({ currency, value: compactMillions(value) })),
        volumeInTransit: `${totalQuantity.toDecimalPlaces(0).toNumber().toLocaleString()} MT`
      },
      tradeByCommodity: [...byCommodity.entries()].map(([name, value]) => ({ name, value: value.toNumber() })),
      provenance: this.provenance(),
      mode: this.mode,
      generatedAt: new Date().toISOString()
    };
  }

  async listTrades(query?: string): Promise<Trade[]> {
    const normalized = query?.trim().toLowerCase();
    const rows = this.isManaged() ? await this.databaseTrades() : this.mutableTrades;
    return rows.filter((trade) => !normalized || [trade.tradeReference, trade.commodity, trade.buyer, trade.destinationCountry, trade.status].some((field) => field.toLowerCase().includes(normalized)));
  }

  async getTrade(id: string): Promise<Trade | undefined> {
    if (!this.isManaged()) return this.mutableTrades.find((trade) => trade.id === id);
    const rows = await this.databaseTrades(id);
    return rows[0];
  }

  async placeTradeOnHold(id: string, actor: DemoActor, reason: string): Promise<Trade | undefined> {
    if (!this.isManaged()) {
      const trade = this.mutableTrades.find((item) => item.id === id);
      if (!trade) return undefined;
      trade.status = "ON_HOLD";
      trade.readiness = Math.min(trade.readiness, 49);
      trade.blockers = [...new Set([...trade.blockers, reason])];
      trade.updatedAt = new Date().toISOString();
      this.recordAudit({ action: "TRADE_HOLD_APPLIED", actor, entity: id, result: "ON_HOLD", metadata: { reason } });
      return trade;
    }

    const pool = this.requirePool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.query<DatabaseRow[]>("SELECT * FROM trades WHERE organization_id = ? AND id = ? FOR UPDATE", [actor.organizationId, id]);
      const existing = existingRows[0];
      if (!existing) {
        await connection.rollback();
        return undefined;
      }
      const blockers = [...new Set([...jsonValue<string[]>(existing.blockers, []), reason])];
      await connection.query("UPDATE trades SET status = 'ON_HOLD', readiness = LEAST(readiness, 49), blockers = ?, updated_at = UTC_TIMESTAMP() WHERE organization_id = ? AND id = ?", [JSON.stringify(blockers), actor.organizationId, id]);
      await this.insertAudit(connection, actor, "TRADE_HOLD_APPLIED", "TRADE", id, "ON_HOLD", { reason });
      await connection.commit();
      return this.getTrade(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async journals() {
    if (!this.isManaged()) return this.ledger.list().map((journal) => this.journalView(journal));
    const rows = await this.databaseJournals();
    return rows.map((journal) => this.journalView(journal));
  }

  async commodityBatches() {
    const records = await this.listTrades();
    return records.map((trade) => ({
      id: `${trade.id}_batch_01`,
      batchReference: `${trade.tradeReference}-B01`,
      tradeReference: trade.tradeReference,
      commodity: trade.commodity,
      quantity: trade.quantity,
      unit: trade.unit,
      inspection: trade.status === "ON_HOLD" ? "REVIEW_REQUIRED" : "VERIFIED",
      valuation: trade.contractValue,
      currency: trade.contractCurrency,
      clearance: trade.status,
      provenance: this.provenance()
    }));
  }

  async accounts() {
    if (!this.isManaged()) {
      return [
        { id: "1200", account: "1200", name: "Commodity receivable", type: "Asset", currency: "USD", status: "ACTIVE" },
        { id: "2010", account: "2010", name: "Commodity payable", type: "Liability", currency: "USD", status: "ACTIVE" },
        { id: "1300", account: "1300", name: "Escrow receivable", type: "Asset", currency: "AED", status: "ACTIVE" },
        { id: "2030", account: "2030", name: "Escrow payable", type: "Liability", currency: "AED", status: "ACTIVE" }
      ].map((account) => ({ ...account, provenance: this.provenance() }));
    }
    const [rows] = await this.requirePool().query<DatabaseRow[]>("SELECT id, account_code, name, account_type, currency_code, status FROM ledger_accounts WHERE organization_id = ? ORDER BY account_code", [ORGANIZATION_ID]);
    return rows.map((row) => ({ id: String(row.id), account: String(row.account_code), name: String(row.name), type: String(row.account_type), currency: String(row.currency_code), status: String(row.status), provenance: this.provenance() }));
  }

  async fxExposures() {
    if (!this.isManaged()) return summary.fxExposure.map((item) => ({ ...item, scenario: "Adverse estimate", reportingCurrency: "GHS", provenance: this.provenance() }));
    const records = (await this.getOperational("fx_rate")) as typeof fxRates;
    return summary.fxExposure.map((item) => ({ ...item, scenario: "Adverse estimate", reportingCurrency: "GHS", rateSnapshots: records.length, provenance: this.provenance() }));
  }

  async counterparties() {
    const records = this.isManaged() ? await this.getOperational("counterparty") : managedCounterparties;
    return records.map((counterparty) => ({ ...counterparty, provenance: this.provenance() }));
  }

  async workflows() {
    if (!this.isManaged()) return summary.pipeline.map((item, index) => ({ id: `workflow_${index + 1}`, stage: item.label, open: item.count, owner: index % 2 ? "Compliance checker" : "Operations maker", control: index === 0 ? "Approval required" : "Evidence gate", provenance: this.provenance() }));
    const records = await this.getOperational("workflow");
    return records.map((record) => ({ ...record, provenance: this.provenance() }));
  }

  async liquidityRisk() {
    const exposure = await this.fxExposures();
    return exposure.map((item) => ({ id: `liquidity_${item.pair.replaceAll("/", "_")}`, pair: item.pair, exposure: item.exposure, shock: item.shock, scenario: "Adverse estimate", provenance: this.provenance() }));
  }

  async demurrage() {
    const records = this.isManaged() ? await this.getOperational("shipment") : shipments;
    return records.map((shipment) => ({ id: shipment.id, vessel: shipment.vessel, tradeReference: shipment.tradeReference, milestone: shipment.milestone, eta: shipment.eta, demurrage: shipment.demurrage, action: shipment.status === "AT_RISK" ? "ESCALATE" : "MONITOR", provenance: this.provenance() }));
  }

  async reconciliation() {
    const records = await this.journals();
    return records.map((journal) => ({ id: `recon_${journal.journalId}`, reference: journal.businessReference, journal: journal.journalNumber, amount: `${journal.currency} ${journal.debit}`, status: journal.status === "POSTED" ? "MATCHED" : "REVIEW_REQUIRED", owner: "Treasury control", provenance: this.provenance() }));
  }

  async reports() {
    if (!this.isManaged()) return [
      { id: "report_8001", report: "Trade exposure pack", scope: "Trades · FX · settlements", cadence: "Daily", status: "READY" },
      { id: "report_8002", report: "Compliance exception pack", scope: "Cases · documents", cadence: "On demand", status: "REVIEW_REQUIRED" },
      { id: "report_8003", report: "Liquidity and demurrage pack", scope: "Treasury · shipments", cadence: "Daily", status: "READY" }
    ].map((report) => ({ ...report, provenance: this.provenance() }));
    return (await this.getOperational("report")).map((report) => ({ ...report, provenance: this.provenance() }));
  }

  async agentFindings() {
    if (!this.isManaged()) return this.fallbackAgentFindings();
    return (await this.getOperational("agent_finding")).map((finding) => ({ ...finding, provenance: this.provenance(), model: "CB-CSCE advisory ruleset v0.1" }));
  }

  async postJournal(input: PostJournalInput, actor: DemoActor): Promise<PostedJournal> {
    if (!this.isManaged()) {
      const journal = this.ledger.post(input);
      this.recordAudit({ action: "JOURNAL_POSTED", actor, entity: journal.journalId, result: journal.status, metadata: { journalNumber: journal.journalNumber, idempotencyKey: input.idempotencyKey } });
      return journal;
    }

    const pool = this.requirePool();
    const connection = await pool.getConnection();
    try {
      const accounts = await this.accountDefinitions(connection, input.organizationId);
      validateBalancedJournal(input, accounts);
      const inputFingerprint = fingerprint(input);
      await connection.beginTransaction();
      const [existingRows] = await connection.query<DatabaseRow[]>("SELECT * FROM journal_entries WHERE organization_id = ? AND idempotency_key = ? FOR UPDATE", [input.organizationId, input.idempotencyKey]);
      const existing = existingRows[0];
      if (existing) {
        const existingFingerprint = jsonValue<JsonObject>(existing.metadata, {}).fingerprint;
        if (existingFingerprint !== inputFingerprint) throw new Error("Idempotency key was already used with a different journal payload.");
        await connection.commit();
        const journal = await this.databaseJournalById(String(existing.id));
        if (!journal) throw new Error("Persisted idempotent journal could not be reloaded.");
        return journal;
      }

      const [businessRows] = await connection.query<DatabaseRow[]>("SELECT id FROM journal_entries WHERE organization_id = ? AND business_reference = ? FOR UPDATE", [input.organizationId, input.businessReference]);
      if (businessRows.length) throw new Error(`Business reference ${input.businessReference} is already posted for this organization.`);

      const journalId = `jrnl_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
      const journalNumber = `JRN-${Date.now()}-${randomUUID().replaceAll("-", "").slice(0, 6)}`;
      await connection.query("INSERT INTO journal_entries (id, organization_id, journal_number, business_reference, transaction_type, description, effective_at, posted_at, status, created_by, idempotency_key, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), 'POSTED', ?, ?, ?)", [journalId, input.organizationId, journalNumber, input.businessReference, input.transactionType, null, new Date(input.effectiveAt), actor.id, input.idempotencyKey, JSON.stringify({ fingerprint: inputFingerprint })]);
      for (const [index, line] of input.lines.entries()) {
        await connection.query("INSERT INTO journal_lines (id, journal_entry_id, account_id, currency_code, debit_amount, credit_amount, description) VALUES (?, ?, ?, ?, ?, ?, ?)", [`${journalId}_line_${index + 1}`, journalId, line.accountId, line.currencyCode, line.debitAmount, line.creditAmount, line.description ?? null]);
      }
      await this.insertAudit(connection, actor, "JOURNAL_POSTED", "JOURNAL", journalId, "POSTED", { journalNumber, idempotencyKey: input.idempotencyKey });
      await connection.commit();
      const journal = await this.databaseJournalById(journalId);
      if (!journal) throw new Error("Journal was committed but could not be reloaded.");
      return journal;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async reverseJournal(journalId: string, idempotencyKey: string, actor: DemoActor): Promise<PostedJournal> {
    const original = this.isManaged() ? await this.databaseJournalById(journalId) : this.ledger.list().find((journal) => journal.journalId === journalId);
    if (!original) throw new Error("Journal to reverse was not found.");
    return this.postJournal({
      organizationId: original.organizationId,
      businessReference: `${original.businessReference}-REVERSAL`,
      transactionType: "REVERSAL",
      effectiveAt: new Date().toISOString(),
      idempotencyKey,
      lines: original.lines.map((line) => ({ ...line, debitAmount: line.creditAmount, creditAmount: line.debitAmount, description: `Reversal of ${original.journalNumber}` }))
    }, actor);
  }

  async datasets() {
    if (!this.isManaged()) return { complianceCases, documents, settlements, shipments, fxRates, auditEvents: this.mutableAuditEvents };
    const [cases, docs, settlementRows, shipmentRows, rateRows, auditRows] = await Promise.all([
      this.getOperational("compliance_case"),
      this.getOperational("document"),
      this.getOperational("settlement"),
      this.getOperational("shipment"),
      this.getOperational("fx_rate"),
      this.databaseAuditEvents()
    ]);
    return {
      complianceCases: cases.map((record) => ({ ...record, provenance: this.provenance() })),
      documents: docs.map((record) => ({ ...record, provenance: this.provenance() })),
      settlements: settlementRows.map((record) => ({ ...record, provenance: this.provenance() })),
      shipments: shipmentRows.map((record) => ({ ...record, provenance: this.provenance() })),
      fxRates: rateRows.map((record) => ({ ...record, provenance: this.provenance() })),
      auditEvents: auditRows
    };
  }

  private isManaged(): boolean {
    return this.runtimeMode === "MANAGED_DATABASE" && Boolean(this.pool);
  }

  private requirePool(): Pool {
    if (!this.pool) throw new Error("Managed database repository has not been initialized.");
    return this.pool;
  }

  private seedInMemoryLedger(): void {
    for (const fixture of journalFixtures) {
      this.ledger.post({
        organizationId: ORGANIZATION_ID,
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

  private async seedManagedDatabase(): Promise<void> {
    const pool = this.requirePool();
    await pool.query("INSERT IGNORE INTO organizations (id, name, functional_currency, environment, created_at) VALUES (?, ?, 'GHS', 'DEMO', UTC_TIMESTAMP())", [ORGANIZATION_ID, "Kumasi Origin · Ghana operations"]);
    const accounts = [
      ["1200", "Commodity receivable", "Asset", "DEBIT", "USD"],
      ["2010", "Commodity payable", "Liability", "CREDIT", "USD"],
      ["1300", "Escrow receivable", "Asset", "DEBIT", "AED"],
      ["2030", "Escrow payable", "Liability", "CREDIT", "AED"]
    ];
    for (const [code, name, type, normalBalance, currency] of accounts) {
      await pool.query("INSERT IGNORE INTO ledger_accounts (id, organization_id, account_code, name, account_type, normal_balance, currency_code, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP())", [code, ORGANIZATION_ID, code, name, type, normalBalance, currency]);
    }
    for (const trade of trades) {
      await pool.query("INSERT IGNORE INTO trades (id, organization_id, trade_reference, contract_number, buyer, seller, commodity, quantity, unit, contract_value, contract_currency, origin_country, destination_country, loading_port, destination_port, status, risk_level, readiness, blockers, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())", [trade.id, ORGANIZATION_ID, trade.tradeReference, trade.contractNumber, trade.buyer, trade.seller, trade.commodity, trade.quantity.replaceAll(",", ""), trade.unit, trade.contractValue, trade.contractCurrency, trade.originCountry, trade.destinationCountry, trade.loadingPort, trade.destinationPort, trade.status, trade.riskLevel, trade.readiness, JSON.stringify(trade.blockers)]);
    }
    for (const fixture of journalFixtures) {
      await pool.query("INSERT IGNORE INTO journal_entries (id, organization_id, journal_number, business_reference, transaction_type, description, effective_at, posted_at, status, created_by, idempotency_key, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [fixture.journalId, ORGANIZATION_ID, fixture.journalNumber, fixture.businessReference, fixture.transactionType, fixture.description, new Date(fixture.effectiveAt), new Date(fixture.postedAt), fixture.status, "system.synthetic-fixture", `fixture:${fixture.journalId}`, JSON.stringify({ provenance: "DEMO_SYNTHETIC", fingerprint: "fixture" })]);
      const debitAccount = fixture.currency === "USD" ? "1200" : "1300";
      const creditAccount = fixture.currency === "USD" ? "2010" : "2030";
      await pool.query("INSERT IGNORE INTO journal_lines (id, journal_entry_id, account_id, currency_code, debit_amount, credit_amount, description) VALUES (?, ?, ?, ?, ?, '0', ?), (?, ?, ?, ?, '0', ?, ?)", [`${fixture.journalId}_debit`, fixture.journalId, debitAccount, fixture.currency, fixture.debit, fixture.description, `${fixture.journalId}_credit`, fixture.journalId, creditAccount, fixture.currency, fixture.credit, fixture.description]);
    }
    for (const event of auditEvents) {
      const [actorId, actorRole = "system"] = event.actor.split(" · ");
      await pool.query("INSERT IGNORE INTO audit_events (id, organization_id, actor_id, actor_role, action, entity_type, entity_id, occurred_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)", [event.id, ORGANIZATION_ID, actorId, actorRole, event.action, "SEED", event.entity, JSON.stringify({ result: event.result, provenance: "DEMO_SYNTHETIC" })]);
    }

    const operational: Array<[OperationalRecordType, string, unknown]> = [];
    for (const record of complianceCases) operational.push(["compliance_case", record.id, record]);
    for (const record of documents) operational.push(["document", record.id, record]);
    for (const record of settlements) operational.push(["settlement", record.id, record]);
    for (const record of shipments) operational.push(["shipment", record.id, record]);
    for (const record of fxRates) operational.push(["fx_rate", record.pair.replaceAll("/", "_"), record]);
    for (const record of managedCounterparties) operational.push(["counterparty", record.id, record]);
    summary.pipeline.forEach((record, index) => operational.push(["workflow", `workflow_${index + 1}`, { id: `workflow_${index + 1}`, stage: record.label, open: record.count, owner: index % 2 ? "Compliance checker" : "Operations maker", control: index === 0 ? "Approval required" : "Evidence gate" }]));
    for (const record of this.fallbackAgentFindings()) operational.push(["agent_finding", record.id, record]);
    operational.push(["report", "report_8001", { id: "report_8001", report: "Trade exposure pack", scope: "Trades · FX · settlements", cadence: "Daily", status: "READY" }]);
    operational.push(["report", "report_8002", { id: "report_8002", report: "Compliance exception pack", scope: "Cases · documents", cadence: "On demand", status: "REVIEW_REQUIRED" }]);
    operational.push(["report", "report_8003", { id: "report_8003", report: "Liquidity and demurrage pack", scope: "Treasury · shipments", cadence: "Daily", status: "READY" }]);
    for (const [recordType, recordId, payload] of operational) {
      await pool.query("INSERT IGNORE INTO operational_records (organization_id, record_type, record_id, payload, created_at, updated_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())", [ORGANIZATION_ID, recordType, recordId, JSON.stringify(payload)]);
    }
  }

  private async databaseTrades(id?: string): Promise<Trade[]> {
    const [rows] = await this.requirePool().query<DatabaseRow[]>(`SELECT id, trade_reference, contract_number, buyer, seller, commodity, quantity, unit, contract_value, contract_currency, origin_country, destination_country, loading_port, destination_port, status, risk_level, readiness, blockers, updated_at FROM trades WHERE organization_id = ?${id ? " AND id = ?" : ""} ORDER BY updated_at DESC`, id ? [ORGANIZATION_ID, id] : [ORGANIZATION_ID]);
    return rows.map((row) => ({ id: String(row.id), tradeReference: String(row.trade_reference), contractNumber: String(row.contract_number), buyer: String(row.buyer), seller: String(row.seller), commodity: String(row.commodity), quantity: String(row.quantity), unit: String(row.unit), contractValue: String(row.contract_value), contractCurrency: String(row.contract_currency) as Trade["contractCurrency"], originCountry: String(row.origin_country), destinationCountry: String(row.destination_country), loadingPort: String(row.loading_port), destinationPort: String(row.destination_port), status: String(row.status), riskLevel: String(row.risk_level) as Trade["riskLevel"], readiness: Number(row.readiness), blockers: jsonValue<string[]>(row.blockers, []), updatedAt: iso(row.updated_at) }));
  }

  private async databaseJournals(): Promise<PostedJournal[]> {
    const [rows] = await this.requirePool().query<DatabaseRow[]>("SELECT e.id, e.organization_id, e.journal_number, e.business_reference, e.transaction_type, e.effective_at, e.posted_at, e.status, l.account_id, l.currency_code, l.debit_amount, l.credit_amount, l.description FROM journal_entries e JOIN journal_lines l ON l.journal_entry_id = e.id WHERE e.organization_id = ? ORDER BY e.posted_at DESC, l.id", [ORGANIZATION_ID]);
    return this.groupJournalRows(rows);
  }

  private async databaseJournalById(id: string): Promise<PostedJournal | undefined> {
    const [rows] = await this.requirePool().query<DatabaseRow[]>("SELECT e.id, e.organization_id, e.journal_number, e.business_reference, e.transaction_type, e.effective_at, e.posted_at, e.status, l.account_id, l.currency_code, l.debit_amount, l.credit_amount, l.description FROM journal_entries e JOIN journal_lines l ON l.journal_entry_id = e.id WHERE e.organization_id = ? AND e.id = ? ORDER BY l.id", [ORGANIZATION_ID, id]);
    return this.groupJournalRows(rows)[0];
  }

  private groupJournalRows(rows: DatabaseRow[]): PostedJournal[] {
    const grouped = new Map<string, PostedJournal>();
    for (const row of rows) {
      const id = String(row.id);
      const current = grouped.get(id) ?? { journalId: id, journalNumber: String(row.journal_number), organizationId: String(row.organization_id), businessReference: String(row.business_reference), transactionType: String(row.transaction_type), effectiveAt: iso(row.effective_at), idempotencyKey: `persisted:${id}`, lines: [], status: "POSTED", postedAt: iso(row.posted_at) };
      current.lines.push({ accountId: String(row.account_id), currencyCode: String(row.currency_code) as any, debitAmount: String(row.debit_amount), creditAmount: String(row.credit_amount), description: row.description ? String(row.description) : undefined });
      grouped.set(id, current);
    }
    return [...grouped.values()];
  }

  private journalView(journal: PostedJournal) {
    return { ...journal, currency: journal.lines[0]?.currencyCode, debit: journal.lines.reduce((total, line) => total + Number(line.debitAmount), 0).toFixed(2), credit: journal.lines.reduce((total, line) => total + Number(line.creditAmount), 0).toFixed(2), provenance: this.provenance() };
  }

  private async accountDefinitions(connection: PoolConnection, organizationId: string): Promise<Record<string, AccountDefinition>> {
    const [rows] = await connection.query<DatabaseRow[]>("SELECT id, account_code, currency_code, status FROM ledger_accounts WHERE organization_id = ?", [organizationId]);
    return Object.fromEntries(rows.map((row) => [String(row.id), { id: String(row.id), accountCode: String(row.account_code), currencyCode: String(row.currency_code) as AccountDefinition["currencyCode"], status: String(row.status) as AccountDefinition["status"] }]));
  }

  private async insertAudit(connection: PoolConnection, actor: DemoActor, action: string, entityType: string, entityId: string, result: string, metadata?: JsonObject): Promise<void> {
    await connection.query("INSERT INTO audit_events (id, organization_id, actor_id, actor_role, action, entity_type, entity_id, occurred_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)", [`audit_${randomUUID().replaceAll("-", "").slice(0, 24)}`, actor.organizationId, actor.id, actor.role, action, entityType, entityId, JSON.stringify({ ...(metadata ?? {}), result })]);
  }

  private async databaseAuditEvents() {
    const [rows] = await this.requirePool().query<DatabaseRow[]>("SELECT id, actor_id, actor_role, action, entity_id, occurred_at, metadata FROM audit_events WHERE organization_id = ? ORDER BY occurred_at DESC", [ORGANIZATION_ID]);
    return rows.map((row) => {
      const metadata = jsonValue<JsonObject>(row.metadata, {});
      return { id: String(row.id), time: iso(row.occurred_at).slice(11, 19), action: String(row.action), actor: `${row.actor_id} · ${row.actor_role}`, entity: String(row.entity_id), result: String(metadata.result ?? "RECORDED"), metadata, provenance: this.provenance() };
    });
  }

  private async getOperational(type: OperationalRecordType): Promise<JsonObject[]> {
    const [rows] = await this.requirePool().query<DatabaseRow[]>("SELECT payload FROM operational_records WHERE organization_id = ? AND record_type = ? ORDER BY record_id", [ORGANIZATION_ID, type]);
    return rows.map((row) => jsonValue<JsonObject>(row.payload, {}));
  }

  private fallbackAgentFindings() {
    return [
      { id: "agent_hash_1", agent: "Document integrity agent", finding: "Commercial invoice hash mismatch", entity: "doc_3003", severity: "CRITICAL", recommendation: "Hold and request a new signed document", decision: "HUMAN_REVIEW_REQUIRED" },
      { id: "agent_freshness_1", agent: "Evidence freshness agent", finding: "Phytosanitary certificate expires soon", entity: "doc_3002", severity: "HIGH", recommendation: "Refresh evidence before export release", decision: "HUMAN_REVIEW_REQUIRED" },
      { id: "agent_match_1", agent: "Counterparty screening agent", finding: "Potential beneficial-owner similarity", entity: "case_2001", severity: "HIGH", recommendation: "Escalate to compliance reviewer", decision: "HUMAN_REVIEW_REQUIRED" },
      { id: "agent_quantity_1", agent: "Trade consistency agent", finding: "Quantity, value, and shipment evidence require corroboration", entity: "trade_1002", severity: "MEDIUM", recommendation: "Request inspection and valuation evidence", decision: "HUMAN_REVIEW_REQUIRED" }
    ];
  }

  private recordAudit(event: { action: string; actor: DemoActor; entity: string; result: string; metadata?: JsonObject }) {
    this.mutableAuditEvents.unshift({ id: `audit_runtime_${this.mutableAuditEvents.length + 1}`, time: new Date().toISOString().slice(11, 19), action: event.action, actor: `${event.actor.id} · ${event.actor.role}`, entity: event.entity, result: event.result, metadata: event.metadata, provenance: this.provenance() });
  }
}
