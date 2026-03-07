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
          <h3 className="text-sm font-semibold text-gray-900">アイコンを選ぶ</h3>
          <button
            onClick={() => {
              onSelect(null);
              onClose();
            }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded bg-gray-100"
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
              className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-colors ${
                selectedKey === preset.key
                  ? "bg-indigo-50 ring-2 ring-indigo-500"
                  : "hover:bg-gray-50"
              }`}
              title={preset.label}
            >
              <span className="text-2xl">{preset.emoji}</span>
              <span className="text-[10px] text-gray-500 leading-tight">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
