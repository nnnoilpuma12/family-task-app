"use client";

import { useCallback, memo } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Calendar, GripVertical, Trash2 } from "lucide-react";
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
  onDelete,
  isDragging,
  sortable: isSortable = false,
  isOverlay = false,
}: TaskItemProps) {

  const handleToggle = useCallback(() => {
    onToggle(task.id);
  }, [task.id, onToggle]);

  const showDone = task.is_done;

  // Swipe-to-delete (done tasks only)
  const dragX = useMotionValue(0);
  const deleteOpacity = useTransform(dragX, [-72, -20], [1, 0]);
  const deleteScale = useTransform(dragX, [-72, -20], [1, 0.7]);

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

  const isToday = task.due_date && !task.is_done && (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(task.due_date!); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  })();

  const isTomorrow = task.due_date && !task.is_done && (() => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const d = new Date(task.due_date!); d.setHours(0, 0, 0, 0);
    return d.getTime() === tomorrow.getTime();
  })();

  const urgencyBorderClass = isOverdue
    ? "border-l-4 border-l-red-400"
    : isToday
    ? "border-l-4 border-l-orange-400"
    : isTomorrow
    ? "border-l-4 border-l-yellow-400"
    : "border border-gray-100";

  const dueDateClass = isOverdue
    ? "text-red-500 font-medium"
    : isToday
    ? "text-orange-500 font-medium"
    : isTomorrow
    ? "text-yellow-600 font-medium"
    : "text-gray-500";

  const handleCardClick = () => {
    onTap(task);
  };

  const swipeProps = task.is_done && !isOverlay
    ? {
        drag: "x" as const,
        dragConstraints: { left: -72, right: 0 },
        dragElastic: 0.05,
        style: { x: dragX },
        onDragEnd: (_: unknown, info: { offset: { x: number } }) => {
          if (info.offset.x < -60) {
            onDelete(task.id);
          } else {
            dragX.set(0);
          }
        },
      }
    : {};

  return (
    <div ref={setNodeRef} style={sortStyle} data-task-item>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="relative overflow-hidden rounded-lg"
        style={isOverlay ? { opacity: 0.9, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" } : {}}
      >
        {/* Delete background (shown when swiping left on done tasks) */}
        {task.is_done && !isOverlay && (
          <motion.div
            className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 rounded-lg bg-red-500"
            style={{ width: "100%", opacity: deleteOpacity }}
          >
            <motion.div style={{ scale: deleteScale }}>
              <Trash2 size={20} className="text-white" />
            </motion.div>
          </motion.div>
        )}

        {/* Card */}
        <motion.div
          className={`relative flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm cursor-pointer transition-colors ${urgencyBorderClass}`}
          onClick={handleCardClick}
          {...swipeProps}
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
                    className={`flex items-center gap-0.5 text-xs ${dueDateClass}`}
                  >
                    <Calendar size={10} />
                    {formatDueDate(task.due_date)}
                    {isToday && (
                      <span className="ml-0.5 text-orange-500 font-bold leading-none">!</span>
                    )}
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
        </motion.div>
      </motion.div>
    </div>
  );
});
