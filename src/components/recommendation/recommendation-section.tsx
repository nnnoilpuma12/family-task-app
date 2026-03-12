"use client";

import { AnimatePresence } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { RecommendationCard } from "@/components/recommendation/recommendation-card";
import type { TaskRecommendation, Category } from "@/types";

interface RecommendationSectionProps {
  recommendations: TaskRecommendation[];
  categories: Category[];
  onAccept: (rec: TaskRecommendation) => void;
  onDismiss: (normalizedTitle: string, medianDays: number) => void;
}

export function RecommendationSection({
  recommendations,
  categories,
  onAccept,
  onDismiss,
}: RecommendationSectionProps) {
  if (recommendations.length === 0) return null;

  const categoryColorMap = new Map(
    categories.map((c) => [c.id, c.color])
  );

  return (
    <div className="bg-indigo-50/50 rounded-xl p-3 mx-4 mb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="w-4 h-4 text-indigo-600" />
        <span className="text-xs font-semibold text-indigo-600">
          そろそろやる時期かも
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.normalized_title}
              recommendation={rec}
              categoryColor={
                rec.latest_category_id
                  ? (categoryColorMap.get(rec.latest_category_id) ?? null)
                  : null
              }
              onAccept={onAccept}
              onDismiss={onDismiss}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
