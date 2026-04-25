import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">新規登録</h1>
          <p className="mt-2 text-sm text-muted">
            アカウントを作成して始めましょう
          </p>
        </div>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-muted">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary-dark">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
