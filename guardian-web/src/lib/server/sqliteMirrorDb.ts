import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isProdBackendMode } from "@/lib/server/backendMode";

type SqliteStatement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
};

interface CompactAuditRow {
  created_at: string;
  event_type: string;
  event_payload: string;
}

let cachedDb: SqliteDatabase | undefined;

export function isSqliteMirrorAvailable(): boolean {
  return !isProdBackendMode();
}

export function upsertProfile(params: {
  displayName: string;
  role: "developer" | "reviewer" | "security" | "admin";
}): string {
  const db = getDb();
  const normalizedName = params.displayName.trim() || "Unknown User";
  const email = toSyntheticEmail(normalizedName);
  const now = new Date().toISOString();
  const generatedId = randomUUID();

  db.prepare(
    [
      "insert into profiles (id, email, display_name, role, created_at)",
      "values (?, ?, ?, ?, ?)",
      "on conflict(email) do update set",
      "display_name = excluded.display_name,",
      "role = excluded.role",
    ].join(" "),
  ).run(generatedId, email, normalizedName, params.role, now);

  const row = db.prepare("select id from profiles where email = ?").get(email) as
    | { id?: string }
    | undefined;

  if (!row?.id) {
    throw new Error("SQLite profile upsert returned empty id.");
  }

  return row.id;
}

export function upsertApprovalRequest(params: {
  id: string;
  title: string;
  requesterId: string;
  branchName: string;
  planJson: Record<string, unknown>;
  touchedPaths: string[];
  riskScore: number;
  riskLevel: "low" | "med" | "high" | "critical";
  status: string;
  policyHits: string[];
  reviewerIds?: string[];
  createdAt?: string;
}): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    [
      "insert into approval_requests (",
      "id, title, requester_id, branch_name, plan_json, touched_paths, risk_score, risk_level, status,",
      "policy_hits, reviewer_ids, created_at, updated_at",
      ") values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      "on conflict(id) do update set",
      "title = excluded.title,",
      "requester_id = excluded.requester_id,",
      "branch_name = excluded.branch_name,",
      "plan_json = excluded.plan_json,",
      "touched_paths = excluded.touched_paths,",
      "risk_score = excluded.risk_score,",
      "risk_level = excluded.risk_level,",
      "status = excluded.status,",
      "policy_hits = excluded.policy_hits,",
      "reviewer_ids = excluded.reviewer_ids,",
      "updated_at = excluded.updated_at",
    ].join(" "),
  ).run(
    params.id,
    params.title,
    params.requesterId,
    params.branchName,
    JSON.stringify(params.planJson),
    JSON.stringify(params.touchedPaths),
    params.riskScore,
    params.riskLevel,
    params.status,
    JSON.stringify(params.policyHits),
    JSON.stringify(params.reviewerIds ?? []),
    params.createdAt ?? now,
    now,
  );
}

export function updateApprovalStatus(params: {
  requestId: string;
  status: string;
}): boolean {
  const db = getDb();
  const updated = db.prepare(
    [
      "update approval_requests",
      "set status = ?, updated_at = ?",
      "where id = ?",
      "returning id",
    ].join(" "),
  ).get(params.status, new Date().toISOString(), params.requestId) as
    | { id?: string }
    | undefined;

  return Boolean(updated?.id);
}

export function insertAuditLog(params: {
  requestId?: string;
  actorId?: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
}): void {
  const db = getDb();
  db.prepare(
    [
      "insert into audit_logs (id, request_id, actor_id, event_type, event_payload, created_at)",
      "values (?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(
    randomUUID(),
    params.requestId ?? null,
    params.actorId ?? null,
    params.eventType,
    JSON.stringify(params.eventPayload),
    new Date().toISOString(),
  );
}

export function listCompactAuditRows(limit: number): CompactAuditRow[] {
  const db = getDb();
  const rows = db.prepare(
    [
      "select created_at, event_type, event_payload",
      "from audit_logs",
      "order by datetime(created_at) desc",
      "limit ?",
    ].join(" "),
  ).all(Math.max(1, Math.min(limit, 200))) as CompactAuditRow[];

  return rows;
}

function getDb(): SqliteDatabase {
  if (cachedDb) {
    return cachedDb;
  }

  const dbPath = getSqlitePath();
  mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath) as unknown as SqliteDatabase;
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(getSchemaSql());

  cachedDb = db;
  return db;
}

function getSqlitePath(): string {
  const configured = process.env.SQLITE_DB_PATH?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }
  return path.join(process.cwd(), ".data", "backend-mirror.sqlite");
}

function getSchemaSql(): string {
  return `
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
  `;
}

function toSyntheticEmail(displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "user"}@local.demo`;
}
