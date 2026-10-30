import { mysqlTable, varchar, text, decimal, datetime, json, mysqlEnum, int, index, uniqueIndex } from "drizzle-orm/mysql-core";

export const organizations = mysqlTable("organizations", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  functionalCurrency: varchar("functional_currency", { length: 3 }).notNull().default("GHS"),
  environment: varchar("environment", { length: 20 }).notNull().default("DEMO"),
  createdAt: datetime("created_at").notNull()
});

export const ledgerAccounts = mysqlTable("ledger_accounts", {
  id: varchar("id", { length: 40 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 40 }).notNull(),
  accountCode: varchar("account_code", { length: 20 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  accountType: varchar("account_type", { length: 30 }).notNull(),
  normalBalance: mysqlEnum("normal_balance", ["DEBIT", "CREDIT"]).notNull(),
  currencyCode: varchar("currency_code", { length: 3 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull()
}, (table) => ({ accountCodeUnique: uniqueIndex("ledger_account_org_code").on(table.organizationId, table.accountCode) }));

export const journalEntries = mysqlTable("journal_entries", {
  id: varchar("id", { length: 40 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 40 }).notNull(),
  journalNumber: varchar("journal_number", { length: 40 }).notNull(),
  businessReference: varchar("business_reference", { length: 80 }).notNull(),
  transactionType: varchar("transaction_type", { length: 80 }).notNull(),
  description: text("description"),
  effectiveAt: datetime("effective_at").notNull(),
  postedAt: datetime("posted_at"),
  status: varchar("status", { length: 20 }).notNull(),
  createdBy: varchar("created_by", { length: 80 }).notNull(),
  approvedBy: varchar("approved_by", { length: 80 }),
  idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
  reversalOfJournalId: varchar("reversal_of_journal_id", { length: 40 }),
  metadata: json("metadata")
}, (table) => ({ idempotencyUnique: uniqueIndex("journal_org_idempotency").on(table.organizationId, table.idempotencyKey) }));

export const journalLines = mysqlTable("journal_lines", {
  id: varchar("id", { length: 40 }).primaryKey(),
  journalEntryId: varchar("journal_entry_id", { length: 40 }).notNull(),
  accountId: varchar("account_id", { length: 40 }).notNull(),
  currencyCode: varchar("currency_code", { length: 3 }).notNull(),
  debitAmount: decimal("debit_amount", { precision: 24, scale: 8 }).notNull().default("0"),
  creditAmount: decimal("credit_amount", { precision: 24, scale: 8 }).notNull().default("0"),
  functionalCurrencyDebit: decimal("functional_currency_debit", { precision: 24, scale: 8 }),
  functionalCurrencyCredit: decimal("functional_currency_credit", { precision: 24, scale: 8 }),
  fxRateSnapshotId: varchar("fx_rate_snapshot_id", { length: 40 }),
  description: text("description")
}, (table) => ({ journalIndex: index("journal_lines_journal_idx").on(table.journalEntryId) }));

export const trades = mysqlTable("trades", {
  id: varchar("id", { length: 40 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 40 }).notNull(),
  tradeReference: varchar("trade_reference", { length: 40 }).notNull(),
  contractNumber: varchar("contract_number", { length: 80 }).notNull(),
  buyer: varchar("buyer", { length: 160 }).notNull(),
  seller: varchar("seller", { length: 160 }).notNull(),
  commodity: varchar("commodity", { length: 100 }).notNull(),
  quantity: decimal("quantity", { precision: 24, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  contractValue: decimal("contract_value", { precision: 24, scale: 8 }).notNull(),
  contractCurrency: varchar("contract_currency", { length: 3 }).notNull(),
  originCountry: varchar("origin_country", { length: 80 }).notNull(),
  destinationCountry: varchar("destination_country", { length: 80 }).notNull(),
  loadingPort: varchar("loading_port", { length: 120 }).notNull(),
  destinationPort: varchar("destination_port", { length: 120 }).notNull(),
  status: varchar("status", { length: 40 }).notNull(),
  riskLevel: varchar("risk_level", { length: 20 }).notNull(),
  readiness: int("readiness").notNull().default(0),
  blockers: json("blockers"),
  updatedAt: datetime("updated_at").notNull()
}, (table) => ({ tradeReferenceUnique: uniqueIndex("trade_org_reference").on(table.organizationId, table.tradeReference) }));

export const auditEvents = mysqlTable("audit_events", {
  id: varchar("id", { length: 40 }).primaryKey(),
  organizationId: varchar("organization_id", { length: 40 }).notNull(),
  actorId: varchar("actor_id", { length: 80 }).notNull(),
  actorRole: varchar("actor_role", { length: 40 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: varchar("entity_id", { length: 80 }).notNull(),
  occurredAt: datetime("occurred_at").notNull(),
  metadata: json("metadata")
});

export const operationalRecords = mysqlTable("operational_records", {
  organizationId: varchar("organization_id", { length: 40 }).notNull(),
  recordType: varchar("record_type", { length: 40 }).notNull(),
  recordId: varchar("record_id", { length: 80 }).notNull(),
  payload: json("payload").notNull(),
  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull()
}, (table) => ({
  recordKey: uniqueIndex("operational_record_key").on(table.organizationId, table.recordType, table.recordId),
  typeIndex: index("operational_record_type_idx").on(table.organizationId, table.recordType)
}));
