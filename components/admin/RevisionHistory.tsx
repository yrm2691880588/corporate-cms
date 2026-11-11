"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Revision = {
  id: number;
  title: string;
  summary: string | null;
  createdAt: string;
  editorId: number | null;
};

/**
 * 历史版本
 *
 * 打开时按需拉取（不预加载，避免每次编辑都多查一次库）。
 * 回滚会把当前内容先另存一份，所以回滚本身也可撤销。
 */
export default function RevisionHistory({ contentId }: { contentId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Revision[]>([]);
  const [target, setTarget] = useState<Revision | null>(null);
  const [busy, setBusy] = useState(false);

  async function openDialog() {
    setOpen(true);
    if (items.length > 0) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/contents/${contentId}/revisions`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "读取历史版本失败");
        return;
      }
      setItems(json.revisions ?? []);
    } catch {
      toast.error("网络异常");
    } finally {
      setLoading(false);
    }
  }

  async function rollback() {
    if (!target) return;
    setBusy(true);
    const res = await fetch(
      `/api/contents/${contentId}/revisions?revisionId=${target.id}`,
      { method: "POST" }
    );
    const json = await res.json();
    setBusy(false);
    setTarget(null);

    if (!res.ok) {
      toast.error(json.error ?? "回滚失败");
      return;
    }
    toast.success("已回滚。当前内容已另存为新版本，可再次回滚回来。");
    setOpen(false);
    setItems([]);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        <History className="h-4 w-4" />
        历史版本
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>历史版本</DialogTitle>
            <DialogDescription>
              每次保存都会留下一个版本，最多保留最近 10 个。回滚本身也会存档，可以再滚回来。
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto -mx-2">
            {loading ? (
              <p className="py-10 text-center text-sm text-gray-400">读取中…</p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">还没有历史版本</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((r, i) => (
                  <li key={r.id} className="px-2 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {r.title}
                        </span>
                        {i === 0 && <Badge variant="info">最新</Badge>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(r.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTarget(r)}
                      className="text-brand hover:text-brand-dark shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      回滚到此
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 二次确认 */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>回滚到这个版本？</DialogTitle>
            <DialogDescription>
              当前内容会被替换成「{target?.title}」。系统会先把当前内容存成一个新版本，所以这个操作可以再回滚回来。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTarget(null)}>
              取消
            </Button>
            <Button onClick={rollback} disabled={busy}>
              {busy ? "回滚中…" : "确认回滚"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
