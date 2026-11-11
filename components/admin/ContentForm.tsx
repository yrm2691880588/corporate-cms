"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { makeSlug } from "@/lib/slug";
import { CONTENT_TYPE_LABEL, CONTENT_STATUS_META } from "@/lib/content-labels";

/** 把 Date 转成 <input type="datetime-local"> 需要的格式（本地时间，YYYY-MM-DDTHH:mm） */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 默认定时时间：当前时间 + 10 分钟（取整到 5 分钟） */
function defaultScheduledAt(): string {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
  return toLocalInputValue(d);
}

import RevisionHistory from "@/components/admin/RevisionHistory";
import MediaPicker from "@/components/admin/MediaPicker";

const RichEditor = dynamic(() => import("@/components/admin/RichEditor"), {
  ssr: false,
  loading: () => (
    <div className="border border-gray-200 rounded-lg min-h-[460px] flex items-center justify-center text-gray-400 text-sm">
      编辑器加载中…
    </div>
  ),
});

type Category = { id: number; name: string; parentId: number | null; slug: string };
type Tag = { id: number; name: string; slug: string };

export type ContentFormProps = {
  mode: "new" | "edit";
  type: "article" | "product" | "page";
  initial?: {
    id: number;
    title: string;
    slug: string;
    summary: string | null;
    body: string;
    coverImage: string | null;
    coverThumb?: string | null;
    categoryId: number | null;
    status: string;
    isFeatured: boolean;
    seoTitle: string | null;
    seoDescription: string | null;
    scheduledAt: string | null;
    tags: { name: string; slug: string }[];
  };
  categories: Category[];
  allTags: Tag[];
};




