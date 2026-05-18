"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CreateHouseholdForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const { data: householdId, error: rpcError } = await supabase.rpc(
      "create_household_with_defaults",
      { p_name: name }
    );

    if (rpcError || !householdId) {
      setError("ハウスホールドの作成に失敗しました");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded border border-border bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          家族の名前
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="rounded border border-border-strong bg-surface px-4 py-3 text-base text-foreground placeholder:text-subtle outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus/15"
          placeholder="わが家"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded bg-primary px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "作成中..." : "ハウスホールドを作成"}
      </button>
    </form>
  );
}
