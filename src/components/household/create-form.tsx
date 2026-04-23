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

    // 世帯作成・プロフィール紐付け・デフォルトカテゴリ投入・招待コード発行を
    // サーバ側で atomic に実行する
    const { error: rpcError } = await supabase.rpc(
      "create_household_with_defaults",
      { p_name: name }
    );

    if (rpcError) {
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
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-gray-700">
          家族の名前
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          placeholder="わが家"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "作成中..." : "ハウスホールドを作成"}
      </button>
    </form>
  );
}
