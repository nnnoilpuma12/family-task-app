import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">新しいパスワードを設定</h1>
          <p className="mt-2 text-sm text-gray-600">
            新しいパスワードを入力してください
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
