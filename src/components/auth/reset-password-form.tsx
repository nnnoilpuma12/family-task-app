"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("パスワードが一致しません。");
      return;
    }

    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("パスワードの更新に失敗しました。もう一度お試しください。");
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
        <label htmlFor="password" className="text-sm font-medium text-foreground">
          新しいパスワード
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="rounded border border-border-strong bg-surface px-4 py-3 text-base text-foreground placeholder:text-subtle outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus/15"
          placeholder="8文字以上"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm font-medium text-foreground">
          パスワード（確認）
        </label>
        <input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          className="rounded border border-border-strong bg-surface px-4 py-3 text-base text-foreground placeholder:text-subtle outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus/15"
          placeholder="8文字以上"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded bg-primary px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "更新中..." : "パスワードを更新"}
      </button>
    </form>
  );
}
