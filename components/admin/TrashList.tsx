"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TrashItem = {
  id: number;
  title: string;
  type: string;
  slug: string;
  deletedAt: string | null;
  updatedAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  article: "文章",
  product: "产品",
  page: "单页",
};

export default function TrashList({ items }: { items: TrashItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<TrashItem | null>(null);

  async function restore(item: TrashItem) {
    setBusy(item.id);
    const res = await fetch(`/api/contents/${item.id}?action=restore`, { method: "PATCH" });
    const json = await res.json();
    setBusy(null);

    if (!res.ok) {
      toast.error(json.error ?? "恢复失败");
      return;
    }
    toast.success(`已恢复到草稿，URL 别名为 ${json.slug}`);
    router.refresh();
  }

  async function purge() {
    if (!purgeTarget) return;
    setBusy(purgeTarget.id);
    const res = await fetch(`/api/contents/${purgeTarget.id}?action=purge`, { method: "PATCH" });
    const json = await res.json();
    setBusy(null);
    setPurgeTarget(null);

    if (!res.ok) {
      toast.error(json.error ?? "删除失败");
      return;
    }
    toast.success("已永久删除，无法恢复");
    router.refresh();
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">回收站</h1>
        <p className="text-sm text-gray-500 mt-1">
          删除的内容会先到这里，可随时恢复。永久删除后不可找回。
        </p>
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <div className="py-20 text-center">
            <Trash2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">回收站是空的</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>类型</th>
                  <th>删除时间</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium text-gray-900 max-w-xs">
                      <span className="line-clamp-1">{item.title}</span>
                    </td>
                    <td>
                      <Badge>{TYPE_LABEL[item.type] ?? item.type}</Badge>
                    </td>
                    <td className="text-gray-400 text-xs whitespace-nowrap">
                      {item.deletedAt
                        ? new Date(item.deletedAt).toLocaleString("zh-CN")
                        : "—"}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restore(item)}
                        disabled={busy === item.id}
                        className="text-brand hover:text-brand-dark"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        恢复
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPurgeTarget(item)}
                        disabled={busy === item.id}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        永久删除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!purgeTarget} onOpenChange={(o) => !o && setPurgeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>永久删除「{purgeTarget?.title}」？</DialogTitle>
            <DialogDescription>
              这个操作不可撤销。内容会从数据库彻底移除，无法通过任何方式找回。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPurgeTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={purge} disabled={busy !== null}>
              {busy !== null ? "删除中…" : "确认永久删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
