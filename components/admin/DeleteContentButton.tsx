"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** 内容列表里的删除按钮：删除后进回收站，可恢复 */
export default function DeleteContentButton({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const res = await fetch(`/api/contents/${id}`, { method: "DELETE" });
    const json = await res.json();
    setBusy(false);
    setOpen(false);

    if (!res.ok) {
      toast.error(json.error ?? "删除失败");
      return;
    }
    toast.success("已移到回收站，可在「回收站」里恢复");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-red-600 hover:text-red-700 font-medium ml-3"
      >
        删除
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除「{title}」？</DialogTitle>
            <DialogDescription>
              内容会移到回收站，随时可以恢复。不会立即永久删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              <Trash2 className="h-4 w-4" />
              {busy ? "删除中…" : "移到回收站"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
