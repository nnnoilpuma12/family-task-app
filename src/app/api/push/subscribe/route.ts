import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: "Invalid subscription" },
      { status: 400 }
    );
  }

  // SSRF protection: only allow https endpoints, block private IPs
  try {
    const endpointUrl = new URL(endpoint);
    if (endpointUrl.protocol !== "https:") {
      return NextResponse.json(
        { error: "Endpoint must use HTTPS" },
        { status: 400 }
      );
    }
    // Block private/internal hostnames
    const hostname = endpointUrl.hostname;
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname === "[::1]"
    ) {
      return NextResponse.json(
        { error: "Invalid endpoint" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid endpoint URL" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const { endpoint } = body;

  if (!endpoint) {
    return NextResponse.json(
      { error: "Missing endpoint" },
      { status: 400 }
    );
  }

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("profile_id", user.id);

  return NextResponse.json({ success: true });
}
