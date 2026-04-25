"use client";

import { AVATAR_PRESETS } from "@/lib/avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";

interface AvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}

export function AvatarPicker({ isOpen, onClose, selectedKey, onSelect }: AvatarPickerProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">アイコンを選ぶ</h3>
          <button
            onClick={() => {
              onSelect(null);
              onClose();
            }}
            className="text-xs text-muted hover:text-foreground px-2 py-1 rounded bg-surface-strong"
          >
            リセット
          </button>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {AVATAR_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => {
                onSelect(preset.key);
                onClose();
              }}
              className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
                selectedKey === preset.key
                  ? "bg-primary-soft ring-2 ring-focus"
                  : "hover:bg-surface-strong"
              }`}
              title={preset.label}
            >
              <span className="text-2xl">{preset.emoji}</span>
              <span className="text-[10px] text-muted leading-tight">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
