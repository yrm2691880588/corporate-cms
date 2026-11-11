/**
 * 认证与会话
 *
 * 方案：账号密码 + HMAC 签名 Cookie 会话（无第三方依赖，无 Redis）。
 * 密码使用 bcrypt 不可逆加密存储。
 *
 * 【换公司】不需要改这里；管理员账号在首次启动时自动创建。
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, now } from "./db";
import { users, auditLogs } from "./schema";
import { hashPassword as _hash, checkPassword } from "./password";

const COOKIE_NAME = "rm_session";
const SESSION_DAYS = 7;

/** 会话签名密钥。首次启动生成并写入 data/secret.key，保证重启后会话不失效。 */
function getSecret(): string {
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "secret.key");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  const secret = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "editor";
};

function sign(payload: string): string {
  const hmac = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

function verify(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expect = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  if (mac.length !== expect.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  return payload;
}

/** 校验账号密码，成功返回用户 */
export function verifyLogin(username: string, password: string): SessionUser | null {
  const db = getDb();
  const row = db.select().from(users).where(eq(users.username, username)).get();

  if (!row || row.status !== "active") return null;
  if (!checkPassword(password, row.passwordHash)) return null;

  db.update(users).set({ lastLoginAt: now() }).where(eq(users.id, row.id)).run();

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role as "admin" | "editor",
  };
}

/** 写入会话 Cookie */
export async function createSession(user: SessionUser) {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const payload = `${user.id}.${user.role}.${exp}`;
  const store = await cookies();
  store.set(COOKIE_NAME, sign(payload), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

/** 读取当前登录用户；未登录返回 null */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verify(token);
  if (!payload) return null;

  const [idStr, , expStr] = payload.split(".");
  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return null;

  const row = getDb()
    .select()
    .from(users)
    .where(eq(users.id, Number(idStr)))
    .get();

  if (!row || row.status !== "active") return null;

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role as "admin" | "editor",
  };
}

/** 清除会话 */
export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** 密码加密（转发到 lib/password，保持既有调用点不变） */
export function hashPassword(plain: string): string {
  return _hash(plain);
}

/** 记录操作日志 */
export function audit(
  userId: number | null,
  action: string,
  targetType?: string,
  targetId?: number,
  detail?: string
) {
  getDb()
    .insert(auditLogs)
    .values({
      userId,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      detail: detail ?? null,
      createdAt: now(),
    })
    .run();
}
