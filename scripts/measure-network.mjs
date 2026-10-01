/**
 * 通信経路の計測。出力には認証情報・世帯ID・タスク本文を含めない。
 * node scripts/measure-network.mjs --samples 20 --output /tmp/network-results.json
 * 既定は読み取りのみ。ローカル seed の一時タスクだけ --local-writes で CRUD を測定。
 * --fixture はローカルへ未完了100件・完了2,000件を一時作成し、finally で削除する。
 * APP_URL / BENCH_EMAIL / BENCH_PASSWORD は環境変数で指定できる。
 */
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const samples = Number(option("--samples", "20"));
if (!Number.isInteger(samples) || samples < 1 || samples > 50) {
  throw new Error("--samples は 1〜50 を指定してください");
}
const output = option("--output", "/tmp/family-network-results.json");
const localEnv = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
    }),
);
const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3100";
const loopback = (url) => ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);
const isLocal = loopback(base);
const email = process.env.BENCH_EMAIL ?? (isLocal ? "test@example.com" : undefined);
const password = process.env.BENCH_PASSWORD ?? (isLocal ? "password" : undefined);
if (!email || !password) throw new Error("BENCH_EMAIL / BENCH_PASSWORD が必要です");
const allowWrites = args.includes("--local-writes");
const fixture = args.includes("--fixture");
if ((allowWrites || fixture) && (!isLocal || email !== "test@example.com")) {
  throw new Error("書込計測はローカル seed アカウントだけに限定しています");
}

let accessToken;
let phase = "setup";
let sample = 0;
let origin = performance.now();
const requests = [];
const paths = [];
const failures = [];
const realtimeEvents = [];

