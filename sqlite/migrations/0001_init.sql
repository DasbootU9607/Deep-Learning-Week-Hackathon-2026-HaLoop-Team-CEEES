-- SQLite mirror schema for governance backend compatibility.

create table if not exists profiles (
  id text primary key,
  email text unique not null,
  display_name text not null,
  role text not null check (role in ('developer', 'reviewer', 'security', 'admin')),
  created_at text not null
);

create table if not exists approval_requests (
  id text primary key,
  title text not null,
  requester_id text not null references profiles(id),
  branch_name text not null,
  plan_json text not null,
  touched_paths text not null default '[]',
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('low', 'med', 'high', 'critical')),
  status text not null check (
    status in ('pending', 'pending_approval', 'approved', 'rejected', 'changes_requested', 'cancelled', 'applied')
  ),
  policy_hits text not null default '[]',
  reviewer_ids text not null default '[]',
  created_at text not null,
  updated_at text not null
);

create table if not exists audit_logs (
  id text primary key,
  request_id text references approval_requests(id),
  actor_id text references profiles(id),
  event_type text not null,
  event_payload text not null default '{}',
  created_at text not null
);

create index if not exists idx_approval_requests_status on approval_requests(status);
create index if not exists idx_approval_requests_risk on approval_requests(risk_score);
create index if not exists idx_audit_logs_request_id on audit_logs(request_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);
