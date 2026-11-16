import { expect, it, vi } from "vitest";
import { createTaskWriteQueue } from "@/lib/task-write-queue";

it("一括操作は対象となる全タスクの書き込みを待つ", async () => {
  const queue = createTaskWriteQueue();
  const a = Promise.withResolvers<void>();
  const b = Promise.withResolvers<void>();
  const first = queue.run(["a"], () => a.promise);
  const second = queue.run(["b"], () => b.promise);
  const bulkAction = vi.fn(async () => "bulk");
  const bulk = queue.run(["a", "b", "a"], bulkAction);
  a.resolve();
  await first;
  expect(bulkAction).not.toHaveBeenCalled();
  b.resolve();
  await second;
  expect(await bulk).toBe("bulk");
  expect(bulkAction).toHaveBeenCalledTimes(1);
});

it("先行操作の終了で、その後に積んだ操作の待機を解除しない", async () => {
  const queue = createTaskWriteQueue();
  const gate = Promise.withResolvers<void>();
  const first = queue.run(["a"], async () => "first");
  const second = queue.run(["a"], () => gate.promise);
  await first;
  const last = vi.fn(async () => "last");
  const third = queue.run(["a"], last);
  // 別タスクが完了するまで進めても a の後続は待機したまま。
  await queue.run(["unrelated"], async () => {});
  expect(last).not.toHaveBeenCalled();
  gate.resolve();
  await second;
  expect(await third).toBe("last");
});

it("同期例外も呼び出し元へ返し、次の書き込みを妨げない", async () => {
  const queue = createTaskWriteQueue();
  const error = new Error("write failed");
  const failed = queue.run(["a"], () => { throw error; });
  const next = queue.run(["a"], async () => "recovered");
  await expect(failed).rejects.toBe(error);
  expect(await next).toBe("recovered");
});

it("別タスクは並行実行し、同じタスクは失敗した書き込みの後も進める", async () => {
  const queue = createTaskWriteQueue();
  let rejectFirst: (error: Error) => void = () => {};
  const response = new Promise<void>((_, reject) => { rejectFirst = reject; });
  const first = queue.run(["a"], () => response);
  const failure = first.catch(() => {});
  const next = vi.fn(async () => "next");
  const second = queue.run(["a"], next);
  const independent = queue.run(["b"], async () => "independent");
  expect(await independent).toBe("independent");
  expect(next).not.toHaveBeenCalled();
  rejectFirst(new Error("offline"));
  await failure;
  expect(await second).toBe("next");
  expect(next).toHaveBeenCalledTimes(1);
});
