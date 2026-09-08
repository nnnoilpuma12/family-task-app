"use client";

import { useState, useEffect, useCallback } from "react";
import { runWhenIdle } from "@/lib/idle";

interface IdleReady {
  /** アイドルに入った（= クリティカルパスを抜けた）かどうか */
  isReady: boolean;
  /** アイドルを待たずに即時有効化する（ユーザー操作起点の再取得など） */
  markReady: () => void;
}

/**
 * 起動のクリティカルパスから外したい処理のための共通ゲート。
 *
 * 初回描画までの帯域と接続は tasks / categories の取得に使い切りたい。
 * 「すぐ要らないもの」（定番品の取得・Realtime の購読・サジェスト・レコメンド）は
 * このゲートで初回ペイント後まで遅らせる。
 *
 * enabled が false のあいだはスケジュールしない（householdId 未確定など、
 * そもそも実行しても無意味な状態でアイドルを消費しないため）。
 */
export function useIdleReady(enabled: boolean = true): IdleReady {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    return runWhenIdle(() => setIsReady(true));
  }, [enabled]);

  const markReady = useCallback(() => setIsReady(true), []);

  return { isReady, markReady };
}
