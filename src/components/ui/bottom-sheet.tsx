"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // キーボードが開くとvisualViewportの高さが縮む
      const diff = window.innerHeight - vv.height;
      // 閾値を設けてURLバー変化との誤検知を防ぐ
      setKeyboardHeight(diff > 80 ? diff : 0);
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    // 初回チェックを次フレームに遅延してlintルール準拠
    const rafId = requestAnimationFrame(handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
      setKeyboardHeight(0);
    };
  }, [isOpen]);

  // シートが閉じている時はキーボード高さを0として扱う
  const effectiveKeyboardHeight = isOpen ? keyboardHeight : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-lg bg-white rounded-t-2xl overflow-y-auto"
            style={{
              maxHeight: effectiveKeyboardHeight > 0
                ? `calc(100dvh - ${effectiveKeyboardHeight}px - 40px)`
                : "80dvh",
              marginBottom: effectiveKeyboardHeight > 0 ? `${effectiveKeyboardHeight}px` : 0,
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose();
            }}
          >
            <div className="sticky top-0 z-10 bg-white rounded-t-2xl pt-3 pb-2 px-4">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300" />
              {title && (
                <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              )}
            </div>
            <div className="px-4 pb-8">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
