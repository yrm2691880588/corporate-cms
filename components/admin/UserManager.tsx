"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type U = {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "editor";
  status: "active" | "disabled";
  createdAt: string;
  lastLoginAt: string | null;
};

export default function UserManager({ items }: { items: U[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwTarget, setPwTarget] = useState<U | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: fd.get("username"),
        password: fd.get("password"),
        displayName: fd.get("displayName"),
        role: fd.get("role"),
      }),
    });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(json.error ?? "创建失败");
      return;
    }
    setCreating(false);
    router.refresh();
  }

  async function toggleStatus(u: U) {
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: u.id,
        status: u.status === "active" ? "disabled" : "active",
      }),
    });
    const json = await res.json();
    if (!res.ok) toast.error(json.error ?? "操作失败");
    else { toast.success("已更新"); router.refresh(); }
  }

  async function resetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pwTarget) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pwTarget.id, password: fd.get("password") }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) toast.error(json.error ?? "重置失败");
    else {
      toast.success("密码已重置");
      setPwTarget(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="text-sm text-gray-500 mt-1">账号由管理员创建，不支持自助注册</p>
        </div>
        <button onClick={() => setCreating((v) => !v)} className="btn btn-primary text-sm">
          + 新建账号
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="bg-white rounded-xl border border-gray-100 p-6 mb-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">登录账号</label>
              <input name="username" required className="field" placeholder="字母或数字" />
            </div>
            <div>
              <label className="field-label">显示名称</label>
              <input name="displayName" required className="field" placeholder="如：张三" />
            </div>
            <div>
              <label className="field-label">初始密码</label>
              <input name="password" type="password" required minLength={8} className="field" placeholder="至少 8 位" />
            </div>
            <div>
              <label className="field-label">角色</label>
              <select name="role" className="field">
                <option value="editor">编辑（写、改、发布内容）</option>
                <option value="admin">管理员（全部权限）</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary text-sm">
              {busy ? "创建中…" : "创建"}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="btn btn-secondary text-sm">
              取消
            </button>
          </div>
        </form>
      )}

      {pwTarget && (
        <form onSubmit={resetPassword} className="bg-white rounded-xl border border-amber-200 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">
            重置「{pwTarget.displayName}」的密码
          </h2>
          <input name="password" type="password" required minLength={8} className="field" placeholder="新密码，至少 8 位" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary text-sm">确定重置</button>
            <button type="button" onClick={() => setPwTarget(null)} className="btn btn-secondary text-sm">取消</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="admin-table">
          <thead>
            <tr>
              <th>显示名称</th>
              <th>账号</th>
              <th>角色</th>
              <th>状态</th>
              <th>最后登录</th>
              <th className="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-gray-900">{u.displayName}</td>
                <td className="text-gray-500 text-xs">{u.username}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded ${u.role === "admin" ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                    {u.role === "admin" ? "管理员" : "编辑"}
                  </span>
                </td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded ${u.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.status === "active" ? "正常" : "已停用"}
                  </span>
                </td>
                <td className="text-gray-400 text-xs whitespace-nowrap">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("zh-CN") : "从未登录"}
                </td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={() => setPwTarget(u)} className="text-sm text-indigo-600 hover:text-indigo-700 mr-3">
                    重置密码
                  </button>
                  <button onClick={() => toggleStatus(u)} className="text-sm text-gray-500 hover:text-gray-800">
                    {u.status === "active" ? "停用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
