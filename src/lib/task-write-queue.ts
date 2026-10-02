/** 同じ行への通信だけを直列化する。追加直後の編集が INSERT より先に届くのを防ぐ。 */
export function createTaskWriteQueue() {
  const pending = new Map<string, Promise<unknown>>();
  return {
    run<T>(ids: string[], action: () => PromiseLike<T>): Promise<T> {
      const dependencies = [...new Set(ids.flatMap((id) => {
        const previous = pending.get(id);
        return previous ? [previous] : [];
      }))];
      const request = Promise.all(dependencies.map((previous) => previous.catch(() => {}))).then(action);
      ids.forEach((id) => pending.set(id, request));
      const release = () => ids.forEach((id) => {
        if (pending.get(id) === request) pending.delete(id);
      });
      void request.then(release, release);
      return request;
    },
  };
}
