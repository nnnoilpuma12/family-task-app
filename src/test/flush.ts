import { act } from "@testing-library/react";

/**
 * React Query の observer 通知はバッチされるため、`setQueryData` の直後に
 * 同期的に読んだ `result.current` はまだ更新前の値を指している。
 *
 * とくに「値が変わっていないこと」を確かめるテスト（ロールバック・失敗時の
 * 据え置きなど）は、フラッシュを挟まないと *更新前* の値を読んでしまい、
 * ロールバック処理を削除しても成功する（＝何も検証していない）状態になる。
 *
 * 変化を待つ検証は `waitFor` で足りるが、非変化の検証には必ずこれを挟むこと。
 */
export async function flushQueryUpdates() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
