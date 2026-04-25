"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "check-email">("form");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname },
      },
    });

    if (error) {
      // Don't expose raw Supabase error messages to users
      setError("アカウントの作成に失敗しました。入力内容をご確認ください。");
      setLoading(false);
      return;
    }

    // silent duplicate: Supabase returns identities: [] for already-registered emails
    if (!data.user || (data.user.identities?.length ?? 0) === 0) {
      setError("このメールアドレスは既に登録されています。ログインするか、パスワードをリセットしてください。");
      setLoading(false);
      return;
    }

    // メール確認が不要な場合（ローカル開発等）はセッションが即座に発行される
    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    // メール確認が必要な場合 → 確認メール送信済み画面へ
    setStep("check-email");
    setLoading(false);
  };

  if (step === "check-email") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-foreground">確認メールを送信しました</p>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">{email}</span> に確認メールを送りました。
          </p>
          <p className="text-sm text-muted">
            メール内のリンクをクリックすると登録が完了します。
          </p>
        </div>
        <div className="w-full rounded border border-border bg-warning/10 p-3 text-left text-sm text-warning">
          メールが届かない場合は、迷惑メールフォルダもご確認ください。
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:text-primary-dark"
        >
          ログイン画面へ戻る
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded border border-border bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="nickname"
          className="text-sm font-medium text-foreground"
        >
          ニックネーム
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          className="rounded border border-border-strong bg-surface px-4 py-3 text-base text-foreground placeholder:text-subtle outline-none transition-colors focus:border-focus focus:ring-2 focus:ring-focus/15"
          placeholder="ニックネーム"
        />
      </div>
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
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded bg-primary px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "登録中..." : "アカウント作成"}
      </button>
    </form>
  );
}
