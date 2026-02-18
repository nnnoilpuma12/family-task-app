"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CategoryTabs } from "@/components/category/category-tabs";
import { TaskList } from "@/components/task/task-list";
import { TaskCreateSheet } from "@/components/task/task-create-sheet";
import { TaskDetailModal } from "@/components/task/task-detail-modal";
import { Fab } from "@/components/ui/fab";
import { useTasks } from "@/hooks/use-tasks";
import { useCategories } from "@/hooks/use-categories";
import { useRealtimeTasks } from "@/hooks/use-realtime-tasks";
import type { Profile, Task } from "@/types";

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const householdId = profile?.household_id ?? null;
  const { categories } = useCategories(householdId);
  const { tasks, setTasks, loading: tasksLoading, addTask, updateTask, deleteTask, toggleTask, reorderTasks } =
    useTasks(householdId, selectedCategoryId);

  useRealtimeTasks(householdId, setTasks);

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
        .single();

      if (!profileData) {
        setLoading(false);
        return;
      }
      setProfile(profileData);

      if (!profileData.household_id) {
        router.push("/household/new");
        setLoading(false);
        return;
      }

      // Fetch household members
      const { data: membersData } = await supabase
        .from("profiles")
        .select("*")
        .eq("household_id", profileData.household_id);
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
        />
      </header>

      {/* Task List */}
      <main className="pt-2">
        {tasksLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            categories={categories}
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
