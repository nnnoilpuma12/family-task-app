"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Settings, ArrowUpDown, Check } from "lucide-react";
import { CategoryTabs } from "@/components/category/category-tabs";
import { TaskList } from "@/components/task/task-list";
import { TaskListSkeleton } from "@/components/task/task-list-skeleton";
import { TaskCreateSheet } from "@/components/task/task-create-sheet";
import { TaskDetailModal } from "@/components/task/task-detail-modal";
import { SwipeableTaskContainer } from "@/components/task/swipeable-task-container";
import { Fab } from "@/components/ui/fab";
import { Avatar } from "@/components/ui/avatar";
import { RecommendationSection } from "@/components/recommendation/recommendation-section";
import { useTasks } from "@/hooks/use-tasks";
import { useCategories } from "@/hooks/use-categories";
import { useRealtimeTasks } from "@/hooks/use-realtime-tasks";
import { useSort, SORT_OPTIONS } from "@/hooks/use-sort";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useTaskRecommendations } from "@/hooks/use-task-recommendations";
import { useTitleSuggestions } from "@/hooks/use-title-suggestions";
import { usePageData } from "@/hooks/use-page-data";
import type { TabMeasurements } from "@/components/category/category-tabs";
import type { IndicatorRefs } from "@/hooks/use-swipeable-tab";
import type { Task, TaskRecommendation } from "@/types";

