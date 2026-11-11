import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

/**
 * 后台访问口令换取入口
 *
 * 【为什么单独一个路由】
 * Next.js 15 不允许在 Server Component 渲染期间设置 Cookie
 * （只有 Route Handler / Server Action 可以）。
 * 在登录页里调 cookies().set() 会抛错，被 catch 吞掉后表现为
 * 「带正确口令也进不去」——这正是第一版的 bug。
 *
 * 【用法】
 *   /api/admin-gate?token=你的口令&next=/admin
 *
 * 校验通过 → 写 httpOnly Cookie → 302 跳到目标页
 * 校验失败 → 404（伪装成不存在，不告诉扫描器这里有东西）
 */

const COOKIE_NAME = "admin_gate";

/**
 * 把 next 参数规范化成安全的站内路径。
 *
 * 【为什么不能只用 startsWith 判断】
 * 实测这三种都能绕过朴素校验并跳到外站：
 *   //evil.com      → 协议相对 URL
 *   https://evil.com → 绝对 URL
 *   /\evil.com      → 反斜杠被 URL 解析器规范化成 /
 *   /\t/evil.com    → 制表符同样被吃掉
 *
 * 可靠做法：用 URL 解析出真实 origin，与当前站不同就丢弃。
 * 解析后再确认路径以 / 开头，杜绝任何跳出去的可能。
 */
function safeRedirectPath(next: string | null, req: NextRequest): string {
  const fallback = "/admin";
  if (!next) return fallback;

  // 先按站内相对路径解析。若 next 是绝对 URL 或协议相对 URL，
  // 解析结果的 origin 会与当前站不同。
  let parsed: URL;
  try {
    parsed = new URL(next, req.nextUrl.origin);
  } catch {
    return fallback;
  }

  if (parsed.origin !== req.nextUrl.origin) return fallback;

  // 只接受站内绝对路径，且不接受 // 开头（防协议相对）
  if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
    return fallback;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_GATE_TOKEN?.trim();

  // next 参数在任何分支下都要先规范化，否则未启用口令时就是一个开放重定向
  const target = safeRedirectPath(req.nextUrl.searchParams.get("next"), req);

  // 口令未启用（或配置不合法）：直接跳目标页，不写 Cookie
  if (!expected || expected.length < 8) {
    return NextResponse.redirect(new URL(target, req.nextUrl.origin));
  }

  const token = req.nextUrl.searchParams.get("token")?.trim() || "";

  // 恒定时间比较，避免通过响应时间推断口令
  if (!timingSafeEqualStr(token, expected)) {
    // 口令不对：伪装成路径不存在
    return new NextResponse("Not Found", { status: 404 });
  }

  const res = NextResponse.redirect(new URL(target, req.nextUrl.origin));
  res.cookies.set(COOKIE_NAME, expected, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 天
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

/**
 * 恒定时间字符串比较。
 *
 * 普通的 === 会在第一个不同字符处短路，理论上可通过响应时间差异
 * 逐位推断出口令。口令是 30 天有效的长期凭证，值得用这个更稳的比较。
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // 长度不同直接失败（crypto.timingSafeEqual 要求等长）
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
