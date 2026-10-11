"use client";

import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useDialogAccessibility } from "@/hooks/use-dialog-accessibility";

// マウント判定用（サーバでは false、クライアントでは true）。
// 値は変化しないので購読は no-op でよい。
const subscribeNoop = () => () => {};
const getMountedSnapshot = () => true;
const getServerSnapshot = () => false;

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
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(isOpen, onCancel, dialogRef, cancelButtonRef);

  // `transform` / `will-change` を持つ祖先（SwipeableTaskContainer など）は
  // position: fixed の包含ブロックになり、表示位置がリスト量に応じてずれる。
  // document.body へポータルして常にビューポート基準で中央寄せする。
  const isMounted = useSyncExternalStore(
    subscribeNoop,
    getMountedSnapshot,
    getServerSnapshot
  );

  const confirmClass =
    variant === "destructive"
      ? "bg-danger hover:opacity-90 text-white"
      : "bg-primary hover:bg-primary-dark text-white";

  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
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
    </AnimatePresence>,
    document.body
  );
}
