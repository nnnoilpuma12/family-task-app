import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const reports = new Map<string, { count: number; since: number }>();

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    const payload = await request.text();
    if (payload.length > 2048) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    body = JSON.parse(payload);
  }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
  const report = body as Record<string, unknown>;
  if (typeof report.name !== "string" || report.name.length > 80 ||
      (report.digest !== null && (typeof report.digest !== "string" || report.digest.length > 120)) ||
      typeof report.path !== "string" || !report.path.startsWith("/") || report.path.length > 200) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }

  const now = Date.now();
  const current = reports.get(user.id);
  const window = current && now - current.since < 60_000 ? current : { count: 0, since: now };
  if (window.count >= 10) return NextResponse.json({ error: "Too many reports" }, { status: 429 });
  window.count++;
  reports.set(user.id, window);
  console.error(JSON.stringify({
    event: "client_error",
    name: report.name,
    digest: report.digest,
    path: report.path,
  }));
  return new Response(null, { status: 204 });
}
