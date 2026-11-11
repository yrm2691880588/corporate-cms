/**
 * 数据库连接
 *
 * 驱动：better-sqlite3（Drizzle ORM 官方支持的同步驱动）
 * 数据文件：data/site.db（单文件，备份=复制此文件）
 *
 * 【两种使用方式并存】
 * - `db`      ：Drizzle ORM 实例。业务查询优先用它，类型安全、换库友好。
 * - `getRawDb()`：底层 better-sqlite3 实例，仅用于少数 ORM 表达不便的场合
 *                （如动态 where 拼接、PRAGMA、建表迁移）。
 *
 * 【换公司】不需要改这里。清空 data/ 目录后重启即可重建。
 *
 * 【测试隔离】用环境变量 DATABASE_PATH 指向另一份库文件，
 * 验收测试就能完全跑在副本上，不碰真实数据。
 * 目的：避免测试过程中的清理操作影响到真实数据。
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * 数据库文件路径。
 *
 * 默认 data/site.db；设置环境变量 DATABASE_PATH 时改用指定路径
 * （相对路径按项目根解析，绝对路径直接使用）。
 * 测试脚本应始终指向副本，绝不要指向真实库。
 */
function resolveDbPath(): string {
  const custom = process.env.DATABASE_PATH?.trim();
  if (!custom) return path.join(DATA_DIR, "site.db");
  return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
}

const DB_PATH = resolveDbPath();

/** 当前使用的数据库路径（供日志与诊断用，也便于测试断言） */
export function getDbPath(): string {
  return DB_PATH;
}

/** 是否正在使用非默认数据库（测试模式） */
export function isTestDatabase(): boolean {
  return Boolean(process.env.DATABASE_PATH?.trim());
}

type RawDb = InstanceType<typeof Database>;

let _raw: RawDb | null = null;
let _orm: ReturnType<typeof drizzle<typeof schema>> | null = null;

function init(): RawDb {
  if (_raw) return _raw;

  // 数据目录与数据库所在目录都要存在。
  // 自定义 DATABASE_PATH 可能指向 data/ 之外，所以要单独建它的父目录。
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const raw = new Database(DB_PATH);

  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  raw.pragma("busy_timeout = 5000");

  migrate(raw);
  _raw = raw;
  return raw;
}

/** Drizzle 实例 —— 业务查询首选 */
export function getDb() {
  init();
  if (!_orm) {
    _orm = drizzle(_raw!, { schema });
  }
  return _orm;
}

/**
 * 底层驱动实例 —— 仅用于迁移、PRAGMA、以及动态拼接 where 的场景。
 *
 * 约定：新增业务查询应写在 lib/content.ts 等 owner 层并优先使用 Drizzle；
 * 只有确实难以表达时才用这里，并在注释里说明原因。
 */
export function getRawDb(): RawDb {
  return init();
}

/**
 * 建表（幂等）。
 *
 * 与 lib/schema.ts 保持一致。表结构变更时两处同步修改。
 */
function migrate(raw: RawDb) {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name  TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('admin','editor')),
      status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
      created_at    TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id   INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      description TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      is_visible  INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contents (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      type           TEXT NOT NULL CHECK (type IN ('article','product','page')),
      title          TEXT NOT NULL,
      slug           TEXT NOT NULL UNIQUE,
      summary        TEXT,
      body           TEXT NOT NULL DEFAULT '',
      cover_image    TEXT,
      cover_thumb    TEXT,
      category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      status         TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','published','offline','scheduled')),
      is_featured    INTEGER NOT NULL DEFAULT 0,
      sort_order     INTEGER NOT NULL DEFAULT 0,
      seo_title      TEXT,
      seo_description TEXT,
      author_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      last_editor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      published_at   TEXT,
      scheduled_at   TEXT,
      deleted_at     TEXT,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contents_type_status ON contents(type, status);
    CREATE INDEX IF NOT EXISTS idx_contents_category ON contents(category_id);
    CREATE INDEX IF NOT EXISTS idx_contents_published ON contents(published_at DESC);

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS content_tags (
      content_id INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (content_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS content_revisions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      content_id INTEGER NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      summary    TEXT,
      body       TEXT NOT NULL,
      editor_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_revisions_content ON content_revisions(content_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS media (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      filename      TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type     TEXT NOT NULL,
      size_bytes    INTEGER NOT NULL,
      width         INTEGER,
      height        INTEGER,
      thumb_path    TEXT,
      uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      contact    TEXT NOT NULL,
      content    TEXT NOT NULL,
      source_url TEXT,
      ip_hash    TEXT,
      is_read    INTEGER NOT NULL DEFAULT 0,
      is_processed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(is_read, created_at DESC);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action      TEXT NOT NULL,
      target_type TEXT,
      target_id   INTEGER,
      detail      TEXT,
      created_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/** 当前时间（ISO 字符串） */
export function now(): string {
  return new Date().toISOString();
}

