"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
import { CheckCircle, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
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
  onBulkComplete: (ids: string[]) => void;
  onBulkDelete: (ids: string[]) => void;
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
  onBulkComplete,
  onBulkDelete,
  onDeleteAllDone,
}: TaskListProps) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const activeTasks = tasks.filter((t) => !t.is_done);
  const doneTasks = tasks.filter((t) => t.is_done);

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

  // Bulk selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleLongPress = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const handleSelectToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setSelectionMode(false);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkComplete = () => {
    onBulkComplete(Array.from(selectedIds));
    handleCancelSelection();
  };

  const handleBulkDelete = () => {
    onBulkDelete(Array.from(selectedIds));
    handleCancelSelection();
  };

  // DnD
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localActiveTasks, setLocalActiveTasks] = useState(activeTasks);

  useEffect(() => {
    setLocalActiveTasks(activeTasks);
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setLocalActiveTasks(reordered);
    onReorder(reordered.map((t) => t.id));
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
      {/* Bulk selection header */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="sticky top-0 z-20 flex items-center justify-between bg-indigo-600 px-4 py-3 text-white shadow-md"
          >
            <button onClick={handleCancelSelection} className="text-sm font-medium">
              キャンセル
            </button>
            <span className="text-sm font-bold">{selectedIds.size}件選択中</span>
            <div className="flex items-center gap-3">
              <button onClick={handleBulkComplete} className="flex items-center gap-1 text-sm font-medium">
                <CheckCircle size={16} />
                完了
              </button>
              <button onClick={handleBulkDelete} className="flex items-center gap-1 text-sm font-medium text-red-200">
                <Trash2 size={16} />
                削除
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe hint */}
      <div className="flex items-center justify-center gap-1 py-1 text-gray-300">
        <ChevronLeft size={14} />
        <span className="text-xs">スワイプでカテゴリ切替</span>
        <ChevronRight size={14} />
      </div>

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
            <AnimatePresence mode="popLayout">
              {localActiveTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  category={categoryMap.get(task.category_id ?? "")}
                  createdBy={task.created_by ? memberMap.get(task.created_by) : undefined}
                  onToggle={onToggle}
                  onTap={onTap}
                  onDelete={onDelete}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(task.id)}
                  onLongPress={handleLongPress}
                  onSelectToggle={handleSelectToggle}
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
                selectionMode={false}
                isSelected={false}
                onLongPress={() => {}}
                onSelectToggle={() => {}}
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
            <AnimatePresence mode="popLayout">
              {doneTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  category={categoryMap.get(task.category_id ?? "")}
                  createdBy={task.created_by ? memberMap.get(task.created_by) : undefined}
                  onToggle={onToggle}
                  onTap={onTap}
                  onDelete={onDelete}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(task.id)}
                  onLongPress={handleLongPress}
                  onSelectToggle={handleSelectToggle}
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
