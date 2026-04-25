"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { origin } = window.location;
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });

    // Always show success — don't reveal whether email exists
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded border border-border bg-success/10 p-4 text-sm text-success">
        メールを送信しました。メールボックスをご確認ください。
        {process.env.NODE_ENV === "development" && (
          <>
            <br />
            <span className="text-xs text-muted">
              （ローカル開発時は localhost:54324 の Inbucket で確認できます）
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded bg-primary px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "送信中..." : "リセットメールを送信"}
      </button>
    </form>
  );
}
