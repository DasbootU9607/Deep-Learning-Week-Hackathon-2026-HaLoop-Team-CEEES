import * as React from "react";
import { createRoot } from "react-dom/client";
import { HostToWebviewMessage, WebviewToHostMessage } from "./messageBridge";
import { PluginUiState } from "./uiState";

declare function acquireVsCodeApi(): {
  postMessage: (message: WebviewToHostMessage) => void;
};

const vscode = acquireVsCodeApi();

const initialState: PluginUiState = {
  status: "IDLE",
  canApply: false,
  isBusy: false,
  events: []
};

function App(): React.JSX.Element {
  const [prompt, setPrompt] = React.useState("");
  const [state, setState] = React.useState<PluginUiState>(initialState);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebviewMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object") {
        return;
      }

      if (message.type === "host.state") {
        setState(message.payload);
      }
    };

    window.addEventListener("message", onMessage as EventListener);
    vscode.postMessage({ type: "ui.ready" });
    return () => window.removeEventListener("message", onMessage as EventListener);
  }, []);

  const submitPrompt = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }
    vscode.postMessage({ type: "ui.submitPrompt", prompt: trimmed });
    setPrompt("");
  };

  return (
    <div style={styles.shell}>
      <h1 style={styles.title}>AI Governance Chat</h1>

      <section style={styles.card}>
        <form onSubmit={submitPrompt} style={styles.form}>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the code change you want..."
            style={styles.textarea}
            rows={4}
          />
          <button type="submit" style={styles.primaryButton} disabled={state.isBusy}>
            Submit
          </button>
        </form>
      </section>

      <section style={styles.card}>
        <div style={styles.statusRow}>
          <span style={{ ...styles.pill, ...statusStyle(state.status) }}>{state.status}</span>
          {state.approvalId ? <span style={styles.approval}>Approval: {state.approvalId}</span> : null}
        </div>
        {state.error ? <p style={styles.error}>{state.error}</p> : null}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Plan Summary</h2>
        <p style={styles.paragraph}>{state.plan?.summary ?? "No plan generated yet."}</p>

        {state.risk ? (
          <div style={styles.riskBox}>
            <strong>Risk:</strong> {state.risk.decision} (score {state.risk.finalRiskScore})
            {state.risk.warning ? <p style={styles.warning}>{state.risk.warning}</p> : null}
          </div>
        ) : null}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Diff / File Changes</h2>
        <ul style={styles.list}>
          {state.plan?.changes.length ? (
            state.plan.changes.map((change) => (
              <li key={`${change.path}-${change.action}`} style={styles.listItem}>
                <code>{change.action.toUpperCase()}</code> {change.path}
              </li>
            ))
          ) : (
            <li style={styles.listItem}>No file changes.</li>
          )}
        </ul>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Actions</h2>
        <div style={styles.actions}>
          <button onClick={() => vscode.postMessage({ type: "ui.apply" })} disabled={!state.canApply || state.isBusy} style={styles.primaryButton}>
            Apply
          </button>
          <button onClick={() => vscode.postMessage({ type: "ui.cancel" })} style={styles.secondaryButton}>
            Cancel
          </button>
          <button onClick={() => vscode.postMessage({ type: "ui.deadManSwitch" })} style={styles.dangerButton}>
            Dead Man's Switch
          </button>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Event Log</h2>
        <ul style={styles.logList}>
          {state.events.length ? (
            state.events.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)
          ) : (
            <li>No events yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function statusStyle(status: PluginUiState["status"]): React.CSSProperties {
  switch (status) {
    case "APPROVED":
    case "APPLIED":
      return { background: "#1f6f3d", color: "#f3fff5" };
    case "WAITING_APPROVAL":
    case "DRAFTING_PLAN":
    case "APPLYING":
      return { background: "#6f5600", color: "#fff9e5" };
    case "DENIED":
    case "ERROR":
      return { background: "#7a1d1d", color: "#fff1f1" };
    default:
      return { background: "#1b3c61", color: "#ebf5ff" };
  }
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "grid",
    gap: "12px",
    padding: "12px",
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  },
  title: {
    margin: 0,
    fontSize: "16px",
    letterSpacing: "0.3px"
  },
  card: {
    border: "1px solid rgba(127,127,127,0.35)",
    borderRadius: "10px",
    padding: "10px",
    background: "rgba(127,127,127,0.08)"
  },
  form: {
    display: "grid",
    gap: "8px"
  },
  textarea: {
    width: "100%",
    resize: "vertical",
    borderRadius: "8px",
    border: "1px solid rgba(127,127,127,0.45)",
    padding: "8px",
    background: "transparent",
    color: "inherit"
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap"
  },
  pill: {
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 700
  },
  approval: {
    fontSize: "11px",
    opacity: 0.85
  },
  sectionTitle: {
    margin: "0 0 8px 0",
    fontSize: "13px"
  },
  paragraph: {
    margin: 0,
    fontSize: "12px",
    lineHeight: 1.5
  },
  riskBox: {
    marginTop: "8px",
    fontSize: "12px"
  },
  warning: {
    margin: "6px 0 0 0",
    color: "#f2d07b"
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "12px"
  },
  listItem: {
    marginBottom: "4px"
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap"
  },
  primaryButton: {
    border: "none",
    borderRadius: "7px",
    padding: "8px 12px",
    background: "#2f7dd1",
    color: "#ffffff",
    cursor: "pointer"
  },
  secondaryButton: {
    border: "1px solid rgba(127,127,127,0.45)",
    borderRadius: "7px",
    padding: "8px 12px",
    background: "transparent",
    color: "inherit",
    cursor: "pointer"
  },
  dangerButton: {
    border: "none",
    borderRadius: "7px",
    padding: "8px 12px",
    background: "#b13030",
    color: "#fff",
    cursor: "pointer"
  },
  logList: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "12px",
    maxHeight: "160px",
    overflowY: "auto"
  },
  error: {
    margin: "8px 0 0 0",
    color: "#ff9f9f",
    fontSize: "12px"
  }
};

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
