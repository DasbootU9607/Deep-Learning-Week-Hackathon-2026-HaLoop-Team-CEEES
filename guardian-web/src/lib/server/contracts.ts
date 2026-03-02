import { z } from "zod";

export const fileChangeSchema = z.object({
  path: z.string().min(1),
  action: z.enum(["create", "update", "delete"]),
  newContent: z.string().optional(),
  oldContentHash: z.string().optional(),
});

export const contextSnippetSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
});

export const generatePlanRequestSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(1),
  context: z.object({
    workspaceRoot: z.string().min(1),
    branch: z.string().min(1),
    activeFile: z.string().optional(),
    selectedText: z.string().optional(),
    openTabs: z.array(z.string()),
    fileSnippets: z.array(contextSnippetSchema).optional(),
  }),
});

export const generatePlanResponseSchema = z.object({
  planId: z.string().min(1),
  summary: z.string().min(1),
  changes: z.array(fileChangeSchema),
  proposedCommands: z.array(z.string()),
  backendRisk: z.object({
    score: z.number().min(0).max(100),
    level: z.enum(["low", "medium", "high"]),
    reasons: z.array(z.string()),
  }),
});

export const approvalRequestSchema = z.object({
  approvalId: z.string().min(1),
  planId: z.string().min(1),
  sessionId: z.string().min(1),
  requestedBy: z.string().min(1),
  risk: z.object({
    score: z.number().min(70).max(100),
    level: z.literal("high"),
    reasons: z.array(z.string()),
  }),
  blastRadius: z.object({
    files: z.array(z.string()),
    commandCount: z.number().int().min(0),
  }),
  createdAt: z.string().min(1),
});

export const approvalDecisionEventSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(["approved", "denied"]),
  reviewer: z.string().min(1),
  reason: z.string().optional(),
  decidedAt: z.string().min(1),
});

export const crReviewActionBodySchema = z.object({
  comment: z.string().trim().min(1).max(1000).optional(),
  reviewer: z.string().trim().min(1).max(120).optional(),
});

export const updatePathRulesBodySchema = z.object({
  rules: z.array(
    z.object({
      id: z.string().min(1),
      pattern: z.string().min(1),
      type: z.enum(["allow", "deny", "require_approval"]),
      description: z.string().optional(),
      created_at: z.string().min(1),
      created_by: z.string().min(1),
    }),
  ),
  riskThresholds: z
    .object({
      low_max: z.number().int().min(0).max(100),
      med_max: z.number().int().min(0).max(100),
      auto_approve_below: z.number().int().min(0).max(100).optional(),
      require_dual_approval_above: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
});

export const incidentModeStateSchema = z.object({
  isIncidentMode: z.boolean(),
  activatedAt: z.string().optional(),
  activatedBy: z.string().optional(),
  reason: z.string().optional(),
});

export const setIncidentModeBodySchema = z.object({
  enabled: z.boolean(),
  by: z.string().trim().min(1).max(120).optional(),
  reason: z.string().trim().max(500).optional(),
});

export type FileChange = z.infer<typeof fileChangeSchema>;
export type GeneratePlanRequest = z.infer<typeof generatePlanRequestSchema>;
export type GeneratePlanResponse = z.infer<typeof generatePlanResponseSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ApprovalDecisionEvent = z.infer<typeof approvalDecisionEventSchema>;
export type CRReviewActionBody = z.infer<typeof crReviewActionBodySchema>;
export type UpdatePathRulesBody = z.infer<typeof updatePathRulesBodySchema>;
export type IncidentModeState = z.infer<typeof incidentModeStateSchema>;
export type SetIncidentModeBody = z.infer<typeof setIncidentModeBodySchema>;
