import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidPushEndpoint } from "@/lib/push-endpoint";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const endpoint = typeof body === "object" && body !== null && "endpoint" in body
    ? body.endpoint : undefined;
  const keys = typeof body === "object" && body !== null && "keys" in body
    ? body.keys : undefined;

  if (!isValidPushEndpoint(endpoint)
    || typeof keys !== "object" || keys === null
    || !("p256dh" in keys) || typeof keys.p256dh !== "string" || !keys.p256dh
    || !("auth" in keys) || typeof keys.auth !== "string" || !keys.auth) {
    return NextResponse.json(
      { error: "Invalid subscription" },
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const endpoint = typeof body === "object" && body !== null && "endpoint" in body
    ? body.endpoint : undefined;

  if (typeof endpoint !== "string" || !endpoint) {
    return NextResponse.json(
      { error: "Missing endpoint" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("profile_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
