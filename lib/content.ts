/**
 * 内容查询层 —— 所有读写内容的业务语义集中在这里
 *
 * 全部使用 Drizzle ORM 表达（ADR-0001 的约束：禁止散落的原生 SQL）。
 * 页面与接口只调用这里的函数，不直接接触数据库驱动。
 *
 * 这样二期迁移到 PostgreSQL / Cloudflare D1 时，主要改驱动和少量方言差异，
 * 业务查询可以原样保留。
 */

import { and, asc, count, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { getDb, now } from "./db";
import { contents, categories, tags, contentTags, media, messages, users } from "./schema";
import { alias } from "drizzle-orm/sqlite-core";
import { siteConfig } from "@/config/site.config";
import { sanitizeHtml } from "./sanitize";

export type ContentType = "article" | "product" | "page";
export type ContentStatus = "draft" | "published" | "offline" | "scheduled";

export type Content = {
  id: number;
  type: ContentType;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  coverImage: string | null;
  coverThumb: string | null;
  categoryId: number | null;
  status: ContentStatus;
  isFeatured: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  authorId: number | null;
  authorName: string | null;
  lastEditorName: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  categoryName?: string | null;
  categorySlug?: string | null;
  tags?: { name: string; slug: string }[];
};

type Row = {
  c: typeof contents.$inferSelect;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
  lastEditorName: string | null;
};

function mapRow(r: Row): Content {
  const c = r.c;
  return {
    id: c.id,
    type: c.type as ContentType,
    title: c.title,
    slug: c.slug,
    summary: c.summary,
    // 所有内容读取都经过这里，统一净化，调用方无需再处理
    body: sanitizeHtml(c.body),
    coverImage: c.coverImage,
    coverThumb: c.coverThumb,
    categoryId: c.categoryId,
    status: c.status as ContentStatus,
    isFeatured: c.isFeatured === 1,
    sortOrder: c.sortOrder,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    authorId: c.authorId,
    authorName: r.authorName ?? null,
    lastEditorName: r.lastEditorName ?? null,
    publishedAt: c.publishedAt,
    scheduledAt: c.scheduledAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    categoryName: r.categoryName ?? null,
    categorySlug: r.categorySlug ?? null,
  };
}

/** 内容 + 栏目名的联表查询构造器 */
function baseQuery() {
  const author = alias(users, "author");
  const editor = alias(users, "editor");
  return getDb()
    .select({
      c: contents,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorName: author.displayName,
      lastEditorName: editor.displayName,
    })
    .from(contents)
    .leftJoin(categories, eq(categories.id, contents.categoryId))
    .leftJoin(author, eq(author.id, contents.authorId))
    .leftJoin(editor, eq(editor.id, contents.lastEditorId));
}

/** 前台：按类型取列表（分页） */
export function listPublished(params: {
  type?: ContentType;
  categorySlug?: string;
  /** 是否把子栏目的内容也算进来（父栏目页需要） */
  includeChildren?: boolean;
  page?: number;
  pageSize?: number;
  featuredOnly?: boolean;
  tagSlug?: string;
}): { items: Content[]; total: number; page: number; pageSize: number } {
  const db = getDb();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? siteConfig.pageSize;

  const conds = [eq(contents.status, "published" as const), isNull(contents.deletedAt)];
  if (params.type) conds.push(eq(contents.type, params.type));
  if (params.categorySlug) {
    if (params.includeChildren) {
      // 父栏目页要能看到子栏目里的内容，否则「产品与服务」这种
      // 只挂了子栏目、自身没有直属内容的父栏目，点进去就是空的。
      conds.push(
        sql`${contents.categoryId} IN (
          SELECT c1.id FROM categories c1
          WHERE c1.slug = ${params.categorySlug}
             OR c1.parent_id = (SELECT c2.id FROM categories c2 WHERE c2.slug = ${params.categorySlug})
        )`
      );
    } else {
      conds.push(eq(categories.slug, params.categorySlug));
    }
  }
  if (params.featuredOnly) conds.push(eq(contents.isFeatured, 1));
  if (params.tagSlug) {
    conds.push(
      sql`${contents.id} IN (
        SELECT ct.content_id FROM content_tags ct
        JOIN tags t ON t.id = ct.tag_id
        WHERE t.slug = ${params.tagSlug}
      )`
    );
  }
  const where = and(...conds);

  const total = Number(
    db
      .select({ n: count() })
      .from(contents)
      .leftJoin(categories, eq(categories.id, contents.categoryId))
      .where(where)
      .get()?.n ?? 0
  );

  const rows = db
    .select({
      c: contents,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(contents)
    .leftJoin(categories, eq(categories.id, contents.categoryId))
    .where(where)
    .orderBy(
      desc(contents.isFeatured),
      desc(sql`COALESCE(${contents.publishedAt}, ${contents.createdAt})`)
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all() as Row[];

  return { items: rows.map(mapRow), total, page, pageSize };
}

/** 前台：按 slug 取单篇（只返回已发布） */
export function getPublishedBySlug(slug: string): Content | null {
  const row = baseQuery()
    .where(
      and(
        eq(contents.slug, slug),
        eq(contents.status, "published" as const),
        isNull(contents.deletedAt)
      )
    )
    .get() as Row | undefined;

  if (!row) return null;
  const content = mapRow(row);
  content.tags = getTags(content.id);
  return content;
}

/** 前台：取单页 */
export function getPageBySlug(slug: string): Content | null {
  const row = baseQuery()
    .where(
      and(
        eq(contents.slug, slug),
        eq(contents.type, "page" as const),
        eq(contents.status, "published" as const),
        isNull(contents.deletedAt)
      )
    )
    .get() as Row | undefined;

  return row ? mapRow(row) : null;
}

/** 后台：按 ID 取（含草稿） */
export function getById(id: number): Content | null {
  const row = baseQuery().where(eq(contents.id, id)).get() as Row | undefined;
  if (!row) return null;
  const content = mapRow(row);
  content.tags = getTags(content.id);
  return content;
}

/** 后台：列表（含草稿、可筛选） */
export function listForAdmin(params: {
  type?: ContentType;
  status?: ContentStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): { items: Content[]; total: number; page: number; pageSize: number } {
  const db = getDb();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 20;

  const conds = [isNull(contents.deletedAt)];
  if (params.type) conds.push(eq(contents.type, params.type));
  if (params.status) conds.push(eq(contents.status, params.status));
  if (params.keyword) {
    const kw = `%${params.keyword}%`;
    const kwCond = or(like(contents.title, kw), like(contents.summary, kw));
    if (kwCond) conds.push(kwCond);
  }
  const where = and(...conds);

  const total = Number(
    db.select({ n: count() }).from(contents).where(where).get()?.n ?? 0
  );

  const rows = db
    .select({
      c: contents,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(contents)
    .leftJoin(categories, eq(categories.id, contents.categoryId))
    .where(where)
    .orderBy(desc(contents.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all() as Row[];

  return { items: rows.map(mapRow), total, page, pageSize };
}

/** 标签 */
export function getTags(contentId: number): { name: string; slug: string }[] {
  return getDb()
    .select({ name: tags.name, slug: tags.slug })
    .from(tags)
    .innerJoin(contentTags, eq(contentTags.tagId, tags.id))
    .where(eq(contentTags.contentId, contentId))
    .orderBy(asc(tags.name))
    .all();
}

/** 按 slug 取标签 */
export function getTagBySlug(slug: string) {
  return getDb().select().from(tags).where(eq(tags.slug, slug)).get();
}

/** 栏目列表 */
export function listCategories(includeHidden = false) {
  const db = getDb();
  const base = db.select().from(categories).$dynamic();
  const q = includeHidden ? base : base.where(eq(categories.isVisible, 1));
  return q.orderBy(asc(categories.sortOrder), asc(categories.id)).all();
}

export function getCategoryBySlug(slug: string) {
  return getDb().select().from(categories).where(eq(categories.slug, slug)).get();
}

/** 定时发布：把到点的 scheduled 转为 published */
export function publishScheduledDue(): number {
  const db = getDb();
  const t = now();
  const res = db
    .update(contents)
    .set({ status: "published" as const, publishedAt: t, updatedAt: t })
    .where(
      and(
        eq(contents.status, "scheduled" as const),
        sql`${contents.scheduledAt} IS NOT NULL AND ${contents.scheduledAt} <= ${t}`,
        isNull(contents.deletedAt)
      )
    )
    .run();
  return Number(res.changes ?? 0);
}

/** 统计（后台首页用） */
export function getStats() {
  const db = getDb();
  const contentCount = (cond: ReturnType<typeof and>) =>
    Number(db.select({ n: count() }).from(contents).where(cond).get()?.n ?? 0);

  return {
    published: contentCount(and(eq(contents.status, "published" as const), isNull(contents.deletedAt))),
    drafts: contentCount(and(eq(contents.status, "draft" as const), isNull(contents.deletedAt))),
    unreadMessages: Number(
      db.select({ n: count() }).from(messages).where(eq(messages.isRead, 0)).get()?.n ?? 0
    ),
    mediaCount: Number(db.select({ n: count() }).from(media).get()?.n ?? 0),
  };
}
