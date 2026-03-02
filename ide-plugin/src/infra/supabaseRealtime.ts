import * as vscode from "vscode";
import { ApprovalDecisionEvent, approvalDecisionEventSchema } from "../schemas/contracts";
import { Logger } from "./logger";
import { getResolvedBackendUrl } from "./backendUrl";

type Listener = (event: ApprovalDecisionEvent) => void;

type ActiveStream = {
  abortController: AbortController;
};

export class SupabaseRealtimeClient {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly streams = new Map<string, ActiveStream>();

  public constructor(private readonly logger?: Logger) {}

  public subscribeToApproval(approvalId: string, listener: Listener): () => void {
    const current = this.listeners.get(approvalId) ?? new Set<Listener>();
    current.add(listener);
    this.listeners.set(approvalId, current);

    this.ensureNetworkStream(approvalId);

    return () => {
      const next = this.listeners.get(approvalId);
      if (!next) {
        return;
      }

      next.delete(listener);
      if (next.size === 0) {
        this.listeners.delete(approvalId);
        this.stopNetworkStream(approvalId);
      }
    };
  }

  public emitLocalDecision(event: ApprovalDecisionEvent): void {
    const listeners = this.listeners.get(event.approvalId);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }

    this.stopNetworkStream(event.approvalId);
  }

  private ensureNetworkStream(approvalId: string): void {
    if (this.streams.has(approvalId)) {
      return;
    }

    const backendUrl = this.getBackendUrl();
    if (!backendUrl) {
      return;
    }

    const streamUrl = `${backendUrl}/approvals/${approvalId}/events`;
    const abortController = new AbortController();

    this.streams.set(approvalId, { abortController });
    void this.consumeEventStream(approvalId, streamUrl, abortController.signal);
  }

  private stopNetworkStream(approvalId: string): void {
    const stream = this.streams.get(approvalId);
    if (!stream) {
      return;
    }

    stream.abortController.abort();
    this.streams.delete(approvalId);
  }

  private async consumeEventStream(approvalId: string, streamUrl: string, signal: AbortSignal): Promise<void> {
    let reader:
      | {
          read: () => Promise<{ done: boolean; value?: Uint8Array }>;
          cancel: () => Promise<void>;
        }
      | undefined;

    try {
      const response = await fetch(streamUrl, {
        method: "GET",
        headers: this.getHeaders(),
        signal,
      });

      if (!response.ok) {
        this.logger?.warn(`Realtime subscription failed: ${response.status} ${response.statusText}`);
        return;
      }

      if (!response.body) {
        this.logger?.warn("Realtime subscription failed: response body was empty.");
        return;
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        buffer = this.processSseBuffer(approvalId, buffer);
      }

      buffer += decoder.decode();
      this.processSseBuffer(approvalId, buffer);
    } catch (error) {
      if (!signal.aborted) {
        this.logger?.warn(`Realtime subscription error: ${toErrorMessage(error)}`);
      }
    } finally {
      try {
        await reader?.cancel();
      } catch {
        // Ignore cancellation errors.
      }
      this.streams.delete(approvalId);
    }
  }

  private processSseBuffer(approvalId: string, buffer: string): string {
    let working = buffer;

    while (true) {
      const boundaryIndex = working.indexOf("\n\n");
      if (boundaryIndex === -1) {
        break;
      }

      const rawEvent = working.slice(0, boundaryIndex).trim();
      working = working.slice(boundaryIndex + 2);
      this.processSseEvent(approvalId, rawEvent);
    }

    return working;
  }

  private processSseEvent(approvalId: string, rawEvent: string): void {
    if (!rawEvent || rawEvent.startsWith(":")) {
      return;
    }

    const dataLines = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
      return;
    }

    try {
      const payload = JSON.parse(dataLines.join("\n"));
      const parsed = approvalDecisionEventSchema.safeParse(payload);
      if (!parsed.success) {
        this.logger?.warn("Realtime approval payload failed schema validation.");
        return;
      }

      if (parsed.data.approvalId !== approvalId) {
        return;
      }

      this.emitLocalDecision(parsed.data);
    } catch (error) {
      this.logger?.warn(`Realtime approval payload parse error: ${toErrorMessage(error)}`);
    }
  }

  private getBackendUrl(): string {
    return getResolvedBackendUrl();
  }

  private getHeaders(): Record<string, string> {
    const apiKey = String(vscode.workspace.getConfiguration("aiGov").get<string>("apiKey") ?? "").trim();
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
