"use client";

import { AnimatePresence } from "framer-motion";
import { TaskItem } from "./task-item";
import type { Task, Category } from "@/types";

interface TaskListProps {
  tasks: Task[];
  categories: Category[];
  onToggle: (id: string) => void;
  onTap: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, categories, onToggle, onTap, onDelete }: TaskListProps) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const activeTasks = tasks.filter((t) => !t.is_done);
  const doneTasks = tasks.filter((t) => t.is_done);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-lg">タスクがありません</p>
        <p className="mt-1 text-sm">右下の＋ボタンで追加しましょう</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4 pb-24">
      <AnimatePresence mode="popLayout">
        {activeTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            category={categoryMap.get(task.category_id ?? "")}
            onToggle={onToggle}
            onTap={onTap}
            onDelete={onDelete}
          />
        ))}
      </AnimatePresence>

      {doneTasks.length > 0 && (
        <>
          <p className="mt-4 px-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
            完了 ({doneTasks.length})
          </p>
          <AnimatePresence mode="popLayout">
            {doneTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                category={categoryMap.get(task.category_id ?? "")}
                onToggle={onToggle}
                onTap={onTap}
                onDelete={onDelete}
              />
            ))}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
