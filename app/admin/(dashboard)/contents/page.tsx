import Link from "next/link";
import { listForAdmin } from "@/lib/content";
import ContentTable from "@/components/admin/ContentTable";
import type { ContentStatus, ContentType } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function ContentListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;

  const { items, total } = listForAdmin({
    type: (sp.type as ContentType) || undefined,
    status: (sp.status as ContentStatus) || undefined,
    keyword: sp.q || undefined,
    page,
    pageSize: 20,
  });

  const tabs = [
    { label: "全部", href: "/admin/contents" },
    { label: "文章", href: "/admin/contents?type=article" },
    { label: "产品", href: "/admin/contents?type=product" },
    { label: "单页", href: "/admin/contents?type=page" },
  ];

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">内容管理</h1>
          <p className="text-sm text-gray-500 mt-1">共 {total} 条</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/contents/new?type=article" className="btn btn-primary text-sm">
            + 新建内容
          </Link>
        </div>
      </div>

      {/* 筛选 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => {
            const active =
              t.href === "/admin/contents"
                ? !sp.type
                : sp.type === new URLSearchParams(t.href.split("?")[1]).get("type");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </Link>
            );
          })}

          <form action="/admin/contents" className="ml-auto flex gap-2">
            {sp.type && <input type="hidden" name="type" value={sp.type} />}
            <input
              type="search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="搜索标题…"
              className="field !py-1.5 !text-sm w-48"
            />
            <button type="submit" className="btn btn-secondary text-sm !py-1.5">
              搜索
            </button>
          </form>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 mb-4">还没有内容</p>
            <Link href="/admin/contents/new?type=article" className="btn btn-primary text-sm">
              创建第一篇
            </Link>
          </div>
        ) : (
          <ContentTable items={items} />
        )}
      </div>
    </div>
  );
}
