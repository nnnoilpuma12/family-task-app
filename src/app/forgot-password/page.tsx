import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">パスワードリセット</h1>
          <p className="mt-2 text-sm text-muted">
            登録済みのメールアドレスにリセット用リンクを送信します
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-primary hover:text-primary-dark">
            ログインに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
