import { NextResponse } from "next/server";
import { getCRById } from "@/lib/server/dataStore";

export const runtime = "nodejs";

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const cr = await getCRById(params.id);

  if (!cr) {
    return NextResponse.json({ error: "CR not found" }, { status: 404 });
  }

  return NextResponse.json(cr);
}
