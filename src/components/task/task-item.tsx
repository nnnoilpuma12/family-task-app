"use client";

import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Check, Trash2, Calendar } from "lucide-react";
import type { Task, Category } from "@/types";

interface TaskItemProps {
  task: Task;
  category?: Category | null;
  onToggle: (id: string) => void;
  onTap: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, category, onToggle, onTap, onDelete }: TaskItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-120, -60], [1, 0]);
  const constraintsRef = useRef(null);

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isDeleting ? 0 : 1, x: isDeleting ? -300 : 0, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="relative overflow-hidden rounded-xl"
    >
      {/* Delete background */}
      <motion.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-0 flex items-center justify-end bg-red-500 px-6 rounded-xl"
      >
        <Trash2 size={20} className="text-white" />
      </motion.div>

      {/* Card */}
      <motion.div
        ref={constraintsRef}
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="relative flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer"
        onClick={() => onTap(task)}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id);
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
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
        </button>

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
  );
}
