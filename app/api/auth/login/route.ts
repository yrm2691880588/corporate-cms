import { NextRequest, NextResponse } from "next/server";
import { verifyLogin, createSession, audit } from "@/lib/auth";
import { getClientKey } from "@/lib/client-ip";

/**
 * 密码最小长度 —— 与修改密码接口（app/api/profile/password）保持一致。
 * 两处阈值不同会让用户困惑：这里说弱，那里说可以。
 */
const MIN_PASSWORD_LENGTH = 8;

/** 内置示例账号的密码，登录时提示用户尽快更换 */
const WEAK_PASSWORDS = new Set(["admin12345", "editor12345", "12345678", "password"]);

/**
 * 判断密码是否偏弱，用于登录后提示。
 *
 * 基于用户刚输入的明文判断，不读数据库。
 * 标准：命中示例密码 / 短于最小长度 / 纯字母 / 纯数字。
 */
function isWeakPassword(password: string): boolean {
  return (
    WEAK_PASSWORDS.has(password) ||
    password.length < MIN_PASSWORD_LENGTH ||
    /^[a-zA-Z]+$/.test(password) ||
    /^\d+$/.test(password)
  );
}

/** 登录失败限流：同一账号 15 分钟内最多失败 5 次 */
const attempts = new Map<string, { count: number; resetAt: number }>();

// 防止被用户名扫号撑爆内存：超过阈值时清掉已过期的记录
const MAX_ENTRIES = 5000;
function pruneIfNeeded() {
  if (attempts.size < MAX_ENTRIES) return;
  const now = Date.now();

  // 第一轮：清掉已过期的（这些已经不起保护作用，删了无害）
  for (const [k, v] of attempts) {
    if (now > v.resetAt) attempts.delete(k);
  }

  /**
   * 第二轮：仍然超限时淘汰「最快到期」的 10%。
   *
   * 【为什么不按插入顺序淘汰】
   * 每个失败请求写两条键，5000 上限约 2500 次失败就触发。
   * 按插入顺序取最旧的，可能把「刚建立、还要锁 15 分钟」的键删掉——
   * 攻击者刷满容量就能让自己的锁定失效。
   *
   * 改为按剩余时间排序、先淘汰快过期的：那些本来也快失效了，
   * 删掉对保护效果影响最小，也不会误伤正在生效的锁定。
   */
  if (attempts.size >= MAX_ENTRIES) {
    const toEvict = Math.ceil(MAX_ENTRIES * 0.1);
    const sorted = [...attempts.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < toEvict && i < sorted.length; i++) {
      attempts.delete(sorted[i][0]);
    }
  }
}
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * 两个维度的限流键。
 *
 * 【为什么必须两个维度都限】
 * 只按账号限（原实现）有两个漏洞：
 * 1. 撞库喷洒：攻击者用 1000 个用户名试同一个弱密码，每个账号只错 1 次，
 *    永远触发不了「同一账号 5 次」的阈值。
 * 2. 恶意锁号：知道你的账号名，故意输错 5 次就能把你锁 15 分钟。
 *
 * 只按 IP 限也不够：同一 IP 可能是公司/学校的 NAT 出口，
 * 一个坏人会让整栋楼都登不进来。
 *
 * 【账号维度的键包含 IP，这是修「恶意锁号」的关键】
 * 如果账号维度只按用户名计数，攻击者从任意 IP 失败 5 次就能锁死该账号，
 * 而真实用户从另一个 IP 登录时会被一起拒掉。
 * 把 IP 拼进账号键后：攻击者只能锁住「他自己那个 IP + 该账号」的组合，
 * 真实用户从自己的 IP 登录不受影响。代价是同一账号的暴力破解可以
 * 分散到多个 IP 绕过——这一层由 IP 维度（20 次/15 分钟）兜住。
 *
 * 最终阈值：
 * - 账号+IP 组合：5 次 / 15 分钟（防单点暴力破解）
 * - 单一 IP 全部账号：20 次 / 15 分钟（防撞库喷洒）
 */
const IP_WINDOW_MS = 15 * 60 * 1000;
const MAX_IP_ATTEMPTS = 20;

/** 键前缀区分两个维度，避免同名冲突 */
const ipKey = (ip: string) => `ip:${ip}`;
/** 账号维度必须绑定 IP，否则攻击者能跨 IP 锁死账号 */
const acctIpKey = (username: string, ip: string) => `ua:${ip}:${username}`;

function checkKey(key: string, max: number): { blocked: boolean; retryAfter: number } {
  const rec = attempts.get(key);
  if (!rec) return { blocked: false, retryAfter: 0 };
  if (Date.now() > rec.resetAt) {
    attempts.delete(key);
    return { blocked: false, retryAfter: 0 };
  }
  if (rec.count >= max) {
    return { blocked: true, retryAfter: Math.ceil((rec.resetAt - Date.now()) / 1000) };
  }
  return { blocked: false, retryAfter: 0 };
}

function recordFailure(key: string, windowMs: number) {
  pruneIfNeeded();
  const rec = attempts.get(key);
  if (!rec || Date.now() > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: Date.now() + windowMs });
  } else {
    rec.count += 1;
  }
}

/**
 * 登录成功后清掉「该 IP 上该账号」的失败计数。
 *
 * IP 维度的总计数保留 —— 否则攻击者只要偶尔用正确密码登录一次，
 * 就能把自己的 IP 配额清零，撞库喷洒又不受限了。
 */
function clearAccountFailures(username: string, ip: string) {
  attempts.delete(acctIpKey(username, ip));
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!username || !password) {
    return NextResponse.json({ error: "请输入账号和密码" }, { status: 400 });
  }

  // 两个维度分别检查，任一超限即拒绝
  const ip = getClientKey(req);
  const acctBlock = checkKey(acctIpKey(username, ip), MAX_ATTEMPTS);
  const ipBlock = checkKey(ipKey(ip), MAX_IP_ATTEMPTS);

  if (acctBlock.blocked || ipBlock.blocked) {
    const retryAfter = Math.max(acctBlock.retryAfter, ipBlock.retryAfter);
    return NextResponse.json(
      { error: `登录失败次数过多，请 ${Math.ceil(retryAfter / 60)} 分钟后再试` },
      { status: 429 }
    );
  }

  const user = verifyLogin(username, password);
  if (!user) {
    recordFailure(acctIpKey(username, ip), WINDOW_MS);
    recordFailure(ipKey(ip), IP_WINDOW_MS);
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  }

  clearAccountFailures(username, ip);
  await createSession(user);
  audit(user.id, "login", "user", user.id);

  return NextResponse.json({
    ok: true,
    role: user.role,
    weakPassword: isWeakPassword(password),
  });
}
