import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="text-6xl font-bold tracking-tight text-primary">404</p>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
          ページが見つかりません
        </h1>
        <p className="mt-2 text-sm text-muted">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-block rounded bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
