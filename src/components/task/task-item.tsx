"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Calendar, GripVertical } from "lucide-react";
import type { Task, Category, Profile } from "@/types";
import { formatDueDate } from "@/lib/date";

interface TaskItemProps {
  task: Task;
  category?: Category | null;
  createdBy?: Profile | null;
  onToggle: (id: string) => void;
  onTap: (task: Task) => void;
  onDelete: (id: string) => void;
  isDragging: boolean;
  sortable?: boolean;
  isOverlay?: boolean;
}

export const TaskItem = memo(function TaskItem({
  task,
  category,
  createdBy,
  onToggle,
  onTap,
  isDragging,
  sortable: isSortable = false,
  isOverlay = false,
}: TaskItemProps) {

  // Local pending-done state for checkbox animation before optimistic update
  const [isPendingDone, setIsPendingDone] = useState(false);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If task.is_done becomes true externally (Realtime), cancel pending timer
  useEffect(() => {
    if (task.is_done && isPendingDone) {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      setIsPendingDone(false);
    }
  }, [task.is_done, isPendingDone]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  const handleToggle = useCallback(() => {
    if (task.is_done) {
      // Unchecking: immediate
      onToggle(task.id);
    } else {
      // Checking: show animation first, then trigger toggle after delay
      if (isPendingDone) return; // prevent double-tap
      setIsPendingDone(true);
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null;
        onToggle(task.id);
        setIsPendingDone(false);
      }, 550);
    }
  }, [task.is_done, task.id, isPendingDone, onToggle]);

  const showDone = isPendingDone || task.is_done;

  // dnd-kit sortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition: sortTransition,
  } = useSortable({ id: task.id, disabled: !isSortable });

  const sortStyle = {
    transform: CSS.Transform.toString(transform),
    transition: sortTransition,
  };

  const isOverdue = task.due_date && !task.is_done && new Date(task.due_date) < new Date(new Date().toDateString());

  const handleCardClick = () => {
    onTap(task);
  };

  return (
    <div ref={setNodeRef} style={sortStyle} data-task-item>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="relative overflow-hidden rounded-lg"
        style={isOverlay ? { opacity: 0.9, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" } : {}}
      >
        {/* Card */}
        <div
          className="relative flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-100 cursor-pointer transition-colors"
          onClick={handleCardClick}
        >
          {/* Drag handle (only for sortable active tasks) */}
          {isSortable && (
            <div
              {...attributes}
              {...listeners}
              className="touch-none text-gray-300 cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={14} />
            </div>
          )}

          {/* Checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className="shrink-0 flex items-center justify-center p-3 -m-3 touch-manipulation"
          >
            <motion.span
              whileTap={{ scale: 0.85 }}
              animate={showDone ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.25 }}
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                showDone
                  ? "border-green-500 bg-green-500"
                  : "border-gray-300 hover:border-indigo-400"
              }`}
            >
              {showDone && (
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 15, stiffness: 400 }}
                >
                  <Check size={14} className="text-white" />
                </motion.div>
              )}
            </motion.span>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium truncate ${
                showDone ? "text-gray-400 line-through" : "text-gray-900"
              }`}
            >
              {task.title}
            </p>
            {(task.due_date || createdBy) && (
              <div className="flex items-center gap-2 mt-0.5">
                {task.due_date && (
                  <span
                    className={`flex items-center gap-0.5 text-xs ${
                      isOverdue ? "text-red-500 font-medium" : "text-gray-500"
                    }`}
                  >
                    <Calendar size={10} />
                    {formatDueDate(task.due_date)}
                  </span>
                )}
                {createdBy && (
                  <span className="text-xs text-gray-400">
                    {createdBy.nickname}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
});
