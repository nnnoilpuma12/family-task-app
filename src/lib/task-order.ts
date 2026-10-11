import type { Task } from "@/types";

// 取得用カーソルとは独立した、一覧と Realtime 共通の表示順。
export function taskOrder(a: Task, b: Task): number {
  return Number(a.is_done) - Number(b.is_done)
    || a.sort_order - b.sort_order
    || b.created_at.localeCompare(a.created_at)
    || a.id.localeCompare(b.id);
}
