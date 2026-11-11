/**
 * 数据库 Schema —— Drizzle ORM 单一真源
 *
 * 【为什么用 ORM 而不是手写 SQL】
 * - 表结构和字段类型集中在一处，改字段时类型检查能发现所有受影响的地方
 * - 换数据库（二期迁 PostgreSQL）时主要改驱动和少量语法，查询逻辑不用重写
 * - 这是 ADR-0001 明确承诺的约束，避免散落的原生 SQL 造成维护困难
 *
 * 【注意】表结构变更需同步 `lib/db.ts` 中的建表语句（一期用内置迁移），
 * 或改用 drizzle-kit 生成迁移文件。当前规模下保持两者一致即可。
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "editor"] }).notNull(),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  createdAt: text("created_at").notNull(),
  lastLoginAt: text("last_login_at"),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isVisible: integer("is_visible").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const contents = sqliteTable("contents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["article", "product", "page"] }).notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary"),
  body: text("body").notNull().default(""),
  coverImage: text("cover_image"),
  coverThumb: text("cover_thumb"),
  categoryId: integer("category_id"),
  status: text("status", {
    enum: ["draft", "published", "offline", "scheduled"],
  })
    .notNull()
    .default("draft"),
  isFeatured: integer("is_featured").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  authorId: integer("author_id"),
  lastEditorId: integer("last_editor_id"),
  publishedAt: text("published_at"),
  scheduledAt: text("scheduled_at"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const contentTags = sqliteTable("content_tags", {
  contentId: integer("content_id").notNull(),
  tagId: integer("tag_id").notNull(),
});

export const contentRevisions = sqliteTable("content_revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentId: integer("content_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  body: text("body").notNull(),
  editorId: integer("editor_id"),
  createdAt: text("created_at").notNull(),
});

export const media = sqliteTable("media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  thumbPath: text("thumb_path"),
  uploadedBy: integer("uploaded_by"),
  createdAt: text("created_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  content: text("content").notNull(),
  sourceUrl: text("source_url"),
  ipHash: text("ip_hash"),
  isRead: integer("is_read").notNull().default(0),
  isProcessed: integer("is_processed").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