async function request(label, pathname, { method = "GET", body, query, application = false, headers = {} } = {}) {
  const url = new URL(pathname, application ? appUrl : base);
  if (query) url.search = new URLSearchParams(query).toString();
  const started = performance.now();
  const response = await fetch(url, {
    method,
    headers: {
      ...(application ? {} : { apikey: key, Authorization: `Bearer ${accessToken ?? key}` }),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const headersAt = performance.now();
  const bytes = await response.arrayBuffer();
  const bodyAt = performance.now();
  let data;
  if (response.headers.get("content-type")?.includes("application/json") && bytes.byteLength) {
    data = JSON.parse(new TextDecoder().decode(bytes));
  }
  const end = performance.now();
  requests.push({
    phase, sample, label, method, status: response.status,
    startMs: started - origin, headersMs: headersAt - started,
    bodyMs: bodyAt - headersAt, parseMs: end - bodyAt, totalMs: end - started,
    bytes: bytes.byteLength, rows: Array.isArray(data) ? data.length : null,
  });
  if (!response.ok && response.status !== 307 && response.status !== 308) {
    // 本文や詳細エラーは出力しない（データや認証情報を含みうる）。
    throw new Error(`${label}: HTTP ${response.status}${data?.code ? ` (${data.code})` : ""}`);
  }
  return data;
}

const session = await request("auth.signIn", "/auth/v1/token", {
  method: "POST", query: { grant_type: "password" }, body: { email, password },
});
accessToken = session.access_token;
const jwtAlgorithm = JSON.parse(Buffer.from(accessToken.split(".")[0], "base64url").toString()).alg;
const userId = session.user.id;
const user = () => request("auth.getUser", "/auth/v1/user");
const profile = () => request("profiles.self", "/rest/v1/profiles", {
  query: { select: "*", id: `eq.${userId}` },
});
const initialProfile = (await profile())[0];
const householdId = initialProfile?.household_id;
if (!householdId) throw new Error("計測ユーザーに世帯がありません");
if (args.includes("--verify-cleanup")) {
  const remaining = await request("cleanup.verify", "/rest/v1/tasks", {
    query: { select: "id", household_id: `eq.${householdId}`, title: "like.__network_audit_*" },
  });
  process.stdout.write(`計測用タスクの残件数: ${remaining.length}\n`);
  process.exit(remaining.length === 0 ? 0 : 1);
}
const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
const tasks = () => request("tasks.initial", "/rest/v1/tasks", {
  query: {
    select: "*", household_id: `eq.${householdId}`,
    or: `(is_done.eq.false,completed_at.gte.${cutoff})`,
    order: "is_done.asc,sort_order.asc,created_at.desc", limit: "1000",
  },
});
const categories = () => request("categories", "/rest/v1/categories", {
  query: { select: "*", household_id: `eq.${householdId}`, order: "sort_order.asc" },
});
const members = () => request("profiles.members", "/rest/v1/profiles", {
  query: { select: "*", household_id: `eq.${householdId}` },
});
const household = () => request("households.name", "/rest/v1/households", {
  query: { select: "name", id: `eq.${householdId}` },
});
const staples = () => request("staple_items", "/rest/v1/staple_items", {
  query: { select: "*", household_id: `eq.${householdId}`, order: "sort_order.asc,created_at.asc" },
});
const recommendations = () => request("recommendations", "/rest/v1/rpc/get_recurring_recommendations", {
  method: "POST", body: {},
});
const suggestions = () => request("title_suggestions", "/rest/v1/tasks", {
  query: { select: "title,category_id", household_id: `eq.${householdId}`, order: "created_at.desc", limit: "500" },
});
const dataCounts = {};
const fixtureIds = [];
let fixtureCleaned = false;
let realtime;
try {
  if (fixture) {
    const categoryId = (await categories())[0]?.id ?? null;
    const timestamp = Date.now();
    // 100 未完了 + 2,000 完了（100 タイトルを7日周期で20回）。120文字のメモ付き。
    const rows = Array.from({ length: 2100 }, (_, index) => {
      const id = crypto.randomUUID();
      const done = index >= 100;
      const ageDays = done ? Math.floor((index - 100) / 100) * 7 + 6 : 0;
      const date = new Date(timestamp - ageDays * 86400000).toISOString();
      return { id, household_id: householdId, category_id: categoryId, created_by: userId,
        title: `__network_audit_${done ? "recurring" : "pending"}_${index % 100}`,
        memo: "計測用データ".repeat(20), is_done: done,
        completed_at: done ? date : null, created_at: date, sort_order: index };
    });
    for (let index = 0; index < rows.length; index += 100) {
      const batch = rows.slice(index, index + 100);
      fixtureIds.push(...batch.map((row) => row.id));
      await request("fixture.insert", "/rest/v1/tasks", { method: "POST", body: batch });
    }
    process.stdout.write("ローカル計測データ: 未完了100件・完了2,000件を作成\n");
  }
  for (const [label, fn] of Object.entries({ tasks, categories, members, staples, suggestions })) {
    dataCounts[label] = (await fn()).length;
  }

  async function runs(name, fn, count = samples) {
    phase = name;
    for (sample = 0; sample < count; sample++) {
      origin = performance.now();
      const result = await fn();
      paths.push({ phase, sample, totalMs: performance.now() - origin, ...result });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    process.stdout.write(`${name}: ${count} 回完了\n`);
  }

  await runs("isolated-endpoints", async () => {
    for (const fn of [profile, tasks, categories, members, household, staples, recommendations, suggestions, user]) {
      await fn();
    }
  });
  // 通信依存だけを再現する。ブラウザの JS / React / キャッシュ復元時間は含めない。
  await runs("cold-data-path", async () => {
    await profile();
    let taskEnd;
    let categoryEnd;
    const jobs = [
      tasks().then(() => { taskEnd = performance.now() - origin; }),
      categories().then(() => { categoryEnd = performance.now() - origin; }),
      members(), household(),
    ];
    await Promise.all(jobs);
    return { criticalMs: Math.max(taskEnd, categoryEnd) };
  });
  await runs("known-household-refetch", async () => {
    let taskEnd;
    let categoryEnd;
    await Promise.all([
      profile().then(() => Promise.all([members(), household()])),
      tasks().then(() => { taskEnd = performance.now() - origin; }),
      categories().then(() => { categoryEnd = performance.now() - origin; }),
    ]);
    return { criticalMs: Math.max(taskEnd, categoryEnd) };
  });

  // SSR と同じ cookie エンコーディング。認証済み HTML の proxy 経路を測る。
  const projectRef = new URL(base).hostname.split(".")[0];
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const chunks = [];
  for (let i = 0; i < encoded.length; i += 3180) chunks.push(encoded.slice(i, i + 3180));
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookie = chunks.map((part, i) => `${cookieName}${chunks.length > 1 ? `.${i}` : ""}=${part}`).join("; ");
  // セッションは同一マシンのアプリにだけ渡す。任意の外部URLへ転送しない。
  if (loopback(appUrl) && isLocal) {
    await runs("authenticated-document", () => request("document.home", "/", {
      application: true, headers: { Cookie: cookie },
    }));
    const html = await readFile(".next/server/app/index.html", "utf8");
    const staticScripts = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)]
      .filter(([tag]) => !tag.includes("noModule"))
      .map(([, path]) => path);
    await runs("static-js-parallel", async () => {
      await Promise.all(staticScripts.map((path, index) => request(`js.${index + 1}`, path, { application: true })));
      return { scriptCount: staticScripts.length };
    });
  }

  try {
    realtime = createClient(base, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    await realtime.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    await runs("sdk-getSession", async () => {
      const result = await realtime.auth.getSession();
      if (result.error) throw new Error("getSession failed");
    });
    await runs("sdk-getClaims", async () => {
      const result = await realtime.auth.getClaims();
      if (result.error) throw new Error("getClaims failed");
    });
    await runs("realtime-subscribe", async () => {
      const started = performance.now();
      const channel = realtime.channel(`network-audit-${crypto.randomUUID()}`).on("postgres_changes", {
        event: "*", schema: "public", table: "tasks", filter: `household_id=eq.${householdId}`,
      }, () => {});
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Realtime timeout")), 15000);
          channel.subscribe((status) => {
            if (status === "SUBSCRIBED") { clearTimeout(timeout); resolve(); }
            if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) { clearTimeout(timeout); reject(new Error(status)); }
          });
        });
        return { subscribeMs: performance.now() - started };
      } finally { await realtime.removeChannel(channel); }
    }, Math.min(samples, 5));
  } catch (error) { failures.push({ phase: "realtime-subscribe", message: error.message }); }

  if (allowWrites) {
    const ownIds = new Set();
    const categoryId = (await categories())[0]?.id ?? null;
    const pendingEvents = new Map();
    const receiver = realtime?.channel(`audit-receiver-${crypto.randomUUID()}`).on("postgres_changes", {
      event: "*", schema: "public", table: "tasks", filter: `household_id=eq.${householdId}`,
    }, (payload) => {
      const id = payload.new?.id ?? payload.old?.id;
      const key = `${payload.eventType}:${id}`;
      pendingEvents.get(key)?.();
      pendingEvents.delete(key);
    });
    if (receiver) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Receiver timeout")), 15000);
        receiver.subscribe((status) => {
          if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
          if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) { clearTimeout(timer); reject(new Error(status)); }
        });
      });
    }
    const observe = (event, id) => {
      const started = performance.now();
      if (!receiver) return Promise.resolve();
      return new Promise((resolve) => {
        const key = `${event}:${id}`;
        const timer = setTimeout(() => {
          pendingEvents.delete(key);
          failures.push({ phase: "realtime-event", event, message: "5000ms timeout" });
          resolve();
        }, 5000);
        pendingEvents.set(key, () => {
          clearTimeout(timer);
          realtimeEvents.push({ event, sample, totalMs: performance.now() - started });
          resolve();
        });
      });
    };
    try {
      await runs("local-task-write", async () => {
        const id = crypto.randomUUID();
        ownIds.add(id);
        const inserted = observe("INSERT", id);
        await request("tasks.insert", "/rest/v1/tasks", {
          method: "POST", headers: { Prefer: "return=representation" },
          body: { id, household_id: householdId, category_id: categoryId, title: "__network_audit_temporary__", created_by: userId },
        });
        await inserted;
        const updated = observe("UPDATE", id);
        await request("tasks.toggle", "/rest/v1/tasks", {
          method: "PATCH", query: { id: `eq.${id}` }, headers: { Prefer: "return=representation" },
          body: { is_done: true, completed_at: new Date().toISOString() },
        });
        await updated;
        await request("tasks.delete", "/rest/v1/tasks", { method: "DELETE", query: { id: `eq.${id}` } });
        ownIds.delete(id);
      });
    } finally {
      if (receiver) await realtime.removeChannel(receiver);
      phase = "cleanup";
      for (const id of ownIds) {
        await request("tasks.cleanup", "/rest/v1/tasks", { method: "DELETE", query: { id: `eq.${id}` } });
      }
    }
  }
  if (realtime) await realtime.removeAllChannels();
} finally {
  if (realtime) await realtime.removeAllChannels();
  phase = "fixture-cleanup";
  for (let index = 0; index < fixtureIds.length; index += 50) {
    await request("fixture.delete", "/rest/v1/tasks", {
      method: "DELETE", query: { id: `in.(${fixtureIds.slice(index, index + 50).join(",")})` },
    });
  }
  fixtureCleaned = true;
}

