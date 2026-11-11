"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Cat = {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  sortOrder: number;
  isVisible: number;
  description: string | null;
};

export default function CategoryManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Cat | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const top = categories.filter((c) => !c.parentId);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");

    const payload = {
      id: editing?.id,
      name: fd.get("name"),
      slug: fd.get("slug"),
      parentId: fd.get("parentId") ? Number(fd.get("parentId")) : null,
      description: fd.get("description"),
      sortOrder: Number(fd.get("sortOrder") ?? 0),
      isVisible: fd.get("isVisible") === "on",
    };

    const res = await fetch("/api/categories", {
      method: editing?.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(json.error ?? "保存失败");
      return;
    }
    toast.success(editing?.id ? "栏目已更新" : "栏目已创建");
    setEditing(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await fetch(`/api/categories?id=${deleteTarget.id}`, { method: "DELETE" });
    const json = await res.json();
    setBusy(false);
    setDeleteTarget(null);
    if (!res.ok) {
      toast.error(json.error ?? "删除失败");
      return;
    }
    toast.success("栏目已删除");
    router.refresh();
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">栏目管理</h1>
          <p className="text-sm text-gray-500 mt-1">栏目最多两级，构成前台导航结构</p>
        </div>
        <Button onClick={() => setEditing({})}>
          <Plus className="h-4 w-4" />
          新建栏目
        </Button>
      </div>

      {editing !== null && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              {editing.id ? "编辑栏目" : "新建栏目"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cat-name">名称</Label>
                  <Input
                    id="cat-name"
                    name="name"
                    required
                    defaultValue={editing.name}
                    className="mt-1.5"
                    placeholder="如：新闻动态"
                  />
                </div>
                <div>
                  <Label htmlFor="cat-slug">URL 别名</Label>
                  <Input
                    id="cat-slug"
                    name="slug"
                    required
                    defaultValue={editing.slug}
                    className="mt-1.5 font-mono text-sm"
                    placeholder="如：news"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cat-parent">上级栏目</Label>
                  <select
                    id="cat-parent"
                    name="parentId"
                    defaultValue={editing.parentId ?? ""}
                    className="mt-1.5 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:border-brand"
                  >
                    <option value="">作为一级栏目</option>
                    {top.filter((t) => t.id !== editing.id).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="cat-sort">排序（数字小的在前）</Label>
                  <Input
                    id="cat-sort"
                    name="sortOrder"
                    type="number"
                    defaultValue={editing.sortOrder ?? 0}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cat-desc">描述（选填）</Label>
                <Input
                  id="cat-desc"
                  name="description"
                  defaultValue={editing.description ?? ""}
                  className="mt-1.5"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  name="isVisible"
                  type="checkbox"
                  defaultChecked={editing.isVisible !== 0}
                  className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                />
                <span className="text-sm text-gray-700">在前台导航中显示</span>
              </label>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "保存中…" : "保存"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        {categories.length === 0 ? (
          <p className="py-16 text-center text-gray-400">还没有栏目</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>别名</th>
                  <th>层级</th>
                  <th>排序</th>
                  <th>显示</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-gray-900">
                      {c.parentId ? <span className="text-gray-300 mr-1">└</span> : null}
                      {c.name}
                    </td>
                    <td className="text-gray-500 text-xs font-mono">{c.slug}</td>
                    <td className="text-gray-500">{c.parentId ? "二级" : "一级"}</td>
                    <td className="text-gray-500">{c.sortOrder}</td>
                    <td>
                      <Badge variant={c.isVisible ? "success" : "default"}>
                        {c.isVisible ? "显示" : "隐藏"}
                      </Badge>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(c)}
                        className="text-brand hover:text-brand-dark"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(c)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除栏目「{deleteTarget?.name}」？</DialogTitle>
            <DialogDescription>
              栏目下的内容不会被删除，会变成「未分类」。如果该栏目有子栏目，需要先删除子栏目。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
