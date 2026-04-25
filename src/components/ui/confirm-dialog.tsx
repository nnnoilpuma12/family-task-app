"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = "キャンセル",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const focusTimer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, onCancel]);

  const confirmClass =
    variant === "destructive"
      ? "bg-danger hover:opacity-90 text-white"
      : "bg-primary hover:bg-primary-dark text-white";

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={description ? "confirm-dialog-description" : undefined}
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            className="relative w-full max-w-sm rounded-xl bg-surface border border-border p-5 shadow-md"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
          >
            <h2
              id="confirm-dialog-title"
              className="text-lg font-bold text-foreground"
            >
              {title}
            </h2>
            {description && (
              <p
                id="confirm-dialog-description"
                className="mt-2 text-sm leading-relaxed text-muted"
              >
                {description}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={onConfirm}
                className={`min-h-[48px] rounded font-semibold transition-colors ${confirmClass}`}
              >
                {confirmLabel}
              </button>
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={onCancel}
                className="min-h-[48px] rounded bg-surface-strong font-medium text-foreground transition-colors hover:bg-border-strong"
              >
                {cancelLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
