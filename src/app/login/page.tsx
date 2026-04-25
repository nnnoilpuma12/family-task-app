import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ログイン</h1>
          <p className="mt-2 text-sm text-muted">
            家族タスク共有アプリへようこそ
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-muted">
          アカウントをお持ちでない方は{" "}
          <Link href="/signup" className="font-medium text-primary hover:text-primary-dark">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}
