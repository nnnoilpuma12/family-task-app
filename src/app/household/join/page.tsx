import Link from "next/link";
import { JoinHouseholdForm } from "@/components/household/join-form";

export default function JoinHouseholdPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">ハウスホールドに参加</h1>
          <p className="mt-2 text-sm text-gray-600">
            招待コードを入力してください
          </p>
        </div>
        <JoinHouseholdForm />
        <p className="mt-6 text-center text-sm text-gray-600">
          新しく作成する場合は{" "}
          <Link href="/household/new" className="font-medium text-indigo-600 hover:text-indigo-500">
            ハウスホールドを作成
          </Link>
        </p>
      </div>
    </div>
  );
}
