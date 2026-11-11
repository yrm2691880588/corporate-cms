import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { auditLogs, users } from "@/lib/schema";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  login: "登录",
  logout: "退出",
  create: "创建",
  update: "修改",
  delete: "删除",
  "reset-password": "重置密码",
  "disable-user": "停用账号",
  "enable-user": "启用账号",
};

const TARGET_LABEL: Record<string, string> = {
  content: "内容",
  category: "栏目",
  user: "用户",
  media: "图片",
  settings: "站点设置",
};

export default async function LogsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin");

  const rows = getDb()
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      detail: auditLogs.detail,
      createdAt: auditLogs.createdAt,
      displayName: users.displayName,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(300)
    .all();

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">操作日志</h1>
        <p className="text-sm text-gray-500 mt-1">最近 300 条记录</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-gray-400">还没有日志</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作人</th>
                  <th>动作</th>
                  <th>对象</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-gray-400 text-xs whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="text-gray-700">{r.displayName ?? "—"}</td>
                    <td>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {ACTION_LABEL[r.action] ?? r.action}
                      </span>
                    </td>
                    <td className="text-gray-500 text-xs">
                      {TARGET_LABEL[r.targetType ?? ""] ?? r.targetType ?? "—"}
                      {r.targetId ? ` #${r.targetId}` : ""}
                    </td>
                    <td className="text-gray-500 text-xs max-w-xs truncate">{r.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
