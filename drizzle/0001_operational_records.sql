ALTER TABLE trades ADD COLUMN blockers JSON NULL;

CREATE TABLE IF NOT EXISTS operational_records (
  organization_id varchar(40) NOT NULL,
  record_type varchar(40) NOT NULL,
  record_id varchar(80) NOT NULL,
  payload json NOT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY (organization_id, record_type, record_id),
  KEY operational_record_type_idx (organization_id, record_type)
);

ALTER TABLE journal_entries ADD UNIQUE KEY journal_org_business_reference (organization_id, business_reference);
