import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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
    console.error("[push:send] vapid_missing", {
      subject: !!process.env.VAPID_SUBJECT,
      pub: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      priv: !!process.env.VAPID_PRIVATE_KEY,
    });
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
    console.warn("[push:send] rate_limited", { userId: user.id });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  let reqBody;
  try {
    reqBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const { title, body, householdId } = reqBody;

  if (!title || !body || !householdId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Truncate title/body to prevent abuse
  const sanitizedTitle = String(title).slice(0, 200);
  const sanitizedBody = String(body).slice(0, 500);

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

  // push_subscriptions の SELECT は RLS で self のみ許可されているため、
  // 他メンバーの購読を取得するにはサーバー側で service_role を使う必要がある。
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    console.error("[push:send] service_role_missing");
    return NextResponse.json(
      { error: "Push notifications not configured" },
      { status: 500 }
    );
  }

  // Get push subscriptions for household members (excluding sender), filtered by household
  const { data: householdMembers, error: membersError } = await admin
    .from("profiles")
    .select("id")
    .eq("household_id", householdId)
    .neq("id", user.id);

  console.log("[push:send] members", {
    householdId,
    count: householdMembers?.length ?? 0,
    error: membersError?.message,
  });

  if (!householdMembers || householdMembers.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const memberIds = householdMembers.map((m) => m.id);

  const { data: subscriptions, error: subsError } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, profile_id")
    .in("profile_id", memberIds);

  console.log("[push:send] subs", {
    memberIds: memberIds.length,
    count: subscriptions?.length ?? 0,
    error: subsError?.message,
  });

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const payload = JSON.stringify({ title: sanitizedTitle, body: sanitizedBody, url: "/" });

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
        const errObj = err as { statusCode?: number; body?: string } | null;
        console.error("[push:send] webpush_failed", {
          endpointPrefix: sub.endpoint.slice(0, 40),
          statusCode: errObj?.statusCode,
          body: errObj?.body?.slice(0, 200),
        });
        // Remove expired/invalid subscriptions
        if (errObj && errObj.statusCode === 410) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        }
        throw err;
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.length - sent;

  console.log("[push:send] done", {
    sent,
    total: subscriptions.length,
    rejected,
  });

  return NextResponse.json({ success: true, sent });
}
