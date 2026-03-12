"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { TaskRecommendation } from "@/types";

function formatInterval(days: number): string {
  if (days <= 7) return "1週間";
  if (days <= 10) return "10日";
  if (days <= 14) return "2週間";
  if (days <= 21) return "3週間";
  if (days <= 31) return "1ヶ月";
  return `${days}日`;
}

interface RecommendationCardProps {
  recommendation: TaskRecommendation;
  categoryColor?: string | null;
  onAccept: (rec: TaskRecommendation) => void;
  onDismiss: (normalizedTitle: string, medianDays: number) => void;
}

export function RecommendationCard({
  recommendation,
  categoryColor,
  onAccept,
  onDismiss,
}: RecommendationCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 80 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-lg shadow-sm border border-indigo-100 p-3 flex flex-col gap-2"
      style={{
        borderLeftWidth: categoryColor ? 3 : undefined,
        borderLeftColor: categoryColor ?? undefined,
      }}
    >
      <div>
        <p className="text-sm font-medium text-gray-900">
          {recommendation.latest_title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          前回から{recommendation.days_since_last}日経過 ・ 約
          {formatInterval(recommendation.median_interval_days)}ごと
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onDismiss(
              recommendation.normalized_title,
              recommendation.median_interval_days
            )
          }
        >
          スキップ
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onAccept(recommendation)}
        >
          作成する
        </Button>
      </div>
    </motion.div>
  );
}