export default function ContentForm({ mode, type, initial, categories, allTags }: ContentFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [coverThumb, setCoverThumb] = useState<string | null>(initial?.coverThumb ?? null);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduledAt ? initial.scheduledAt.slice(0, 16) : defaultScheduledAt()
  );
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>((initial?.tags ?? []).map((t) => t.name));
  const [coverUploading, setCoverUploading] = useState(false);

  // 标题变化时自动生成 slug（用户没手动改过）
  useEffect(() => {
    if (!slugTouched) setSlug(makeSlug(title));
  }, [title, slugTouched]);

  const save = useCallback(
    async (status: "draft" | "published" | "offline" | "scheduled") => {
      if (!title.trim()) {
        setMessage({ kind: "err", text: "请填写标题" });
        return;
      }
      if (status === "scheduled" && !scheduledAt) {
        setMessage({ kind: "err", text: "定时发布需要选择时间" });
        return;
      }

      setSaving(true);
      setMessage(null);

      try {
        const payload = {
          id: initial?.id,
          type,
          title: title.trim(),
          slug: slug.trim(),
          summary: summary.trim() || null,
          body,
          coverImage: coverImage || null,
          coverThumb,
          categoryId,
          status,
          isFeatured,
          seoTitle: seoTitle.trim() || null,
          seoDescription: seoDescription.trim() || null,
          scheduledAt: status === "scheduled" ? new Date(scheduledAt).toISOString() : null,
          tags: selectedTags,
        };

        const res = await fetch("/api/contents", {
          method: mode === "new" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();

        if (!res.ok) {
          setMessage({ kind: "err", text: json.error ?? "保存失败" });
          setSaving(false);
          return;
        }

        setMessage({
          kind: "ok",
          text:
            status === "published"
              ? "已发布，前台即刻可见"
              : status === "draft"
              ? "已保存草稿"
              : status === "scheduled"
              ? "已设置定时发布"
              : "已下线",
        });

        if (mode === "new" && json.id) {
          router.replace(`/admin/contents/${json.id}`);
        }
        router.refresh();
      } catch {
        setMessage({ kind: "err", text: "网络异常，保存失败" });
      } finally {
        setSaving(false);
      }
    },
    [title, slug, summary, body, coverImage, categoryId, isFeatured, seoTitle, seoDescription, scheduledAt, selectedTags, type, mode, initial, router]
  );

  async function uploadCover(file: File) {
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        setCoverImage(json.url);
        setCoverThumb(json.thumbUrl ?? null);
      }
      else toast.error(json.error ?? "上传失败");
    } finally {
      setCoverUploading(false);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !selectedTags.includes(t)) {
      setSelectedTags([...selectedTags, t]);
    }
    setTagInput("");
  }

  const statusLabel = initial?.status
    ? CONTENT_STATUS_META[initial.status as keyof typeof CONTENT_STATUS_META]?.label
    : "新建";

  return (
    <div className="max-w-6xl">
      {/* 顶栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === "new" ? `新建${CONTENT_TYPE_LABEL[type]}` : `编辑${CONTENT_TYPE_LABEL[type]}`}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            当前状态：<span className="font-medium">{statusLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "edit" && initial?.id ? (
            <RevisionHistory contentId={initial.id} />
          ) : null}
          <button onClick={() => save("draft")} disabled={saving} className="btn btn-secondary text-sm">
            保存草稿
          </button>
          {mode === "edit" && initial?.id ? (
            <a
              href={`/admin/preview?id=${initial.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary text-sm"
            >
              预览
            </a>
          ) : null}
          {type !== "page" && (
            <button onClick={() => save("scheduled")} disabled={saving} className="btn btn-secondary text-sm">
              定时发布
            </button>
          )}
          <button onClick={() => save("published")} disabled={saving} className="btn btn-primary text-sm">
            {saving ? "保存中…" : "发布"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-5 px-4 py-3 rounded-lg text-sm border ${
            message.kind === "ok"
              ? "bg-green-50 border-green-100 text-green-700"
              : "bg-red-50 border-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 主区 */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <label className="field-label">标题</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field !text-lg !font-semibold"
              placeholder="请输入标题"
            />

            <div className="mt-4">
              <label className="field-label">URL 别名（slug）</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 whitespace-nowrap">
                  {type === "article" ? "/news/" : type === "product" ? "/products/" : "/"}
                </span>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  className="field !text-sm"
                  placeholder="英文或数字，发布后不建议修改"
                />
              </div>
              <p className="field-hint">发布后修改会导致旧链接失效，请谨慎</p>
            </div>

            <div className="mt-4">
              <label className="field-label">摘要</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                className="field resize-y"
                placeholder="列表页和搜索结果中显示的一段简介（可选）"
              />
            </div>
          </div>

          <div>
            <label className="field-label mb-2">正文</label>
            <RichEditor value={body} onChange={setBody} />
          </div>

          {/* SEO */}
          <details className="bg-white rounded-xl border border-gray-100 p-5">
            <summary className="font-semibold text-gray-900 text-sm cursor-pointer">
              SEO 设置（可选，留空则自动生成）
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <label className="field-label">SEO 标题</label>
                <input
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="field"
                  placeholder="留空则使用文章标题"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="field-label">SEO 描述</label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={3}
                  className="field resize-y"
                  placeholder="留空则使用摘要"
                  maxLength={300}
                />
              </div>
            </div>
          </details>
        </div>

        {/* 侧栏 */}
        <div className="space-y-5">
          {/* 发布设置 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">发布设置</h2>

            <div className="space-y-4">
              {type !== "page" && (
                <div>
                  <label className="field-label">所属栏目</label>
                  <select
                    value={categoryId ?? ""}
                    onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                    className="field !text-sm"
                  >
                    <option value="">未分类</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parentId ? "　└ " : ""}
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="field-label">定时发布时间</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="field !text-sm"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                />
                <span className="text-sm text-gray-700">设为精选（显示在首页推荐位）</span>
              </label>

              {initial?.status === "published" && (
                <button
                  onClick={() => save("offline")}
                  disabled={saving}
                  className="btn btn-secondary w-full text-sm !text-amber-700"
                >
                  下线此内容
                </button>
              )}
            </div>
          </div>

          {/* 封面图 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">封面图</h2>

            {coverImage ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="封面" className="w-full rounded-lg border border-gray-100" />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCoverPicker(true)}
                    className="text-xs text-brand hover:underline"
                  >
                    换一张
                  </button>
                  <button
                    onClick={() => setCoverImage("")}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    移除封面
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block border-2 border-dashed border-gray-200 rounded-lg p-5 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadCover(f);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-sm text-gray-500">
                    {coverUploading ? "上传中…" : "上传新图片"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">建议横图，自动压缩为 WebP</p>
                </label>
                <button
                  type="button"
                  onClick={() => setShowCoverPicker(true)}
                  className="w-full h-9 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  从图库选择
                </button>
              </div>
            )}

            {/* 从图库选封面 */}
            <MediaPicker
              open={showCoverPicker}
              onOpenChange={setShowCoverPicker}
              title="选择封面图"
              onPick={(url) => {
                setCoverImage(url);
                setCoverThumb(null);
                toast.success("封面已选择");
              }}
            />
          </div>

          {/* 标签 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">标签</h2>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedTags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded"
                >
                  {t}
                  <button
                    onClick={() => setSelectedTags(selectedTags.filter((x) => x !== t))}
                    className="hover:text-red-600"
                    aria-label={`移除标签 ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedTags.length === 0 && (
                <span className="text-xs text-gray-400">还没有标签</span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="field !py-1.5 !text-sm"
                placeholder="输入后回车"
                list="tag-suggestions"
              />
              <datalist id="tag-suggestions">
                {allTags.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
              <button onClick={addTag} className="btn btn-secondary !py-1.5 !px-3 text-sm">
                添加
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
