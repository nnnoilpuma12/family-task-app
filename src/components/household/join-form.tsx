"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function JoinHouseholdForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    // 招待コード検証と profile.household_id 更新をサーバ側で atomic に実行
    const { data: householdId, error: joinError } = await supabase
      .rpc("join_household_with_code", { p_code: code.toUpperCase() });

    if (joinError || !householdId) {
      setError("招待コードが無効か期限切れです");
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
        <label htmlFor="code" className="text-sm font-medium text-foreground">
          招待コード
        </label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          maxLength={16}
          className="rounded border border-border-strong bg-surface px-4 py-3 text-center text-2xl font-mono tracking-widest uppercase text-foreground placeholder:text-subtle outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus/15"
          placeholder="XXXXXXXXXXXXXXXX"
        />
      </div>
      <button
        type="submit"
        disabled={loading || code.length < 16}
        className="mt-2 rounded bg-primary px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "参加中..." : "ハウスホールドに参加"}
      </button>
    </form>
  );
}
