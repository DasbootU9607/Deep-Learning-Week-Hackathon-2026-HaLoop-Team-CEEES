-- Core schema for Track 1 governance backend.
-- Compatible with dashboard + plugin statuses used in this repository.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text not null,
  role text not null check (role in ('developer', 'reviewer', 'security', 'admin', 'lead', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  match_paths text[] not null default '{}',
  blocked_actions text[] not null default '{}',
  min_risk_for_approval integer not null default 60 check (min_risk_for_approval between 0 and 100),
  require_dual_approval boolean not null default false,
  enabled boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  requester_id uuid not null references profiles(id),
  branch_name text not null,
  plan_json jsonb not null,
  touched_paths text[] not null default '{}',
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('low', 'med', 'medium', 'high', 'critical')),
  status text not null check (
    status in ('pending', 'pending_approval', 'approved', 'rejected', 'changes_requested', 'cancelled', 'applied')
  ),
  policy_hits text[] not null default '{}',
  reviewer_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references approval_requests(id),
  actor_id uuid references profiles(id),
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_approval_requests_status on approval_requests(status);
create index if not exists idx_approval_requests_risk on approval_requests(risk_score);
create index if not exists idx_audit_logs_request_id on audit_logs(request_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);

create or replace function set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_approval_requests_updated_at on approval_requests;
create trigger trg_set_approval_requests_updated_at
before update on approval_requests
for each row
execute function set_updated_at_timestamp();
