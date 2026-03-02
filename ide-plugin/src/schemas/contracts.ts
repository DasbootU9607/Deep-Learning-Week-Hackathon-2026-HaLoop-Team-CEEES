import { z } from "zod";

export const fileChangeSchema = z.object({
  path: z.string().min(1),
  action: z.enum(["create", "update", "delete"]),
  newContent: z.string().optional(),
  oldContentHash: z.string().optional()
});

export const backendRiskSchema = z.object({
  score: z.number().min(0).max(100),
  level: z.enum(["low", "medium", "high"]),
  reasons: z.array(z.string())
});

export const contextSnippetSchema = z.object({
  path: z.string(),
  content: z.string(),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1)
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
    fileSnippets: z.array(contextSnippetSchema).optional()
  })
});

export const generatePlanResponseSchema = z.object({
  planId: z.string().min(1),
  summary: z.string().min(1),
  changes: z.array(fileChangeSchema),
  proposedCommands: z.array(z.string()),
  backendRisk: backendRiskSchema
});

export const approvalRequestSchema = z.object({
  approvalId: z.string().min(1),
  planId: z.string().min(1),
  sessionId: z.string().min(1),
  requestedBy: z.string().min(1),
  risk: z.object({
    score: z.number().min(70).max(100),
    level: z.literal("high"),
    reasons: z.array(z.string())
  }),
  blastRadius: z.object({
    files: z.array(z.string()),
    commandCount: z.number().int().min(0)
  }),
  createdAt: z.string().min(1)
});

export const approvalDecisionEventSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(["approved", "denied"]),
  reviewer: z.string().min(1),
  reason: z.string().optional(),
  decidedAt: z.string().min(1)
});

export type FileChange = z.infer<typeof fileChangeSchema>;
export type GeneratePlanRequest = z.infer<typeof generatePlanRequestSchema>;
export type GeneratePlanResponse = z.infer<typeof generatePlanResponseSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ApprovalDecisionEvent = z.infer<typeof approvalDecisionEventSchema>;
export type ContextSnippet = z.infer<typeof contextSnippetSchema>;
