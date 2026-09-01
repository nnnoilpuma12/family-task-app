"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { AVATAR_PRESETS } from "@/lib/avatar";
import {
  AVATAR_FILE_ACCEPT,
  createAvatarSource,
  validateAvatarFile,
  type AvatarSource,
} from "@/lib/avatar-upload";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AvatarCropSheet } from "@/components/settings/avatar-crop-sheet";

interface AvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** 選択中のプリセットキー（画像を選んでいる場合は null） */
  selectedKey: string | null;
  /** プリセット選択。null はリセット（ニックネーム頭文字に戻す） */
  onSelectPreset: (key: string | null) => void;
  /** トリミング済みのカスタム画像を選択したとき */
  onSelectImage: (blob: Blob) => void;
}

export function AvatarPicker({
  isOpen,
  onClose,
  selectedKey,
  onSelectPreset,
  onSelectImage,
}: AvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<AvatarSource | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  // 表示中のプレビュー画像。差し替え・閉じるときに object URL を解放する
  const sourceUrlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    };
  }, []);

  const replaceSource = (next: AvatarSource | null) => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    sourceUrlRef.current = next?.url ?? null;
    setSource(next);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じファイルを選び直しても change が発火するようリセットしておく
    e.target.value = "";
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoadingFile(true);
    try {
      replaceSource(await createAvatarSource(file));
    } catch {
      toast.error("画像を読み込めませんでした");
    } finally {
      setLoadingFile(false);
    }
  };

  const closeCropSheet = () => {
    replaceSource(null);
  };

  const handleCropConfirm = (blob: Blob) => {
    closeCropSheet();
    onSelectImage(blob);
    onClose();
  };

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">アイコンを選ぶ</h3>
            <button
              onClick={() => {
                onSelectPreset(null);
                onClose();
              }}
              className="text-xs text-muted hover:text-foreground px-2 py-1 rounded bg-surface-strong"
            >
              リセット
            </button>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loadingFile}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-3 text-sm font-medium text-foreground hover:bg-surface-strong disabled:opacity-50"
          >
            {loadingFile ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ImagePlus size={18} />
            )}
            {loadingFile ? "読み込み中..." : "写真から選ぶ"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={AVATAR_FILE_ACCEPT}
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] text-muted">プリセット</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-6 gap-2">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => {
                  onSelectPreset(preset.key);
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

      <AvatarCropSheet
        isOpen={source !== null}
        source={source}
        onCancel={closeCropSheet}
        onConfirm={handleCropConfirm}
      />
    </>
  );
}
