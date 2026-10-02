import { expect, it, vi } from "vitest";
import { createTaskWriteQueue } from "@/lib/task-write-queue";

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
