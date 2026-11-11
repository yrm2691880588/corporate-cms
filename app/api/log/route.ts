import { NextRequest, NextResponse } from "next/server";
import { readJson } from "@/lib/http";
import { logError } from "@/lib/logger";
import { getClientKey } from "@/lib/client-ip";

/**
 * 客户端错误上报
 *
 * 浏览器没有文件系统权限，所以错误统一上报到这里写盘。
 * 不需要登录 —— 访客遇到的错误同样需要记录。
 *
 * 【为什么必须限流】
 * 这个接口不需要登录，等于谁都能往日志文件里写东西。
 * 不设上限的话，被刷几千条就能：
 * - 撑大日志文件，把有用信息淹没
 * - 触发 5MB 轮转，把历史日志挤掉
 * - 白白消耗磁盘
 *
 * 限流策略：同 IP 每分钟最多 10 条，超出的直接丢弃（返回成功，避免被探测）。
 */

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;

/** 简单的内存限流：同进程内按 IP 计数，过期自动清理 */
const buckets = new Map<string, { count: number; resetAt: number }>();

/** 防止 Map 被大量伪造 IP 撑爆 */
const MAX_ENTRIES = 2000;

/** 返回 true 表示允许写入，false 表示超限 */
function allow(key: string): boolean {
  const now = Date.now();

  if (buckets.size >= MAX_ENTRIES) {
    // 先清已过期的
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k);
    }
    /**
     * 仍然装满时，淘汰**最早插入的**若干条（Map 保持插入顺序）。
     *
     * 不能用 buckets.clear()：那会把所有桶（包括攻击者自己的）一起重置，
     * 攻击者只要刷满 2000 条就能立刻恢复自己的配额，限流形同虚设。
     * 淘汰最旧的则只会影响早已不活跃的旧 IP。
     */
    if (buckets.size >= MAX_ENTRIES) {
      const toEvict = Math.ceil(MAX_ENTRIES * 0.1);
      let i = 0;
      for (const k of buckets.keys()) {
        if (i >= toEvict) break;
        buckets.delete(k);
        i += 1;
      }
    }
  }

  const rec = buckets.get(key);
  if (!rec || now > rec.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (rec.count >= MAX_PER_WINDOW) return false;
  rec.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (!body.ok) return NextResponse.json({ ok: false }, { status: 400 });

  const b = body.data as any;
  const message = String(b?.message ?? "").slice(0, 1000);
  if (!message) return NextResponse.json({ ok: true });

  // 超限直接返回成功：不告诉对方"你被限流了"，避免被用来探测阈值
  if (!allow(getClientKey(req))) {
    return NextResponse.json({ ok: true });
  }

  logError({
    where: `客户端 ${String(b?.where ?? "").slice(0, 100)}`,
    error: { name: "ClientError", message, stack: String(b?.stack ?? "").slice(0, 2000) },
    extra: {
      path: String(b?.path ?? "").slice(0, 200),
      digest: String(b?.digest ?? "").slice(0, 100),
    },
  });

  return NextResponse.json({ ok: true });
}
