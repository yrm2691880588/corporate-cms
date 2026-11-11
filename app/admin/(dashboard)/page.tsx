import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getStats, listForAdmin } from "@/lib/content";
import { messages } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await getCurrentUser();
  const stats = getStats();
  const recent = listForAdmin({ pageSize: 5 });
  const recentMessages = getDb()
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt))
    .limit(3)
    .all();

  const cards = [
    { label: "已发布内容", value: stats.published, href: "/admin/contents?status=published", color: "text-green-600 bg-green-50" },
    { label: "草稿", value: stats.drafts, href: "/admin/contents?status=draft", color: "text-amber-600 bg-amber-50" },
    { label: "未读留言", value: stats.unreadMessages, href: "/admin/messages", color: "text-red-600 bg-red-50" },
    { label: "图片", value: stats.mediaCount, href: "/admin/media", color: "text-indigo-600 bg-indigo-50" },
  ];

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          你好，{user?.displayName}
        </h1>
        <p className="text-sm text-gray-500">这里是你的内容管理概览</p>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition"
          >
            <p className="text-sm text-gray-500 mb-2">{c.label}</p>
            <p className={`text-3xl font-bold ${c.color.split(" ")[0]}`}>{c.value}</p>
          </Link>
        ))}
      </div>

      {/* 快捷操作 */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
        <h2 className="font-semibold text-gray-900 mb-4">快速开始</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/contents/new?type=article" className="btn btn-primary">
            + 写一篇文章
          </Link>
          <Link href="/admin/contents/new?type=product" className="btn btn-secondary">
            + 添加产品
          </Link>
          <Link href="/admin/contents/new?type=page" className="btn btn-secondary">
            + 新建单页
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 最近编辑 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">最近编辑</h2>
            <Link href="/admin/contents" className="text-xs text-indigo-600 hover:text-indigo-700">
              全部 →
            </Link>
          </div>
          {recent.items.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">还没有内容</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recent.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/contents/${item.id}`}
                    className="block px-6 py-3.5 hover:bg-gray-50 transition"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(item.updatedAt).toLocaleString("zh-CN")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 最新留言 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">最新留言</h2>
            <Link href="/admin/messages" className="text-xs text-indigo-600 hover:text-indigo-700">
              全部 →
            </Link>
          </div>
          {recentMessages.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">还没有留言</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentMessages.map((m) => (
                <li key={m.id} className="px-6 py-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{m.name}</span>
                    {!m.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-label="未读" />
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(m.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">{m.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