export default function Home() {
  const router = useRouter();
  const { profile, members, householdName, loading } = usePageData();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const { sortOption, setSortOption } = useSort();

  // Indicator refs for swipe ↔ tab sync
  const indicatorBarRef = useRef<HTMLDivElement>(null);
  const tabMeasurementsRef = useRef<TabMeasurements>({ tabWidths: [], tabOffsets: [] });
  const indicatorRefs: IndicatorRefs = {
    barRef: indicatorBarRef,
    get tabWidths() { return tabMeasurementsRef.current.tabWidths; },
    get tabOffsets() { return tabMeasurementsRef.current.tabOffsets; },
  };
  const handleTabMeasure = useCallback((m: TabMeasurements) => {
    tabMeasurementsRef.current = m;
  }, []);

  const householdId = profile?.household_id ?? null;
  const { categories } = useCategories(householdId);
  const { tasks: allTasks, setTasks, loading: tasksLoading, addTask, updateTask, deleteTask, toggleTask, reorderTasks } =
    useTasks(householdId);

  const { recommendations, loading: recsLoading, dismiss: dismissRecommendation, refetch: refetchRecommendations } =
    useTaskRecommendations(householdId, profile?.id);
  const { getSuggestions } = useTitleSuggestions(householdId);

  // Debounced refetch for realtime events from other household members
  const recsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onRemoteChange = useCallback(() => {
    if (recsTimerRef.current) clearTimeout(recsTimerRef.current);
    recsTimerRef.current = setTimeout(() => refetchRecommendations(), 2000);
  }, [refetchRecommendations]);

  useRealtimeTasks(householdId, setTasks, onRemoteChange);

  // Auto-select first category when categories load and none is selected
  useEffect(() => {
    if (selectedCategoryId === null && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const tasks = useMemo(() => {
    const filtered = selectedCategoryId
      ? allTasks.filter((t) => t.category_id === selectedCategoryId)
      : allTasks;

    if (sortOption === "manual") return filtered;

    return [...filtered].sort((a, b) => {
      if (sortOption === "created_desc") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOption === "created_asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortOption === "due_date") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      return 0;
    });
  }, [allTasks, selectedCategoryId, sortOption]);

  const handleToggle = useCallback(async (id: string) => { await toggleTask(id); refetchRecommendations(); }, [toggleTask, refetchRecommendations]);
  const handleTap = useCallback((task: Task) => setSelectedTask(task), []);
  const handleDeleteTask = useCallback(async (id: string) => { await deleteTask(id); refetchRecommendations(); }, [deleteTask, refetchRecommendations]);
  const handleCloseCreate = useCallback(() => setIsCreateOpen(false), []);
  const handleSubmit = useCallback(async (task: { title: string; category_id?: string | null; due_date?: string | null; memo?: string | null; url?: string | null }) => {
    await addTask({ ...task, created_by: profile?.id ?? null });
    refetchRecommendations();
  }, [addTask, profile?.id, refetchRecommendations]);
  const handleCloseDetail = useCallback(() => setSelectedTask(null), []);
  const handleUpdate = useCallback(async (id: string, updates: Partial<Task>) => { await updateTask(id, updates); }, [updateTask]);
  const handleAcceptRecommendation = useCallback(async (rec: TaskRecommendation) => {
    await addTask({
      title: rec.latest_title,
      category_id: rec.latest_category_id,
      memo: rec.latest_memo,
      created_by: profile?.id ?? null,
    });
    await refetchRecommendations();
  }, [addTask, profile?.id, refetchRecommendations]);

  const handleDeleteAllDone = useCallback(async () => {
    const doneIds = tasks.filter((t) => t.is_done).map((t) => t.id);
    await Promise.all(doneIds.map((id) => deleteTask(id)));
    refetchRecommendations();
  }, [tasks, deleteTask, refetchRecommendations]);

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          {loading ? (
            <div className="h-5 w-28 rounded bg-gray-200 animate-pulse" />
          ) : (
            <h1 className="text-lg font-bold text-gray-900">{householdName}</h1>
          )}
          <div className="flex items-center gap-2">
            {loading ? (
              <>
                <div className="h-7 w-7 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-7 w-7 rounded-full bg-gray-200 animate-pulse" />
              </>
            ) : (
              members.map((m) => (
                <Avatar key={m.id} profile={m} size="sm" />
              ))
            )}
            <button
              onClick={() => setIsSortOpen(true)}
              className={`p-1.5 ${sortOption !== "manual" ? "text-indigo-500" : "text-gray-500 hover:text-gray-700"}`}
              aria-label="並び替え"
            >
              <ArrowUpDown size={20} />
            </button>
            <button
              onClick={() => router.push("/settings")}
              className="ml-1 p-1.5 text-gray-500 hover:text-gray-700"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        <CategoryTabs
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          indicatorRef={indicatorBarRef}
          onTabMeasure={handleTabMeasure}
          loading={loading}
        />
      </header>

      {/* Task List */}
      <main className="pt-2">
        {!tasksLoading && !recsLoading && recommendations.length > 0 && (
          <RecommendationSection
            recommendations={recommendations}
            categories={categories}
            onAccept={handleAcceptRecommendation}
            onDismiss={dismissRecommendation}
          />
        )}
        <SwipeableTaskContainer
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
          indicatorRefs={indicatorRefs}
        >
          {tasksLoading ? (
            <TaskListSkeleton />
          ) : (
            <TaskList
              key={selectedCategoryId}
              tasks={tasks}
              categories={categories}
              members={members}
              onToggle={handleToggle}
              onTap={handleTap}
              onDelete={handleDeleteTask}
              onReorder={reorderTasks}
              onDeleteAllDone={handleDeleteAllDone}
              isDndEnabled={sortOption === "manual"}
            />
          )}
        </SwipeableTaskContainer>
      </main>

      {/* FAB */}
      <Fab onClick={() => setIsCreateOpen(true)} />

      {/* Create Sheet */}
      <TaskCreateSheet
        isOpen={isCreateOpen}
        onClose={handleCloseCreate}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        getSuggestions={getSuggestions}
        onSubmit={handleSubmit}
      />

      {/* Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={handleCloseDetail}
        categories={categories}
        members={members}
        onUpdate={handleUpdate}
        onDelete={handleDeleteTask}
      />

      {/* Sort Sheet */}
      <BottomSheet isOpen={isSortOpen} onClose={() => setIsSortOpen(false)} title="並び替え">
        <div className="flex flex-col gap-1 pb-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setSortOption(opt.value);
                setIsSortOpen(false);
              }}
              className="flex items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-gray-50 active:bg-gray-100"
            >
              <span className={sortOption === opt.value ? "text-indigo-600" : "text-gray-800"}>
                {opt.label}
              </span>
              {sortOption === opt.value && <Check size={16} className="text-indigo-600 shrink-0" />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