function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const round = (n) => Math.round(n * 100) / 100;
  return { n: sorted.length, min: round(sorted[0]), p50: round(sorted[Math.ceil(sorted.length * 0.5) - 1]),
    p95: round(sorted[Math.ceil(sorted.length * 0.95) - 1]), max: round(sorted.at(-1)) };
}
const grouped = {};
for (const row of requests.filter((r) => r.phase !== "setup")) {
  (grouped[`${row.phase}/${row.label}`] ??= []).push(row.totalMs);
}
const report = {
  recordedAt: new Date().toISOString(), environment: isLocal ? "local-loopback" : "remote",
  node: process.version, samples, jwtAlgorithm, dataCounts, fixture: fixture ? { active: 100, completed: 2000, cleaned: fixtureCleaned } : null,
  limitations: ["Node HTTP measurements; not browser render timings", "No mobile WAN latency", "Application/DB caches and connections warm across repeated samples", "p95 is descriptive for this small sample"],
  requestSummary: Object.fromEntries(Object.entries(grouped).map(([name, values]) => [name, summary(values)])),
  pathSummary: Object.fromEntries([...new Set(paths.map((p) => p.phase))].map((name) => [name,
    summary(paths.filter((p) => p.phase === name).map((p) => p.criticalMs ?? p.subscribeMs ?? p.totalMs))])),
  realtimeSummary: Object.fromEntries(["INSERT", "UPDATE"].map((event) => {
    const values = realtimeEvents.filter((row) => row.event === event).map((row) => row.totalMs);
    return [event, values.length ? summary(values) : null];
  })),
  requests, paths, realtimeEvents, failures,
};
await writeFile(output, JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify({ output, dataCounts, requestSummary: report.requestSummary, pathSummary: report.pathSummary, failures }, null, 2) + "\n");
