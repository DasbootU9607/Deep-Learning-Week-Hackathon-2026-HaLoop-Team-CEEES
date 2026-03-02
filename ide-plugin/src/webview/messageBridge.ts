import { PluginUiState } from "./uiState";

export type WebviewToHostMessage =
  | { type: "ui.ready" }
  | { type: "ui.submitPrompt"; prompt: string }
  | { type: "ui.apply" }
  | { type: "ui.cancel" }
  | { type: "ui.deadManSwitch" };

export type HostToWebviewMessage =
  | { type: "host.state"; payload: PluginUiState }
  | { type: "host.toast"; payload: string };

export function isWebviewToHostMessage(value: unknown): value is WebviewToHostMessage {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }

  const maybe = value as { type?: string };
  return (
    maybe.type === "ui.ready" ||
    maybe.type === "ui.submitPrompt" ||
    maybe.type === "ui.apply" ||
    maybe.type === "ui.cancel" ||
    maybe.type === "ui.deadManSwitch"
  );
}
