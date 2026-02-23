"use client";

export function TaskListSkeleton() {
  return (
    <div className="px-4 py-2 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
        >
          {/* Checkbox placeholder */}
          <div className="h-5 w-5 shrink-0 rounded-full bg-gray-200 animate-pulse" />
          {/* Text lines */}
          <div className="flex-1 space-y-2">
            <div
              className="h-4 rounded bg-gray-200 animate-pulse"
              style={{ width: `${60 + i * 8}%` }}
            />
            <div className="h-3 w-1/3 rounded bg-gray-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
