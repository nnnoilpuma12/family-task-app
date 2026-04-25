"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          問題が発生しました
        </h1>
        <p className="mt-2 text-sm text-muted">
          予期しないエラーが発生しました。再試行するか、ホームに戻ってください。
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            再試行
          </button>
          <Link href="/" className="text-sm text-primary underline">
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
