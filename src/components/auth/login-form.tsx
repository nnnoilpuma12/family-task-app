"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("メールアドレスまたはパスワードが正しくありません");
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
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded border border-border-strong bg-surface px-4 py-3 text-base text-foreground placeholder:text-subtle outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus/15"
          placeholder="mail@example.com"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-sm font-medium text-foreground"
        >
          パスワード
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
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-primary hover:text-primary-dark">
            パスワードをお忘れですか？
          </Link>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded bg-primary px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
