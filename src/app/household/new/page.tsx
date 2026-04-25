import Link from "next/link";
import { CreateHouseholdForm } from "@/components/household/create-form";

export default function NewHouseholdPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ハウスホールド作成</h1>
          <p className="mt-2 text-sm text-muted">
            家族のグループを作りましょう
          </p>
        </div>
        <CreateHouseholdForm />
        <p className="mt-6 text-center text-sm text-muted">
          招待コードをお持ちの方は{" "}
          <Link href="/household/join" className="font-medium text-primary hover:text-primary-dark">
            参加する
          </Link>
        </p>
      </div>
    </div>
  );
}
