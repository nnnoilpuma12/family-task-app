import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">パスワードリセット</h1>
          <p className="mt-2 text-sm text-gray-600">
            登録済みのメールアドレスにリセット用リンクを送信します
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            ログインに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
