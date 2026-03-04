import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-[var(--primary)]">404</p>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          ページが見つかりません
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-block rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
