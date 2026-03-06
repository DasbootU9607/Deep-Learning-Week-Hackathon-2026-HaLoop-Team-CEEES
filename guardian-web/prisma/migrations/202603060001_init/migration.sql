CREATE TABLE IF NOT EXISTS stored_plans (
  plan_id TEXT PRIMARY KEY,
  request_json JSONB NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_tickets (
  approval_id TEXT PRIMARY KEY,
  request_json JSONB NOT NULL,
  cr_id TEXT NOT NULL,
  status TEXT NOT NULL,
  decision_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_tickets_cr_id ON approval_tickets (cr_id);
CREATE INDEX IF NOT EXISTS idx_approval_tickets_status ON approval_tickets (status);

CREATE TABLE IF NOT EXISTS change_requests (
  id TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  status TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  plan TEXT,
  patch_summary_json JSONB NOT NULL,
  blast_radius_json JSONB NOT NULL,
  evidence_json JSONB NOT NULL,
  approvals_json JSONB NOT NULL,
  required_approvals INTEGER NOT NULL,
  pr_url TEXT,
  commit_sha TEXT,
  labels_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests (status);
CREATE INDEX IF NOT EXISTS idx_change_requests_risk_score ON change_requests (risk_score);
CREATE INDEX IF NOT EXISTS idx_change_requests_repo ON change_requests (repo);
CREATE INDEX IF NOT EXISTS idx_change_requests_updated_at ON change_requests (updated_at);

CREATE TABLE IF NOT EXISTS audit_entries (
  id TEXT PRIMARY KEY,
  "timestamp" TIMESTAMPTZ NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_avatar TEXT,
  action TEXT NOT NULL,
  target_cr_id TEXT,
  target_cr_title TEXT,
  target_policy_id TEXT,
  details_json JSONB,
  ip_address TEXT,
  risk_level TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_entries_timestamp ON audit_entries ("timestamp");
CREATE INDEX IF NOT EXISTS idx_audit_entries_action ON audit_entries (action);
CREATE INDEX IF NOT EXISTS idx_audit_entries_risk_level ON audit_entries (risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_entries_target_cr_id ON audit_entries (target_cr_id);

CREATE TABLE IF NOT EXISTS policy_states (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL,
  path_rules_json JSONB NOT NULL,
  risk_thresholds_json JSONB NOT NULL,
  role_permissions_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_states (
  id TEXT PRIMARY KEY,
  is_incident_mode BOOLEAN NOT NULL,
  activated_at TIMESTAMPTZ,
  activated_by TEXT,
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

