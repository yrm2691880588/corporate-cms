"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, EyeOff, Send } from "lucide-react";
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
import DeleteContentButton from "./DeleteContentButton";
import { CONTENT_TYPE_LABEL, CONTENT_STATUS_META } from "@/lib/content-labels";
import type { Content } from "@/lib/content";

/**
 * 内容列表表格（客户端组件）
 *
 * 抽出来的原因：批量操作需要勾选状态，服务端组件无法维护交互状态。
 * 数据仍由服务端查好传入，这里只负责展示与操作。
 */
export default function ContentTable({ items }: { items: Content[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"publish" | "offline" | "delete" | null>(null);

  const allSelected = items.length > 0 && selected.length === items.length;
  const someSelected = selected.length > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? [] : items.map((i) => i.id));
  }

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function runBatch() {
    if (!confirmAction) return;
    setBusy(true);
    const res = await fetch("/api/contents/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, action: confirmAction }),
    });
    const json = await res.json();
    setBusy(false);
    setConfirmAction(null);

    if (!res.ok) {
      toast.error(json.error ?? "操作失败");
      return;
    }
    const label =
      confirmAction === "publish" ? "发布" : confirmAction === "offline" ? "下线" : "删除";
    toast.success(`已${label} ${json.affected} 条`);
    setSelected([]);
    router.refresh();
  }

  const ACTION_LABEL = { publish: "发布", offline: "下线", delete: "删除" } as const;

  return (
    <>
      {/* 批量操作条：有勾选时才出现 */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
          <span className="text-sm text-indigo-900 font-medium">
            已选 {selected.length} 条
          </span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => setConfirmAction("publish")}>
              <Send className="h-3.5 w-3.5" />
              批量发布
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmAction("offline")}>
              <EyeOff className="h-3.5 w-3.5" />
              批量下线
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmAction("delete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              批量删除
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              取消选择
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="全选"
                  className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                />
              </th>
              <th>标题</th>
              <th>类型</th>
              <th>栏目</th>
              <th>状态</th>
              <th>作者 / 最后修改</th>
              <th>更新时间</th>
              <th className="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const st = CONTENT_STATUS_META[item.status];
              const checked = selected.includes(item.id);
              return (
                <tr key={item.id} className={checked ? "bg-indigo-50/40" : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(item.id)}
                      aria-label={`选择 ${item.title}`}
                      className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                    />
                  </td>
                  <td className="max-w-xs">
                    <Link
                      href={`/admin/contents/${item.id}`}
                      className="font-medium text-gray-900 hover:text-indigo-600 line-clamp-1"
                    >
                      {item.title}
                    </Link>
                    {item.isFeatured && (
                      <span className="ml-2 text-xs text-amber-600">精选</span>
                    )}
                  </td>
                  <td className="text-gray-500">{CONTENT_TYPE_LABEL[item.type]}</td>
                  <td className="text-gray-500">{item.categoryName ?? "—"}</td>
                  <td>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </td>
                  <td className="text-gray-500 text-xs whitespace-nowrap">
                    <div>{item.authorName ?? "—"}</div>
                    {item.lastEditorName && item.lastEditorName !== item.authorName && (
                      <div className="text-gray-400">改：{item.lastEditorName}</div>
                    )}
                  </td>
                  <td className="text-gray-400 text-xs whitespace-nowrap">
                    {new Date(item.updatedAt).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <Link
                      href={`/admin/contents/${item.id}`}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      编辑
                    </Link>
                    <DeleteContentButton id={item.id} title={item.title} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              确认{confirmAction ? ACTION_LABEL[confirmAction] : ""} {selected.length} 条内容？
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "delete"
                ? "内容会移到回收站，可以恢复。不会立即永久删除。"
                : confirmAction === "publish"
                ? "这些内容会立即出现在前台。"
                : "这些内容会从前台隐藏，但不会被删除。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              取消
            </Button>
            <Button
              variant={confirmAction === "delete" ? "destructive" : "default"}
              onClick={runBatch}
              disabled={busy}
            >
              {busy ? "处理中…" : `确认${confirmAction ? ACTION_LABEL[confirmAction] : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
