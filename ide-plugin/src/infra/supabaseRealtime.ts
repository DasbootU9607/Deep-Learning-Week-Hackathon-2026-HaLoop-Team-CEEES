import { ApprovalDecisionEvent } from "../schemas/contracts";

type Listener = (event: ApprovalDecisionEvent) => void;

export class SupabaseRealtimeClient {
  private readonly listeners = new Map<string, Set<Listener>>();

  public subscribeToApproval(approvalId: string, listener: Listener): () => void {
    const current = this.listeners.get(approvalId) ?? new Set<Listener>();
    current.add(listener);
    this.listeners.set(approvalId, current);

    return () => {
      const next = this.listeners.get(approvalId);
      if (!next) {
        return;
      }
      next.delete(listener);
      if (next.size === 0) {
        this.listeners.delete(approvalId);
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
  }
}
