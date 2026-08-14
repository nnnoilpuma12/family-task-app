import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// テストごとに独立した QueryClient を持つ wrapper を生成する。
// retry を切り、gcTime=0 でテスト間のキャッシュ漏れを防ぐ。
//
// staleTime: Infinity と refetchOn* の無効化は、裏で走る再フェッチが
// setQueryData による楽観的更新をモックの旧データで上書きするのを防ぐため。
// 明示的な refetch() は staleTime に関係なく動くので表現力は落ちない。
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
