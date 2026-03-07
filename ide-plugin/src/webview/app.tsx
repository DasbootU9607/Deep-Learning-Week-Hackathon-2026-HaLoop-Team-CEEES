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
  events: [],
  verificationEvidence: [],
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

  const protectedPathSet = React.useMemo(() => {
    const set = new Set<string>();
    for (const rule of state.plan?.review.matchedPolicyRules ?? []) {
      for (const matchedPath of rule.matchedPaths) {
        set.add(matchedPath);
      }
    }
    return set;
  }, [state.plan?.review.matchedPolicyRules]);

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
          {state.risk ? (
            <span style={{ ...styles.pill, ...decisionStyle(state.risk.decision) }}>{renderDecision(state.risk.decision)}</span>
          ) : null}
          {state.approvalId ? <span style={styles.approval}>Approval: {state.approvalId}</span> : null}
        </div>
        {state.error ? <p style={styles.error}>{state.error}</p> : null}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Plan Summary</h2>
        <p style={styles.paragraph}>{state.plan?.summary ?? "No plan generated yet."}</p>
        {state.risk ? (
          <div style={styles.scoreGrid}>
            <Metric label="Local" value={state.risk.localRiskScore} />
            <Metric label="Backend" value={state.risk.backendRiskScore} />
            <Metric label="Final" value={state.risk.finalRiskScore} accent />
          </div>
        ) : null}
        {state.risk?.warning ? <p style={styles.warning}>{state.risk.warning}</p> : null}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Why This Decision Happened</h2>
        {state.risk ? (
          <>
            <ul style={styles.list}>
              {state.risk.rationale.map((line) => (
                <li key={line} style={styles.listItem}>
                  {line}
                </li>
              ))}
            </ul>

            <div style={styles.guardrailGrid}>
              {Object.entries(state.risk.guardrailsPassed).map(([key, passed]) => (
                <span key={key} style={{ ...styles.guardrailChip, ...(passed ? styles.guardrailPass : styles.guardrailFail) }}>
                  {formatGuardrail(key)}: {passed ? "passed" : "failed"}
                </span>
              ))}
            </div>

            {state.risk.matchedPolicyRules.length > 0 ? (
              <div style={styles.subsection}>
                <strong>Matched policy rules</strong>
                <ul style={styles.list}>
                  {state.risk.matchedPolicyRules.map((rule) => (
                    <li key={rule.id} style={styles.listItem}>
                      <code>{rule.pattern}</code> ({rule.type}) on {rule.matchedPaths.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div style={styles.subsection}>
              <strong>Risk signals</strong>
              <ul style={styles.list}>
                {state.risk.reasons.map((reason, index) => (
                  <li key={`${reason.message}-${index}`} style={styles.listItem}>
                    <span style={styles.reasonBadge}>{reason.source}</span>
                    <span style={styles.reasonBadgeMuted}>{reason.category}</span>
                    {reason.message}
                    {reason.affectedPath ? <code style={styles.inlineCode}>{reason.affectedPath}</code> : null}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p style={styles.paragraph}>No decision context yet.</p>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Diff / File Changes</h2>
        <ul style={styles.list}>
          {state.plan?.changes.length ? (
            state.plan.changes.map((change) => {
              const protectedPath = protectedPathSet.has(change.path);
              return (
                <li
                  key={`${change.path}-${change.action}`}
                  style={{
                    ...styles.listItem,
                    ...(protectedPath ? styles.highlightRow : undefined),
                  }}
                >
                  <code style={styles.inlineCode}>{change.action.toUpperCase()}</code> {change.path}
                  {protectedPath ? <span style={styles.warningTag}>protected path</span> : null}
                </li>
              );
            })
          ) : (
            <li style={styles.listItem}>No file changes.</li>
          )}
        </ul>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Proposed Commands</h2>
        <ul style={styles.list}>
          {state.plan?.proposedCommands.length ? (
            state.plan.proposedCommands.map((command) => (
              <li
                key={command}
                style={{
                  ...styles.listItem,
                  ...(isRiskyCommand(command) ? styles.commandDanger : undefined),
                }}
              >
                <code style={styles.inlineCode}>{command}</code>
                {isRiskyCommand(command) ? <span style={styles.warningTag}>risky command</span> : null}
              </li>
            ))
          ) : (
            <li style={styles.listItem}>No commands proposed.</li>
          )}
        </ul>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Verification Evidence</h2>
        <ul style={styles.list}>
          {state.verificationEvidence?.length ? (
            state.verificationEvidence.map((item, index) => (
              <li key={`${item.name}-${index}`} style={styles.listItem}>
                <span style={styles.reasonBadge}>{item.kind}</span>
                <span style={styles.reasonBadgeMuted}>{item.status}</span>
                {item.name}
                {item.scope ? <code style={styles.inlineCode}>{item.scope}</code> : null}
                <div style={styles.secondaryText}>{item.summary}</div>
                <div style={styles.secondaryText}>
                  <code style={styles.inlineCode}>{item.command}</code>
                </div>
                {item.details ? <pre style={styles.codeBlock}>{item.details}</pre> : null}
              </li>
            ))
          ) : (
            <li style={styles.listItem}>No verification evidence yet.</li>
          )}
        </ul>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Actions</h2>
        <div style={styles.actions}>
          <button
            onClick={() => vscode.postMessage({ type: "ui.apply" })}
            disabled={!state.canApply || state.isBusy}
            style={styles.primaryButton}
          >
            Apply
          </button>
          <button onClick={() => vscode.postMessage({ type: "ui.cancel" })} style={styles.secondaryButton}>
            Cancel
          </button>
          <button onClick={() => vscode.postMessage({ type: "ui.deadManSwitch" })} style={styles.dangerButton}>
            Dead Man&apos;s Switch
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

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }): React.JSX.Element {
  return (
    <div style={{ ...styles.metricCard, ...(accent ? styles.metricCardAccent : undefined) }}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </div>
  );
}

function renderDecision(decision: NonNullable<PluginUiState["risk"]>["decision"]): string {
  switch (decision) {
    case "ALLOW":
      return "Auto-Approved";
    case "ALLOW_WITH_WARNING":
      return "Warning";
    case "REQUIRE_APPROVAL":
      return "Approval Required";
    case "BLOCKED":
      return "Blocked";
  }
}

function formatGuardrail(key: string): string {
  switch (key) {
    case "destructiveCommands":
      return "Destructive commands";
    case "protectedPaths":
      return "Protected paths";
    case "blastRadius":
      return "Blast radius";
    case "diffSize":
      return "Diff size";
    default:
      return "Secrets";
  }
}

function isRiskyCommand(command: string): boolean {
  return /(rm\s+-rf|drop\s+database|truncate\b|git\s+reset\s+--hard|terraform\s+destroy)/i.test(command);
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

function decisionStyle(decision: NonNullable<PluginUiState["risk"]>["decision"]): React.CSSProperties {
  switch (decision) {
    case "ALLOW":
      return { background: "#184f2d", color: "#dffbe6" };
    case "ALLOW_WITH_WARNING":
      return { background: "#6f5600", color: "#fff3c4" };
    case "REQUIRE_APPROVAL":
      return { background: "#8b5a00", color: "#fff5d6" };
    case "BLOCKED":
      return { background: "#7a1d1d", color: "#fff1f1" };
  }
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "grid",
    gap: "12px",
    padding: "12px",
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  title: {
    margin: 0,
    fontSize: "16px",
    letterSpacing: "0.3px",
  },
  card: {
    border: "1px solid rgba(127,127,127,0.35)",
    borderRadius: "10px",
    padding: "10px",
    background: "rgba(127,127,127,0.08)",
  },
  form: {
    display: "grid",
    gap: "8px",
  },
  textarea: {
    width: "100%",
    resize: "vertical",
    borderRadius: "8px",
    border: "1px solid rgba(127,127,127,0.45)",
    padding: "8px",
    background: "transparent",
    color: "inherit",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  pill: {
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 700,
  },
  approval: {
    fontSize: "11px",
    opacity: 0.85,
  },
  sectionTitle: {
    margin: "0 0 8px 0",
    fontSize: "13px",
  },
  paragraph: {
    margin: 0,
    fontSize: "12px",
    lineHeight: 1.5,
  },
  scoreGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginTop: "10px",
  },
  metricCard: {
    borderRadius: "8px",
    padding: "8px",
    background: "rgba(27, 60, 97, 0.18)",
    display: "grid",
    gap: "4px",
  },
  metricCardAccent: {
    background: "rgba(47, 125, 209, 0.22)",
  },
  metricLabel: {
    fontSize: "11px",
    opacity: 0.8,
  },
  metricValue: {
    fontSize: "18px",
  },
  warning: {
    margin: "8px 0 0 0",
    color: "#f2d07b",
    fontSize: "12px",
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "12px",
  },
  listItem: {
    marginBottom: "6px",
    lineHeight: 1.5,
  },
  subsection: {
    marginTop: "10px",
    display: "grid",
    gap: "6px",
  },
  guardrailGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "10px",
  },
  guardrailChip: {
    borderRadius: "999px",
    padding: "3px 8px",
    fontSize: "11px",
    fontWeight: 600,
  },
  guardrailPass: {
    background: "rgba(31, 111, 61, 0.22)",
    color: "#dffbe6",
  },
  guardrailFail: {
    background: "rgba(177, 48, 48, 0.22)",
    color: "#ffd9d9",
  },
  reasonBadge: {
    display: "inline-block",
    marginRight: "6px",
    padding: "1px 6px",
    borderRadius: "999px",
    background: "rgba(47, 125, 209, 0.22)",
    fontSize: "10px",
    textTransform: "uppercase",
  },
  reasonBadgeMuted: {
    display: "inline-block",
    marginRight: "6px",
    padding: "1px 6px",
    borderRadius: "999px",
    background: "rgba(127,127,127,0.18)",
    fontSize: "10px",
    textTransform: "uppercase",
  },
  inlineCode: {
    marginLeft: "6px",
    padding: "1px 4px",
    borderRadius: "4px",
    background: "rgba(127,127,127,0.18)",
  },
  warningTag: {
    marginLeft: "8px",
    color: "#f2d07b",
    fontSize: "11px",
    fontWeight: 700,
  },
  highlightRow: {
    background: "rgba(242, 208, 123, 0.08)",
    borderRadius: "6px",
    padding: "4px 6px",
  },
  commandDanger: {
    background: "rgba(177, 48, 48, 0.08)",
    borderRadius: "6px",
    padding: "4px 6px",
  },
  secondaryText: {
    fontSize: "11px",
    opacity: 0.82,
    marginTop: "2px",
  },
  codeBlock: {
    marginTop: "6px",
    padding: "8px",
    borderRadius: "8px",
    background: "rgba(0, 0, 0, 0.18)",
    fontSize: "11px",
    whiteSpace: "pre-wrap",
    overflowX: "auto",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: "7px",
    padding: "8px 12px",
    background: "#2f7dd1",
    color: "#ffffff",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(127,127,127,0.45)",
    borderRadius: "7px",
    padding: "8px 12px",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
  },
  dangerButton: {
    border: "none",
    borderRadius: "7px",
    padding: "8px 12px",
    background: "#b13030",
    color: "#fff",
    cursor: "pointer",
  },
  logList: {
    margin: 0,
    paddingLeft: "18px",
    fontSize: "12px",
    maxHeight: "160px",
    overflowY: "auto",
  },
  error: {
    margin: "8px 0 0 0",
    color: "#ff9f9f",
    fontSize: "12px",
  },
};

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
