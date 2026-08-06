import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// テストごとに独立した QueryClient を持つ wrapper を生成する。
// retry を切り、gcTime=0 でテスト間のキャッシュ漏れを防ぐ。
//
// staleTime: Infinity と refetchOn* の無効化は必須。
// 既定 (staleTime: 0) だと再レンダのたびに裏で再フェッチが走り、
// setQueryData による楽観的更新をモックの旧データで上書きしてしまう。
// その結果ロールバックを削除してもテストが通る（＝何も検証していない）状態になる。
// 明示的な refetch() は staleTime に関係なく動くため、テストの表現力は落ちない。
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
