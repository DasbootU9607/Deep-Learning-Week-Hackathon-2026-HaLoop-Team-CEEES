import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

const UpdateApprovalSchema = z.object({
  requestId: z.string().min(1),
  newStatus: z.enum(["APPROVED", "REJECTED"]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = UpdateApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { requestId, newStatus } = parsed.data;

    const { data: updatedRequest, error: updateError } = await supabaseServer
      .from("approval_requests")
      .update({ status: newStatus })
      .eq("id", requestId)
      .select("id, status")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedRequest) {
      return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
    }

    const { error: auditError } = await supabaseServer.from("audit_logs").insert({
      request_id: requestId,
      event_type: "APPROVAL_STATUS_UPDATED",
      event_payload: {
        newStatus,
      },
    });

    if (auditError) {
      return NextResponse.json({ error: auditError.message }, { status: 500 });
    }

    return NextResponse.json({
      requestId: updatedRequest.id,
      status: updatedRequest.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

