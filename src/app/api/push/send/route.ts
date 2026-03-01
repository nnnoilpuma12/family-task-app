import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID environment variables are not set");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

// P2-4: Simple in-memory rate limiter (10 requests/minute/user)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  try {
    ensureVapidConfigured();
  } catch {
    return NextResponse.json(
      { error: "Push notifications not configured" },
      { status: 500 }
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // P2-4: Rate limiting
  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const { title, body, householdId } = await request.json();

  if (!title || !body || !householdId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // P2-4: Verify sender belongs to the requested household
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!senderProfile || senderProfile.household_id !== householdId) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  // Get push subscriptions for household members (excluding sender), filtered by household
  const { data: householdMembers } = await supabase
    .from("profiles")
    .select("id")
    .eq("household_id", householdId)
    .neq("id", user.id);

  if (!householdMembers || householdMembers.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const memberIds = householdMembers.map((m) => m.id);

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, profile_id")
    .in("profile_id", memberIds);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const payload = JSON.stringify({ title, body, url: "/" });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
      } catch (err: unknown) {
        // Remove expired/invalid subscriptions
        if (
          err &&
          typeof err === "object" &&
          "statusCode" in err &&
          (err as { statusCode: number }).statusCode === 410
        ) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        }
        throw err;
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;

  return NextResponse.json({ success: true, sent });
}
