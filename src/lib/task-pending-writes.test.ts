import { afterEach, describe, expect, it } from "vitest";
import { beginTaskWrite, mergeTaskWithPending } from "@/lib/task-pending-writes";
import type { Task } from "@/types";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1", household_id: "household-1", title: "編集中", memo: "ローカルのメモ",
    category_id: null, due_date: null, url: null, created_by: null,
    is_done: false, completed_at: null, sort_order: 0,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("未確定のタスク編集とサーバー更新のマージ", () => {
  let releases: (() => void)[] = [];
  function begin(householdId: string, taskId: string, fields: (keyof Task)[]) {
    const release = beginTaskWrite(householdId, taskId, fields);
    releases.push(release);
    return () => {
      release();
      releases = releases.filter((item) => item !== release);
    };
  }
  afterEach(() => {
    releases.forEach((release) => release());
    releases = [];
  });

  it("書き込み中の列だけローカル値を保ち、他の列はサーバー値を反映する", () => {
    const current = task();
    const incoming = task({ title: "古いタイトル", memo: "別端末のメモ", sort_order: 5 });
    begin(current.household_id, current.id, ["title"]);
    expect(mergeTaskWithPending(current.household_id, current, incoming)).toEqual({
      ...incoming, title: current.title,
    });
    expect(current).toEqual(task());
    expect(incoming.title).toBe("古いタイトル");
  });

  it("同じ列の重なった書き込みは、最後の応答が返るまで保護する", () => {
    const current = task();
    const incoming = task({ title: "サーバー" });
    const first = begin(current.household_id, current.id, ["title"]);
    const second = begin(current.household_id, current.id, ["title"]);
    first();
    expect(mergeTaskWithPending(current.household_id, current, incoming).title).toBe(current.title);
    second();
    expect(mergeTaskWithPending(current.household_id, current, incoming)).toBe(incoming);
  });

  it("異なる列の書き込みは個別に解除する", () => {
    const current = task();
    const incoming = task({ title: "サーバー", memo: "サーバーメモ" });
    const titleDone = begin(current.household_id, current.id, ["title"]);
    begin(current.household_id, current.id, ["memo"]);
    titleDone();
    expect(mergeTaskWithPending(current.household_id, current, incoming)).toEqual({
      ...incoming, memo: current.memo,
    });
  });

  it("同じタスク ID でも世帯が異なればローカル値を混ぜない", () => {
    const current = task();
    const incoming = task({ title: "サーバー", household_id: "household-2" });
    begin(current.household_id, current.id, ["title"]);
    expect(mergeTaskWithPending("household-2", current, incoming)).toBe(incoming);
  });

  it("同じ世帯でも別タスクの更新は保護対象にならない", () => {
    const current = task({ id: "task-2" });
    const incoming = task({ id: "task-2", title: "サーバー" });
    begin(current.household_id, "task-1", ["title"]);
    expect(mergeTaskWithPending(current.household_id, current, incoming)).toBe(incoming);
  });
});
