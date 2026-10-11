import type { Task } from "@/types";

const pending = new Map<string, Map<keyof Task, number>>();
const taskKey = (householdId: string, taskId: string) => `${householdId}:${taskId}`;

export function beginTaskWrite(householdId: string, taskId: string, fields: (keyof Task)[]) {
  const key = taskKey(householdId, taskId);
  const counts = pending.get(key) ?? new Map<keyof Task, number>();
  for (const field of fields) counts.set(field, (counts.get(field) ?? 0) + 1);
  pending.set(key, counts);
  return () => {
    for (const field of fields) {
      const count = counts.get(field) ?? 0;
      if (count <= 1) counts.delete(field);
      else counts.set(field, count - 1);
    }
    if (counts.size === 0) pending.delete(key);
  };
}

export function mergeTaskWithPending(householdId: string, current: Task, incoming: Task): Task {
  const counts = pending.get(taskKey(householdId, current.id));
  if (!counts) return incoming;
  const merged = { ...incoming };
  for (const field of counts.keys()) {
    // The local operation remains visible until its server response settles.
    Object.assign(merged, { [field]: current[field] });
  }
  return merged;
}
