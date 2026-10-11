"use client";

import { useEffect, useRef } from "react";

const openDialogs: symbol[] = [];
let previousOverflow: string | null = null;

const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function useDialogAccessibility(
  isOpen: boolean,
  onClose: () => void,
  dialogRef: React.RefObject<HTMLElement | null>,
  initialFocusRef?: React.RefObject<HTMLElement | null>
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const token = Symbol("dialog");
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openDialogs.length === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDialogs.push(token);

    const focus = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current ?? dialogRef.current?.querySelector<HTMLElement>(focusableSelector) ?? dialogRef.current;
      target?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs.at(-1) !== token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
          .filter((element) => element.getClientRects().length > 0 || element === document.activeElement);
        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focus);
      document.removeEventListener("keydown", onKeyDown);
      const index = openDialogs.indexOf(token);
      if (index >= 0) openDialogs.splice(index, 1);
      if (openDialogs.length === 0) {
        document.body.style.overflow = previousOverflow ?? "";
        previousOverflow = null;
      }
      previousFocus?.focus();
    };
  }, [isOpen, dialogRef, initialFocusRef]);
}
