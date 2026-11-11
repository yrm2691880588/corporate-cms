import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getById } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { CONTENT_STATUS_META } from "@/lib/content-labels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "预览",
  robots: { index: false, follow: false },
};

/**
 * 内容预览
 *
 * 【为什么单独一个路由】
 * 草稿不能出现在正式详情页里（状态过滤不允许），
 * 但编辑需要在发布前看看排版效果。
 * 这里只对已登录用户开放，并带 noindex，不会被搜索引擎收进去。
 */
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  const sp = await searchParams;
  const id = Number(sp.id);
  if (!id) notFound();

  const item = getById(id);
  if (!item) notFound();

  const settings = getSettings();
  const statusLabel = CONTENT_STATUS_META[item.status]?.label ?? item.status;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 预览提示条：明确这不是正式页面 */}
      <div className="sticky top-0 z-50 bg-amber-500 text-white text-sm">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <span>
            预览模式 · 当前状态：<strong>{statusLabel}</strong>
            {item.status !== "published" && "（访客看不到这个页面）"}
          </span>
          <Link
            href={`/admin/contents/${item.id}`}
            className="underline underline-offset-2 hover:no-underline shrink-0"
          >
            返回编辑
          </Link>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 bg-white min-h-screen shadow-sm">
        <h1 className="text-2xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
          {item.title}
        </h1>

        <div className="text-sm text-gray-400 pb-6 mb-8 border-b border-gray-100">
          {settings.shortName} · {new Date(item.updatedAt).toLocaleString("zh-CN")}
          {item.categoryName && ` · ${item.categoryName}`}
        </div>

        {item.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverImage} alt={item.title} className="w-full rounded-xl mb-8" />
        )}

        {item.summary && (
          <p className="text-lg text-gray-600 leading-relaxed mb-8">{item.summary}</p>
        )}

        <div className="prose-content" dangerouslySetInnerHTML={{ __html: item.body }} />
      </article>
    </div>
  );
}
