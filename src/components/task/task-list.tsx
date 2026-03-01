"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import confetti from "canvas-confetti";
import { Trash2 } from "lucide-react";
import { TaskItem } from "./task-item";
import type { Task, Category, Profile } from "@/types";

interface TaskListProps {
  tasks: Task[];
  categories: Category[];
  members: Profile[];
  onToggle: (id: string) => void;
  onTap: (task: Task) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onDeleteAllDone: () => void;
}

export function TaskList({
  tasks,
  categories,
  members,
  onToggle,
  onTap,
  onDelete,
  onReorder,
  onDeleteAllDone,
}: TaskListProps) {
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const activeTasks = useMemo(() => tasks.filter((t) => !t.is_done), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.is_done), [tasks]);

  // Confetti on all tasks done
  const allDoneRef = useRef(false);
  useEffect(() => {
    if (tasks.length > 0 && tasks.every((t) => t.is_done)) {
      if (!allDoneRef.current) {
        allDoneRef.current = true;
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    } else {
      allDoneRef.current = false;
    }
  }, [tasks]);

  // Delete-all-done confirmation
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirmDelete = () => {
    onDeleteAllDone();
    setShowConfirm(false);
  };

  // DnD
  const [activeId, setActiveId] = useState<string | null>(null);
  // Track DnD reorder locally; reset when the source task list changes
  const [dndOrderedIds, setDndOrderedIds] = useState<string[] | null>(null);
  const activeTaskIds = useMemo(() => activeTasks.map((t) => t.id), [activeTasks]);
  const [prevActiveTaskIds, setPrevActiveTaskIds] = useState(activeTaskIds);

  // Reset DnD order when source tasks change (category switch or external update)
  if (prevActiveTaskIds !== activeTaskIds) {
    setPrevActiveTaskIds(activeTaskIds);
    if (dndOrderedIds !== null) {
      setDndOrderedIds(null);
    }
  }

  const localActiveTasks = useMemo(() => {
    if (!dndOrderedIds) return activeTasks;
    const taskMap = new Map(activeTasks.map((t) => [t.id, t]));
    return dndOrderedIds
      .map((id) => taskMap.get(id))
      .filter((t): t is Task => t !== undefined);
  }, [activeTasks, dndOrderedIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = localActiveTasks.findIndex((t) => t.id === active.id);
    const newIndex = localActiveTasks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(localActiveTasks, oldIndex, newIndex);
    const reorderedIds = reordered.map((t) => t.id);
    setDndOrderedIds(reorderedIds);
    onReorder(reorderedIds);
  };

  const activeTask = activeId ? localActiveTasks.find((t) => t.id === activeId) : null;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-lg">タスクがありません</p>
        <p className="mt-1 text-sm">右下の＋ボタンで追加しましょう</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5 px-4 pb-24">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localActiveTasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {localActiveTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  category={categoryMap.get(task.category_id ?? "")}
                  createdBy={task.created_by ? memberMap.get(task.created_by) : undefined}
                  onToggle={onToggle}
                  onTap={onTap}
                  onDelete={onDelete}
                  isDragging={activeId === task.id}
                  sortable
                />
              ))}
            </AnimatePresence>
          </SortableContext>

          <DragOverlay>
            {activeTask && (
              <TaskItem
                task={activeTask}
                category={categoryMap.get(activeTask.category_id ?? "")}
                createdBy={activeTask.created_by ? memberMap.get(activeTask.created_by) : undefined}
                onToggle={() => {}}
                onTap={() => {}}
                onDelete={() => {}}
                isDragging={false}
                isOverlay
              />
            )}
          </DragOverlay>
        </DndContext>

        {doneTasks.length > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between px-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                完了 ({doneTasks.length})
              </p>
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
              >
                <Trash2 size={14} />
                すべて削除
              </button>
            </div>
            <AnimatePresence>
              {showConfirm && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm"
                >
                  <span className="text-red-700">完了済み {doneTasks.length}件を削除しますか？</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleConfirmDelete}
                      className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600"
                    >
                      削除
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      キャンセル
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence mode="popLayout" initial={false}>
              {doneTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  category={categoryMap.get(task.category_id ?? "")}
                  createdBy={task.created_by ? memberMap.get(task.created_by) : undefined}
                  onToggle={onToggle}
                  onTap={onTap}
                  onDelete={onDelete}
                  isDragging={false}
                />
              ))}
            </AnimatePresence>
          </>
        )}
      </div>
    </>
  );
}
