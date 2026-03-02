import { describe, expect, it } from "vitest";
import { ExtensionStateMachine } from "../../src/core/stateMachine";

describe("ExtensionStateMachine", () => {
  it("starts at IDLE", () => {
    const machine = new ExtensionStateMachine();
    expect(machine.getState()).toBe("IDLE");
  });

  it("allows valid transitions", () => {
    const machine = new ExtensionStateMachine();

    machine.transition("COLLECTING_CONTEXT");
    machine.transition("DRAFTING_PLAN");
    machine.transition("PREVIEW_READY");
    machine.transition("APPLYING");
    machine.transition("APPLIED");
    machine.transition("ROLLED_BACK");

    expect(machine.getState()).toBe("ROLLED_BACK");
  });

  it("throws on invalid transition", () => {
    const machine = new ExtensionStateMachine();

    expect(() => machine.transition("APPLYING")).toThrow("Invalid state transition");
  });

  it("force bypasses transition guard", () => {
    const machine = new ExtensionStateMachine();

    machine.force("ERROR");
    expect(machine.getState()).toBe("ERROR");

    machine.force("IDLE");
    expect(machine.getState()).toBe("IDLE");
  });
});
