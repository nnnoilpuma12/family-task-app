"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAppPersister, APP_CACHE_VERSION } from "@/lib/query-persist";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function Providers({ children }: { children: React.ReactNode }) {
  // リクエスト/レンダ間で QueryClient を共有しないよう、初回マウント時に一度だけ生成する
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 遷移直後はキャッシュを即時表示し、この時間を過ぎていれば裏で再検証する
            staleTime: 30_000,
            // 永続化の必須条件: gcTime >= maxAge。短いと復元前にクエリが GC され永続化されない
            gcTime: ONE_DAY_MS,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );

  // localStorage への永続化 persister（初回マウント時に一度だけ生成）
  const [persister] = useState(() => createAppPersister());

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_DAY_MS,
        buster: APP_CACHE_VERSION,
        // 成功したクエリのみ永続化する（エラー/ローディング状態は残さない）
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === "success",
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
