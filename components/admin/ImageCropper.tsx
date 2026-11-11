"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imageUrl: string;
  mediaId: number;
  onDone: (newUrl: string) => void;
};

/**
 * 图片裁剪
 *
 * 用 react-easy-crop 选区域（拖动 + 缩放），点确定后把区域坐标发给服务端，
 * 由 sharp 做真实裁剪。前端不做画布处理 —— 大图在浏览器里转码容易卡死。
 */
export default function ImageCropper({ open, onOpenChange, imageUrl, mediaId, onDone }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [ratio, setRatio] = useState<number | undefined>(16 / 10);
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  );

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setArea(croppedAreaPixels);
  }, []);

  async function submit() {
    if (!area) {
      toast.error("请先选择裁剪区域");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/media/crop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId,
          crop: {
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
          },
          rotate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "裁剪失败");
        return;
      }
      toast.success("裁剪完成，已另存为新图片");
      onDone(json.url);
      onOpenChange(false);
    } catch {
      toast.error("网络异常");
    } finally {
      setBusy(false);
    }
  }

  const RATIOS = [
    { label: "自由", value: undefined },
    { label: "16:10", value: 16 / 10 },
    { label: "16:9", value: 16 / 9 },
    { label: "21:9", value: 21 / 9 },
    { label: "1:1", value: 1 },
    { label: "4:3", value: 4 / 3 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>裁剪图片</DialogTitle>
          <DialogDescription>
            拖动调整位置，滚轮或滑块缩放。裁剪结果会另存为新图片，原图保留。
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-[360px] bg-gray-900 rounded-lg overflow-hidden">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={ratio}
            rotation={rotate}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-500">比例</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {RATIOS.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setRatio(r.value)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition ${
                    ratio === r.value
                      ? "border-brand bg-brand/5 text-brand font-medium"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500">缩放</Label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full mt-1.5 accent-[var(--brand)]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setRotate(((rotate + 90) % 360) as 0 | 90 | 180 | 270)}
          >
            <RotateCw className="h-4 w-4" />
            旋转 90°
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "裁剪中…" : "确认裁剪"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
