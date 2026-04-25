"use client";

export function TaskListSkeleton() {
  return (
    <div className="px-4 py-2 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg bg-surface p-4 border border-border"
        >
          {/* Checkbox placeholder */}
          <div className="h-5 w-5 shrink-0 rounded-full bg-surface-strong animate-pulse" />
          {/* Text lines */}
          <div className="flex-1 space-y-2">
            <div
              className="h-4 rounded bg-surface-strong animate-pulse"
              style={{ width: `${60 + i * 8}%` }}
            />
            <div className="h-3 w-1/3 rounded bg-surface-strong animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
