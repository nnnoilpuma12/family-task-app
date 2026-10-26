import type { createClient } from "@/lib/supabase/client";

type Usage = { use_count: number; last_used_at: string | null };
type UsageResult = {
  data: Usage | null;
  error: { code?: string; message: string } | null;
};

/** Prefer the atomic RPC; support databases that have not deployed migration 024 yet. */
export async function recordStapleUsage(
  supabase: ReturnType<typeof createClient>,
  householdId: string,
  itemId: string,
): Promise<UsageResult> {
  const { data, error } = await supabase.rpc("record_staple_usage", { p_item_id: itemId });
  // PGRST202 means PostgREST could not find this RPC in its schema cache.
  // Never fall back after timeouts or permission errors: the RPC may have committed.
  if (!error) {
    return data?.[0]
      ? { data: data[0], error: null }
      : { data: null, error: { message: "No staple usage returned" } };
  }
  if (error.code !== "PGRST202") return { data: null, error };

  // Compare-and-swap keeps concurrent clients from overwriting each other's counts.
  // Use a fresh DB value, never the optimistic/persisted client cache. RLS still applies.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: current, error: readError } = await supabase
      .from("staple_items")
      .select("use_count")
      .eq("id", itemId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (readError) return { data: null, error: readError };
    if (!current) return { data: null, error: { message: "Staple item not accessible" } };

    const { data: saved, error: updateError } = await supabase
      .from("staple_items")
      .update({ use_count: current.use_count + 1, last_used_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("household_id", householdId)
      .eq("use_count", current.use_count)
      .select("use_count, last_used_at")
      .maybeSingle();
    if (updateError) return { data: null, error: updateError };
    if (saved) return { data: saved, error: null };
    // Another client changed the count. Read again before trying to increment it.
  }
  return { data: null, error: { message: "Staple usage update conflicted repeatedly" } };
}
