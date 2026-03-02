import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { Logger } from "./logger";
import { SupabaseRealtimeClient } from "./supabaseRealtime";
import {
  ApprovalDecisionEvent,
  ApprovalRequest,
  approvalDecisionEventSchema,
  approvalRequestSchema
} from "../schemas/contracts";

type PendingDecision = {
  promise: Promise<ApprovalDecisionEvent>;
  cancel: () => void;
};

export class ApprovalClient {
  private readonly localStore = new Map<string, { request: ApprovalRequest; decision?: ApprovalDecisionEvent }>();

  public constructor(
    private readonly logger: Logger,
    private readonly realtimeClient: SupabaseRealtimeClient,
    private readonly pollIntervalMs: number
  ) {}

  public async createApprovalRequest(params: {
    planId: string;
    sessionId: string;
    riskScore: number;
    reasons: string[];
    files: string[];
    commandCount: number;
  }): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      approvalId: randomUUID(),
      planId: params.planId,
      sessionId: params.sessionId,
      requestedBy: this.getRequestedBy(),
      risk: {
        score: Math.max(70, Math.min(100, Math.round(params.riskScore))),
        level: "high",
        reasons: params.reasons
      },
      blastRadius: {
        files: params.files,
        commandCount: params.commandCount
      },
      createdAt: new Date().toISOString()
    };

    approvalRequestSchema.parse(request);

    const backendUrl = this.getBackendUrl();
    if (!backendUrl) {
      this.localStore.set(request.approvalId, { request });
      return request;
    }

    const response = await fetch(`${backendUrl}/approvals`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Create approval request failed: ${response.status} ${response.statusText}`);
    }

    const payload: unknown = await response.json();
    try {
      return approvalRequestSchema.parse(payload);
    } catch (error) {
      throw new Error(`Schema mismatch for approval request response: ${toErrorMessage(error)}`);
    }
  }

  public waitForDecision(approvalId: string, timeoutMs = 10 * 60 * 1000): PendingDecision {
    let settled = false;
    let pollTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;
    let unsubscribe: (() => void) | undefined;

    const cleanup = (): void => {
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };

    const promise = new Promise<ApprovalDecisionEvent>((resolve, reject) => {
      const accept = (event: ApprovalDecisionEvent): void => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(event);
      };

      unsubscribe = this.realtimeClient.subscribeToApproval(approvalId, (event) => {
        accept(event);
      });

      pollTimer = setInterval(async () => {
        try {
          const event = await this.pollDecision(approvalId);
          if (event) {
            accept(event);
          }
        } catch (error) {
          this.logger.warn(`Approval polling failed: ${toErrorMessage(error)}`);
        }
      }, this.pollIntervalMs);

      timeoutTimer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(new Error("Approval request timed out."));
      }, timeoutMs);
    });

    return {
      promise,
      cancel: () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
      }
    };
  }

  public async requestLocalDecision(approvalId: string): Promise<ApprovalDecisionEvent> {
    const choice = await vscode.window.showWarningMessage(
      "No backend approval service configured. Simulate approval decision?",
      { modal: true },
      "Approve",
      "Deny"
    );

    const decision: ApprovalDecisionEvent = {
      approvalId,
      decision: choice === "Approve" ? "approved" : "denied",
      reviewer: "local-mock-reviewer",
      reason: choice === "Approve" ? "Approved in local mock mode." : "Denied in local mock mode.",
      decidedAt: new Date().toISOString()
    };

    const stored = this.localStore.get(approvalId);
    if (stored) {
      stored.decision = decision;
      this.localStore.set(approvalId, stored);
    }
    this.realtimeClient.emitLocalDecision(decision);
    return decision;
  }

  private async pollDecision(approvalId: string): Promise<ApprovalDecisionEvent | undefined> {
    const backendUrl = this.getBackendUrl();
    if (!backendUrl) {
      return this.localStore.get(approvalId)?.decision;
    }

    const response = await fetch(`${backendUrl}/approvals/${approvalId}/decision`, {
      method: "GET",
      headers: this.getHeaders()
    });

    if (response.status === 404 || response.status === 204) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(`Poll approval failed: ${response.status} ${response.statusText}`);
    }

    const payload: unknown = await response.json();
    const event = approvalDecisionEventSchema.parse(payload);
    return event;
  }

  private getBackendUrl(): string {
    return String(vscode.workspace.getConfiguration("aiGov").get<string>("backendUrl") ?? "").trim();
  }

  private getRequestedBy(): string {
    return String(vscode.workspace.getConfiguration("aiGov").get<string>("requestedBy") ?? "local-dev").trim();
  }

  private getHeaders(): Record<string, string> {
    const apiKey = String(vscode.workspace.getConfiguration("aiGov").get<string>("apiKey") ?? "").trim();
    return {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    };
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
