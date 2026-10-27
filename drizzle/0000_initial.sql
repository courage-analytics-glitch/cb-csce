CREATE TABLE IF NOT EXISTS organizations (
  id varchar(40) PRIMARY KEY,
  name varchar(160) NOT NULL,
  functional_currency varchar(3) NOT NULL DEFAULT 'GHS',
  environment varchar(20) NOT NULL DEFAULT 'DEMO',
  created_at datetime NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id varchar(40) PRIMARY KEY,
  organization_id varchar(40) NOT NULL,
  account_code varchar(20) NOT NULL,
  name varchar(160) NOT NULL,
  account_type varchar(30) NOT NULL,
  normal_balance enum('DEBIT','CREDIT') NOT NULL,
  currency_code varchar(3) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  UNIQUE KEY ledger_account_org_code (organization_id, account_code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id varchar(40) PRIMARY KEY,
  organization_id varchar(40) NOT NULL,
  journal_number varchar(40) NOT NULL,
  business_reference varchar(80) NOT NULL,
  transaction_type varchar(80) NOT NULL,
  description text,
  effective_at datetime NOT NULL,
  posted_at datetime,
  status varchar(20) NOT NULL,
  created_by varchar(80) NOT NULL,
  approved_by varchar(80),
  idempotency_key varchar(120) NOT NULL,
  reversal_of_journal_id varchar(40),
  metadata json,
  UNIQUE KEY journal_org_idempotency (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id varchar(40) PRIMARY KEY,
  journal_entry_id varchar(40) NOT NULL,
  account_id varchar(40) NOT NULL,
  currency_code varchar(3) NOT NULL,
  debit_amount decimal(24,8) NOT NULL DEFAULT 0,
  credit_amount decimal(24,8) NOT NULL DEFAULT 0,
  functional_currency_debit decimal(24,8),
  functional_currency_credit decimal(24,8),
  fx_rate_snapshot_id varchar(40),
  description text,
  KEY journal_lines_journal_idx (journal_entry_id)
);

CREATE TABLE IF NOT EXISTS trades (
  id varchar(40) PRIMARY KEY,
  organization_id varchar(40) NOT NULL,
  trade_reference varchar(40) NOT NULL,
  contract_number varchar(80) NOT NULL,
  buyer varchar(160) NOT NULL,
  seller varchar(160) NOT NULL,
  commodity varchar(100) NOT NULL,
  quantity decimal(24,4) NOT NULL,
  unit varchar(20) NOT NULL,
  contract_value decimal(24,8) NOT NULL,
  contract_currency varchar(3) NOT NULL,
  origin_country varchar(80) NOT NULL,
  destination_country varchar(80) NOT NULL,
  loading_port varchar(120) NOT NULL,
  destination_port varchar(120) NOT NULL,
  status varchar(40) NOT NULL,
  risk_level varchar(20) NOT NULL,
  readiness int NOT NULL DEFAULT 0,
  updated_at datetime NOT NULL,
  UNIQUE KEY trade_org_reference (organization_id, trade_reference)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id varchar(40) PRIMARY KEY,
  organization_id varchar(40) NOT NULL,
  actor_id varchar(80) NOT NULL,
  actor_role varchar(40) NOT NULL,
  action varchar(80) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id varchar(80) NOT NULL,
  occurred_at datetime NOT NULL,
  metadata json
);
