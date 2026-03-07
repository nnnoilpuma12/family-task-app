"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { CategoryTabs } from "@/components/category/category-tabs";
import { TaskList } from "@/components/task/task-list";
import { TaskListSkeleton } from "@/components/task/task-list-skeleton";
import { TaskCreateSheet } from "@/components/task/task-create-sheet";
import { TaskDetailModal } from "@/components/task/task-detail-modal";
import { SwipeableTaskContainer } from "@/components/task/swipeable-task-container";
import { Fab } from "@/components/ui/fab";
import { Avatar } from "@/components/ui/avatar";
import { useTasks } from "@/hooks/use-tasks";
import { useCategories } from "@/hooks/use-categories";
import { useRealtimeTasks } from "@/hooks/use-realtime-tasks";
import { usePageData } from "@/hooks/use-page-data";
import type { TabMeasurements } from "@/components/category/category-tabs";
import type { IndicatorRefs } from "@/hooks/use-swipeable-tab";
import type { Task } from "@/types";

export default function Home() {
  const router = useRouter();
  const { profile, members, householdName, loading } = usePageData();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

  useRealtimeTasks(householdId, setTasks);

  // Auto-select first category when categories load and none is selected
  useEffect(() => {
    if (selectedCategoryId === null && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const tasks = useMemo(() => {
    if (!selectedCategoryId) return allTasks;
    return allTasks.filter((t) => t.category_id === selectedCategoryId);
  }, [allTasks, selectedCategoryId]);

  const handleTap = useCallback((task: Task) => setSelectedTask(task), []);
  const handleDeleteTask = useCallback(async (id: string) => { await deleteTask(id); }, [deleteTask]);
  const handleCloseCreate = useCallback(() => setIsCreateOpen(false), []);
  const handleSubmit = useCallback(async (task: { title: string; category_id?: string | null; due_date?: string | null; memo?: string | null; url?: string | null }) => {
    await addTask({ ...task, created_by: profile?.id ?? null });
  }, [addTask, profile?.id]);
  const handleCloseDetail = useCallback(() => setSelectedTask(null), []);
  const handleUpdate = useCallback(async (id: string, updates: Partial<Task>) => { await updateTask(id, updates); }, [updateTask]);
  const handleDeleteAllDone = useCallback(async () => {
    const doneIds = tasks.filter((t) => t.is_done).map((t) => t.id);
    await Promise.all(doneIds.map((id) => deleteTask(id)));
  }, [tasks, deleteTask]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">{householdName}</h1>
          <div className="flex items-center gap-2">
            {members.map((m) => (
              <Avatar key={m.id} profile={m} size="sm" />
            ))}
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
        />
      </header>

      {/* Task List */}
      <main className="pt-2">
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
              onToggle={toggleTask}
              onTap={handleTap}
              onDelete={handleDeleteTask}
              onReorder={reorderTasks}
              onDeleteAllDone={handleDeleteAllDone}
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
    </div>
  );
}
