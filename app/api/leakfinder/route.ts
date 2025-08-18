// app/api/leakfinder/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { company } = await req.json();

    // Minimal scope: write company into an ephemeral scope (optional).
    // If you already have ./scope.yaml, you can ignore 'company' here,
    // or extend the engine route to accept keywords.
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/engine/scan`, {
      method: "POST",
      // You can adjust adapters/scope here:
      body: JSON.stringify({
        adapters: ["wayback","dockerhub","npm","pypi"],
        scope: "./scope.yaml",
        dryRun: true,
        ai: "openchat",
        extra: company ? ["--keyword", company] : []
      }),
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    return NextResponse.json({
      ok: data.ok,
      results: data.results ?? [],
      summary: data.summary ?? "",
      logs: data.logs ?? "",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
