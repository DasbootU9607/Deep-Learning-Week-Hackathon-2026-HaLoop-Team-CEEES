export type AgentState =
  | "IDLE"
  | "COLLECTING_CONTEXT"
  | "DRAFTING_PLAN"
  | "PREVIEW_READY"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "APPLYING"
  | "APPLIED"
  | "DENIED"
  | "ROLLED_BACK"
  | "ERROR";

const allowedTransitions: Record<AgentState, AgentState[]> = {
  IDLE: ["COLLECTING_CONTEXT", "ERROR"],
  COLLECTING_CONTEXT: ["DRAFTING_PLAN", "ERROR"],
  DRAFTING_PLAN: ["PREVIEW_READY", "WAITING_APPROVAL", "ERROR"],
  PREVIEW_READY: ["APPLYING", "IDLE", "ERROR"],
  WAITING_APPROVAL: ["APPROVED", "DENIED", "ERROR"],
  APPROVED: ["APPLYING", "IDLE", "ERROR"],
  APPLYING: ["APPLIED", "ERROR"],
  APPLIED: ["ROLLED_BACK", "IDLE", "ERROR"],
  DENIED: ["IDLE", "ERROR"],
  ROLLED_BACK: ["IDLE", "ERROR"],
  ERROR: ["IDLE", "ROLLED_BACK"]
};

export class ExtensionStateMachine {
  private state: AgentState = "IDLE";

  public getState(): AgentState {
    return this.state;
  }

  public canTransition(next: AgentState): boolean {
    return allowedTransitions[this.state].includes(next);
  }

  public transition(next: AgentState): void {
    if (this.state === next) {
      return;
    }
    if (!this.canTransition(next)) {
      throw new Error(`Invalid state transition: ${this.state} -> ${next}`);
    }
    this.state = next;
  }

  public force(next: AgentState): void {
    this.state = next;
  }
}
