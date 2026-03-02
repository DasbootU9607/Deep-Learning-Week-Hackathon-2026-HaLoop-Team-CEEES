import { BlastRadius } from "@/types/cr";

export const mockBlastRadius: BlastRadius = {
  nodes: [
    { id: "f1", type: "file", label: "stripe.ts", risk_level: "high", metadata: { lines: 456, language: "TypeScript" } },
    { id: "f2", type: "file", label: "webhook.ts", risk_level: "high", metadata: { lines: 234, language: "TypeScript" } },
    { id: "f3", type: "file", label: "payment-controller.ts", risk_level: "med", metadata: { lines: 189, language: "TypeScript" } },
    { id: "f4", type: "file", label: "types.ts", risk_level: "low", metadata: { lines: 67, language: "TypeScript" } },
    { id: "s1", type: "service", label: "payments-service", risk_level: "high", metadata: { instances: 3, region: "us-east-1" } },
    { id: "s2", type: "service", label: "order-service", risk_level: "med", metadata: { instances: 2 } },
    { id: "s3", type: "service", label: "notification-service", risk_level: "low", metadata: { instances: 1 } },
    { id: "d1", type: "database", label: "payments-db", risk_level: "med", metadata: { type: "PostgreSQL", size: "50GB" } },
  ],
  edges: [
    { id: "e1", source: "f1", target: "s1" },
    { id: "e2", source: "f2", target: "s1" },
    { id: "e3", source: "f3", target: "s1" },
    { id: "e4", source: "f4", target: "f1" },
    { id: "e5", source: "s1", target: "s2", label: "HTTP/REST" },
    { id: "e6", source: "s1", target: "s3", label: "Event Bus" },
    { id: "e7", source: "s1", target: "d1", label: "PostgreSQL" },
  ],
};
