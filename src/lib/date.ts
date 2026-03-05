/**
 * 日付ユーティリティ
 */

export function formatDueDate(date: string): string {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return "今日";
  if (target.getTime() === tomorrow.getTime()) return "明日";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function getQuickDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}
