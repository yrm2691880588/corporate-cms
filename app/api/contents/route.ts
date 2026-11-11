import { NextRequest, NextResponse } from "next/server";
import { withErrorLogging } from "@/lib/api-wrapper";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser, audit } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { getDb, now } from "@/lib/db";
import { contents, tags, contentTags, contentRevisions } from "@/lib/schema";
import { normalizeSlug } from "@/lib/slug";


const contentSchema = z.object({
  id: z.number().int().positive().optional(),
  type: z.enum(["article", "product", "page"]),
  title: z.string().trim().min(1, "标题不能为空").max(200, "标题过长"),
  slug: z.string().trim().optional().default(""),
  summary: z.string().nullable().optional(),
  body: z.string().default(""),
  coverImage: z.string().nullable().optional(),
  coverThumb: z.string().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "published", "offline", "scheduled"]).default("draft"),
  isFeatured: z.boolean().default(false),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
});

/** 同步标签（Drizzle 版） */
function syncTags(contentId: number, rawTags: string[]) {
  const db = getDb();
  db.delete(contentTags).where(eq(contentTags.contentId, contentId)).run();

  for (const raw of rawTags) {
    const name = String(raw).trim();
    if (!name) continue;

    let tag = db.select({ id: tags.id }).from(tags).where(eq(tags.name, name)).get();
    if (!tag) {
      const slug =
        normalizeSlug(name) ||
        `tag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const res = db.insert(tags).values({ name, slug }).run();
      tag = { id: Number(res.lastInsertRowid) };
    }

    // 已存在则忽略（主键冲突时不报错）
    try {
      db.insert(contentTags).values({ contentId, tagId: tag.id }).run();
    } catch {
      /* 重复标签，忽略 */
    }
  }
}

/** 保存历史版本（最多保留 10 版） */
function saveRevision(
  contentId: number,
  title: string,
  summary: string | null,
  body: string,
  editorId: number
) {
  const db = getDb();
  db.insert(contentRevisions)
    .values({ contentId, title, summary, body, editorId, createdAt: now() })
    .run();

  // 超出 10 版的旧记录删掉
  const keep = db
    .select({ id: contentRevisions.id })
    .from(contentRevisions)
    .where(eq(contentRevisions.contentId, contentId))
    .orderBy(desc(contentRevisions.createdAt))
    .limit(10)
    .all();

  const keepIds = keep.map((r) => r.id);
  if (keepIds.length > 0) {
    db.delete(contentRevisions)
      .where(
        and(
          eq(contentRevisions.contentId, contentId),
          sql`${contentRevisions.id} NOT IN (${sql.join(keepIds.map((i) => sql`${i}`), sql`, `)})`
        )
      )
      .run();
  }
}

async function handlePOST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await readJson(req);
  if (!body.ok) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const parsed = contentSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "数据格式错误" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const db = getDb();
  let slug = normalizeSlug(d.slug ?? "");
  if (!slug) slug = `post-${Date.now().toString(36)}`;

  if (db.select({ id: contents.id }).from(contents).where(eq(contents.slug, slug)).get()) {
    return NextResponse.json({ error: `URL 别名「${slug}」已被占用，请换一个` }, { status: 400 });
  }

  const t = now();
  const publishedAt = d.status === "published" ? t : null;

  const res = db
    .insert(contents)
    .values({
      type: d.type,
      title: d.title,
      slug,
      summary: d.summary ?? null,
      body: d.body,
      coverImage: d.coverImage ?? null,
      coverThumb: d.coverThumb ?? null,
      categoryId: d.categoryId ?? null,
      status: d.status,
      isFeatured: d.isFeatured ? 1 : 0,
      seoTitle: d.seoTitle ?? null,
      seoDescription: d.seoDescription ?? null,
      authorId: user.id,
      lastEditorId: user.id,
      publishedAt,
      scheduledAt: d.scheduledAt ?? null,
      createdAt: t,
      updatedAt: t,
    })
    .run();

  const id = Number(res.lastInsertRowid);
  syncTags(id, d.tags);
  saveRevision(id, d.title, d.summary ?? null, d.body, user.id);
  audit(user.id, "create", "content", id, d.title);

  return NextResponse.json({ ok: true, id });
}

async function handlePUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await readJson(req);
  if (!body.ok) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const parsed = contentSchema.safeParse(body.data);
  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json(
      { error: parsed.success ? "缺少内容 ID" : parsed.error.issues[0]?.message ?? "数据格式错误" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const id = d.id!;

  const db = getDb();
  const old = db.select().from(contents).where(eq(contents.id, id)).get();
  if (!old || old.deletedAt) {
    return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  }

  let slug = normalizeSlug(d.slug ?? old.slug) || old.slug;

  if (slug !== old.slug) {
    const dup = db
      .select({ id: contents.id })
      .from(contents)
      .where(and(eq(contents.slug, slug), ne(contents.id, id)))
      .get();
    if (dup) {
      return NextResponse.json({ error: `URL 别名「${slug}」已被占用，请换一个` }, { status: 400 });
    }
  }

  const t = now();
  const status = d.status;
  // 首次发布时记录发布时间，之后保持不变（保证 URL 与排序稳定）
  const publishedAt = status === "published" ? old.publishedAt ?? t : old.publishedAt;

  db.update(contents)
    .set({
      title: d.title,
      slug,
      summary: d.summary ?? null,
      body: d.body,
      coverImage: d.coverImage ?? null,
      coverThumb: d.coverThumb ?? null,
      categoryId: d.categoryId ?? null,
      status,
      isFeatured: d.isFeatured ? 1 : 0,
      seoTitle: d.seoTitle ?? null,
      seoDescription: d.seoDescription ?? null,
      lastEditorId: user.id,
      publishedAt,
      scheduledAt: d.scheduledAt ?? null,
      updatedAt: t,
    })
    .where(eq(contents.id, id))
    .run();

  syncTags(id, d.tags);
  saveRevision(id, d.title, d.summary ?? null, d.body, user.id);
  audit(user.id, "update", "content", id, d.title);

  return NextResponse.json({ ok: true, id });
}


// ── 统一错误捕获：异常写入 data/logs，客户端收到中文提示 ──
export const POST = withErrorLogging("POST /api/contents", handlePOST);
export const PUT = withErrorLogging("PUT /api/contents", handlePUT);
