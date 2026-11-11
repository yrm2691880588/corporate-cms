"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Copy, Upload, ImageOff, Crop } from "lucide-react";
import ImageCropper from "./ImageCropper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Media = {
  id: number;
  filename: string;
  originalName: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  thumbPath: string | null;
  createdAt: string;
};

export default function MediaLibrary({ items, limited = false }: { items: Media[]; limited?: boolean }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Media | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cropTarget, setCropTarget] = useState<Media | null>(null);

  async function upload(files: FileList) {
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(`${file.name}：${j.error ?? "上传失败"}`);
      } else {
        ok += 1;
      }
    }
    setUploading(false);
    if (ok > 0) toast.success(`已上传 ${ok} 张图片`);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/media?id=${deleteTarget.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(false);
    setDeleteTarget(null);
    if (!res.ok) {
      toast.error(json.error ?? "删除失败");
      return;
    }
    toast.success("已删除");
    router.refresh();
  }

  function urlOf(m: Media) {
    return `/uploads/${m.filename}`;
  }

  async function copyUrl(m: Media) {
    try {
      await navigator.clipboard.writeText(urlOf(m));
      setCopied(m.id);
      toast.success("链接已复制");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("复制失败，请手动复制：" + urlOf(m));
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">图片库</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {items.length} 张{limited ? "（仅显示最近 200 张）" : ""}，上传后自动压缩为 WebP
          </p>
        </div>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-dark transition">
            <Upload className="h-4 w-4" />
            {uploading ? "上传中…" : "上传图片"}
          </span>
        </label>
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed py-20 text-center">
          <ImageOff className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">还没有图片</p>
          <p className="text-xs text-gray-400">支持 JPG / PNG / WebP / GIF，单张不超过 20MB</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((m) => (
            <Card key={m.id} className="overflow-hidden group">
              <div className="aspect-square bg-gray-50 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.thumbPath ?? urlOf(m)}
                  alt={m.originalName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <p className="text-xs text-gray-700 truncate" title={m.originalName}>
                  {m.originalName}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(m.sizeBytes / 1024).toFixed(0)} KB
                  {m.width && m.height ? ` · ${m.width}×${m.height}` : ""}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => copyUrl(m)}
                    className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === m.id ? "已复制" : "复制链接"}
                  </button>
                  <button
                    onClick={() => setCropTarget(m)}
                    className="inline-flex items-center gap-1 text-xs text-gray-600 hover:underline"
                  >
                    <Crop className="h-3 w-3" />
                    裁剪
                  </button>
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline ml-auto"
                  >
                    <Trash2 className="h-3 w-3" />
                    删除
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 裁剪 */}
      {cropTarget && (
        <ImageCropper
          open={!!cropTarget}
          onOpenChange={(o) => !o && setCropTarget(null)}
          imageUrl={`/uploads/${cropTarget.filename}`}
          mediaId={cropTarget.id}
          onDone={() => router.refresh()}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除这张图片？</DialogTitle>
            <DialogDescription>
              正文中引用这张图的地方会显示为空白。如果图片正被内容使用，系统会拒绝删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
