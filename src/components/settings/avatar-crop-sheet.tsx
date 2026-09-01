"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  AVATAR_ZOOM_MAX,
  AVATAR_ZOOM_MIN,
  clampAvatarOffset,
  computeAvatarCropRect,
  getAvatarDisplayMetrics,
  renderAvatarBlob,
  type AvatarSource,
} from "@/lib/avatar-upload";

/** トリミング枠の一辺（CSS px）。小さい端末でも収まるサイズ */
const VIEWPORT_SIZE = 240;

interface AvatarCropSheetProps {
  isOpen: boolean;
  source: AvatarSource | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

/**
 * 選択した画像を正方形に切り出すシート。
 * ドラッグでパン、スライダーでズームし、確定すると 256px の画像 Blob を返す。
 */
export function AvatarCropSheet({ isOpen, source, onCancel, onConfirm }: AvatarCropSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onCancel} elevated>
      {source && (
        // 画像が変わったらズーム・位置を初期状態に戻すため key で作り直す
        <CropEditor key={source.url} source={source} onCancel={onCancel} onConfirm={onConfirm} />
      )}
    </BottomSheet>
  );
}

interface CropEditorProps {
  source: AvatarSource;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

function CropEditor({ source, onCancel, onConfirm }: CropEditorProps) {
  const [zoom, setZoom] = useState(AVATAR_ZOOM_MIN);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const { displayWidth, displayHeight } = getAvatarDisplayMetrics(
    source.width,
    source.height,
    VIEWPORT_SIZE,
    zoom
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const next = {
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    };
    setOffset(clampAvatarOffset(next, source.width, source.height, VIEWPORT_SIZE, zoom));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    setOffset((prev) => clampAvatarOffset(prev, source.width, source.height, VIEWPORT_SIZE, nextZoom));
  };

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      const crop = computeAvatarCropRect(source.width, source.height, VIEWPORT_SIZE, zoom, offset);
      onConfirm(await renderAvatarBlob(source, crop));
    } catch {
      toast.error("画像の変換に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <h3 className="text-sm font-semibold text-foreground">位置とサイズを調整</h3>

      <div
        className="relative mx-auto touch-none overflow-hidden rounded-full bg-surface-strong"
        style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="absolute left-1/2 top-1/2 bg-cover bg-center bg-no-repeat"
          style={{
            width: displayWidth,
            height: displayHeight,
            backgroundImage: `url("${encodeURI(source.url)}")`,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }}
        />
      </div>

      <p className="text-center text-xs text-muted">
        ドラッグで位置、スライダーで大きさを調整できます
      </p>

      <input
        type="range"
        aria-label="拡大率"
        min={AVATAR_ZOOM_MIN}
        max={AVATAR_ZOOM_MAX}
        step={0.01}
        value={zoom}
        onChange={(e) => handleZoomChange(Number(e.target.value))}
        className="w-full accent-primary"
      />

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} className="flex-1">
          キャンセル
        </Button>
        <Button size="sm" onClick={handleConfirm} disabled={processing} className="flex-1">
          {processing ? "処理中..." : "この範囲にする"}
        </Button>
      </div>
    </div>
  );
}
