import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * 近接した更新通知をまとめる。取得中ならその終了を待ってから新しいスナップショットを
 * 取る。購読前に開始した取得への相乗りだけで済ませると、購読開始までの変更を落とす。
 */
export function createQueryRefresh(client: QueryClient, key: QueryKey, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let dirty = false;
  let generation = 0;

  const flush = async () => {
    timer = undefined;
    if (running || !dirty) return;
    running = true;
    const currentGeneration = generation;
    try {
      const query = client.getQueryCache().find({ queryKey: key, exact: true });
      // cancelled/error でも、その後の再取得は必要。
      if (query?.state.fetchStatus === "fetching") await query.promise?.catch(() => {});
      if (currentGeneration !== generation) return;
      dirty = false;
      await client.invalidateQueries(
        { queryKey: key, exact: true },
        { cancelRefetch: false }
      );
    } finally {
      running = false;
      if (dirty && timer === undefined) timer = setTimeout(() => void flush(), delay);
    }
  };

  return {
    request: () => {
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    cancel: () => {
      generation++;
      dirty = false;
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
