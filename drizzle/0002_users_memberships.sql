CREATE TABLE IF NOT EXISTS users (
  id varchar(40) PRIMARY KEY,
  clerk_user_id varchar(64) NOT NULL,
  email varchar(320) NOT NULL,
  display_name varchar(160),
  created_at datetime NOT NULL,
  UNIQUE KEY users_clerk_user_id (clerk_user_id)
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  user_id varchar(40) NOT NULL,
  organization_id varchar(40) NOT NULL,
  role enum('operations','compliance','treasury','checker','auditor','admin') NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY (user_id, organization_id),
  KEY organization_memberships_org_idx (organization_id),
  CONSTRAINT organization_memberships_user_fk FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT organization_memberships_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id)
);

ALTER TABLE trades ADD COLUMN hold_placed_by varchar(40) NULL;
ALTER TABLE trades ADD COLUMN hold_placed_at datetime NULL;
ALTER TABLE trades ADD COLUMN hold_reason varchar(240) NULL;
ALTER TABLE trades ADD COLUMN hold_previous_status varchar(40) NULL;
ALTER TABLE trades ADD COLUMN hold_previous_readiness int NULL;
