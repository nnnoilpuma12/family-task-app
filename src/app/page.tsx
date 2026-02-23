"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CategoryTabs } from "@/components/category/category-tabs";
import { TaskList } from "@/components/task/task-list";
import { TaskListSkeleton } from "@/components/task/task-list-skeleton";
import { TaskCreateSheet } from "@/components/task/task-create-sheet";
import { TaskDetailModal } from "@/components/task/task-detail-modal";
import { SwipeableTaskContainer } from "@/components/task/swipeable-task-container";
import { Fab } from "@/components/ui/fab";
import { useTasks } from "@/hooks/use-tasks";
import { useCategories } from "@/hooks/use-categories";
import { useRealtimeTasks } from "@/hooks/use-realtime-tasks";
import type { TabMeasurements } from "@/components/category/category-tabs";
import type { IndicatorRefs } from "@/hooks/use-swipeable-tab";
import type { Profile, Task } from "@/types";

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

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

  const tasks = useMemo(() => {
    if (!selectedCategoryId) return allTasks;
    return allTasks.filter((t) => t.category_id === selectedCategoryId);
  }, [allTasks, selectedCategoryId]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      let profile = profileData;
      if (!profile) {
        const { data: created } = await supabase
          .from("profiles")
          .upsert({ id: user.id, nickname: user.user_metadata?.nickname ?? "" })
          .select()
          .single();
        profile = created;
      }

      if (!profile) {
        setLoading(false);
        return;
      }
      setProfile(profile);

      if (!profile.household_id) {
        router.push("/household/new");
        setLoading(false);
        return;
      }

      // Fetch household members
      const { data: membersData } = await supabase
        .from("profiles")
        .select("*")
        .eq("household_id", profile.household_id);
      if (membersData) setMembers(membersData);

      setLoading(false);
    };
    load();
  }, [router]);

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
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">家族タスク</h1>
          <div className="flex items-center gap-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700"
                title={m.nickname}
              >
                {m.nickname.charAt(0) || "?"}
              </div>
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
              tasks={tasks}
              categories={categories}
              members={members}
              onToggle={toggleTask}
              onTap={(task) => setSelectedTask(task)}
              onDelete={async (id) => { await deleteTask(id); }}
              onReorder={reorderTasks}
              onBulkComplete={async (ids) => {
                await Promise.all(ids.map((id) => updateTask(id, { is_done: true })));
              }}
              onBulkDelete={async (ids) => {
                await Promise.all(ids.map((id) => deleteTask(id)));
              }}
              onDeleteAllDone={async () => {
                const doneIds = tasks.filter((t) => t.is_done).map((t) => t.id);
                await Promise.all(doneIds.map((id) => deleteTask(id)));
              }}
            />
          )}
        </SwipeableTaskContainer>
      </main>

      {/* FAB */}
      <Fab onClick={() => setIsCreateOpen(true)} />

      {/* Create Sheet */}
      <TaskCreateSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSubmit={async (task) => {
          await addTask({
            ...task,
            created_by: profile?.id ?? null,
          });
        }}
      />

      {/* Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        categories={categories}
        members={members}
        onUpdate={async (id, updates) => { await updateTask(id, updates); }}
        onDelete={async (id) => { await deleteTask(id); }}
      />
    </div>
  );
}
