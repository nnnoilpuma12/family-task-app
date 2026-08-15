import "@testing-library/jest-dom";
import { vi } from "vitest";
import { notifyManager } from "@tanstack/react-query";

// React Query の observer 通知は既定で setTimeout 0 にバッチされる。
// そのため `await act(...)` の直後に同期的に読む `result.current` は
// まだ更新前の値を指している。
//
// これは「値が変わっていないこと」を確かめるテスト（楽観的更新の
// ロールバック・失敗時の据え置きなど）を静かに無意味にする。期待値が
// 更新前の値と一致するため、ロールバック処理を削除してもテストが通る。
// 実際に useCategories / useTasks のロールバックを削除する変異で確認済み。
//
// 通知を同期実行にすると act() の内側で反映が完了するので、テスト側で
// 明示的にフラッシュを挟む必要がなくなる（挟み忘れで検証が空振りする
// 事故そのものを無くす）。setNotifyFunction の doc コメントが示すとおり、
// テストでスケジューラを差し替えるのは React Query が想定した使い方。
notifyManager.setScheduler((cb) => cb());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));
