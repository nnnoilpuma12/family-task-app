"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Trash2, Calendar, GripVertical } from "lucide-react";
import type { Task, Category } from "@/types";

interface TaskItemProps {
  task: Task;
  category?: Category | null;
  onToggle: (id: string) => void;
  onTap: (task: Task) => void;
  onDelete: (id: string) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onLongPress: (id: string) => void;
  onSelectToggle: (id: string) => void;
  isDragging: boolean;
  sortable?: boolean;
  isOverlay?: boolean;
}

export function TaskItem({
  task,
  category,
  onToggle,
  onTap,
  onDelete,
  selectionMode,
  isSelected,
  onLongPress,
  onSelectToggle,
  isDragging,
  sortable: isSortable = false,
  isOverlay = false,
}: TaskItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-120, -60], [1, 0]);
  const constraintsRef = useRef(null);

  // Long press detection
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const startLongPress = () => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress(task.id);
    }, 250);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

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

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -100) {
      setIsDeleting(true);
      setTimeout(() => onDelete(task.id), 300);
    }
  };

  const formatDueDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);

    if (target.getTime() === today.getTime()) return "今日";
    if (target.getTime() === tomorrow.getTime()) return "明日";
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const isOverdue = task.due_date && !task.is_done && new Date(task.due_date) < new Date(new Date().toDateString());

  const handleCardClick = () => {
    if (longPressTriggered.current) return;
    if (selectionMode) {
      onSelectToggle(task.id);
    } else {
      onTap(task);
    }
  };

  return (
    <div ref={setNodeRef} style={sortStyle}>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isDragging ? 0.4 : isDeleting ? 0 : 1, x: isDeleting ? -300 : 0, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="relative overflow-hidden rounded-lg"
        style={isOverlay ? { opacity: 0.9, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" } : {}}
      >
        {/* Delete background */}
        {!selectionMode && (
          <motion.div
            style={{ opacity: deleteOpacity }}
            className="absolute inset-0 flex items-center justify-end bg-red-500 px-6 rounded-lg"
          >
            <Trash2 size={20} className="text-white" />
          </motion.div>
        )}

        {/* Card */}
        <motion.div
          ref={constraintsRef}
          style={selectionMode ? {} : { x }}
          drag={selectionMode ? false : "x"}
          dragConstraints={{ left: -150, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          className={`relative flex items-center gap-2.5 bg-white px-3 py-2.5 rounded-lg shadow-sm border cursor-pointer transition-colors ${
            isSelected ? "border-indigo-400 bg-indigo-50" : "border-gray-100"
          }`}
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onClick={handleCardClick}
        >
          {/* Selection checkbox or drag handle */}
          {selectionMode ? (
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                isSelected ? "border-indigo-600 bg-indigo-600" : "border-gray-300"
              }`}
            >
              {isSelected && <Check size={14} className="text-white" />}
            </div>
          ) : (
            <>
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
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(task.id);
                }}
                whileTap={{ scale: 0.85 }}
                animate={task.is_done ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.25 }}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  task.is_done
                    ? "border-green-500 bg-green-500"
                    : "border-gray-300 hover:border-indigo-400"
                }`}
              >
                {task.is_done && (
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 15, stiffness: 400 }}
                  >
                    <Check size={14} className="text-white" />
                  </motion.div>
                )}
              </motion.button>
            </>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium truncate ${
                task.is_done ? "text-gray-400 line-through" : "text-gray-900"
              }`}
            >
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {category && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${category.color}15`,
                    color: category.color,
                  }}
                >
                  {category.name}
                </span>
              )}
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
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
