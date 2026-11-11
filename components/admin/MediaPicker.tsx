"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ImageOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MediaItem = {
  id: number;
  filename: string;
  originalName: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  thumbPath: string | null;
};

/**
 * 图库选择器
 *
 * 供编辑器和封面图使用：打开时按需拉取图片列表，
 * 点选一张后把 URL 回传给调用方，不复制文件、不重复上传。
 */
export default function MediaPicker({
  open,
  onOpenChange,
  onPick,
  title = "从图库选择图片",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (url: string, alt: string) => void;
  title?: string;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    fetch("/api/media/list")
      .then((r) => r.json())
      .then((j) => {
        if (j.items) {
          setItems(j.items);
          setLoaded(true);
        }
      })
      .catch(() => toast.error("读取图库失败"))
      .finally(() => setLoading(false));
  }, [open, loaded]);

  const filtered = keyword.trim()
    ? items.filter((m) => m.originalName.toLowerCase().includes(keyword.trim().toLowerCase()))
    : items;

  function pick(m: MediaItem) {
    onPick(`/uploads/${m.filename}`, m.originalName.replace(/\.[^.]+$/, ""));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            点击一张图片即可使用。图库里的图片都已压缩为 WebP，不会重复占用空间。
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按文件名搜索…"
            className="pl-9"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto -mx-2 px-2">
          {loading ? (
            <p className="py-12 text-center text-sm text-gray-400">读取中…</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <ImageOff className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                {items.length === 0 ? "图库还没有图片，先去「图片库」上传" : "没有匹配的图片"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pick(m)}
                  className="group text-left rounded-lg overflow-hidden border border-gray-100 hover:border-brand hover:shadow-md transition"
                >
                  <div className="aspect-square bg-gray-50 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.thumbPath ?? `/uploads/${m.filename}`}
                      alt={m.originalName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-gray-600 truncate" title={m.originalName}>
                      {m.originalName}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
