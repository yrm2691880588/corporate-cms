/**
 * 测试用 HTTP 客户端
 *
 * 【为什么用真实 HTTP 而不是直接调函数】
 * 需要验证的是「接口对外的行为」：状态码、Cookie、跳转、权限拦截。
 * 直接调用内部函数测不出这些——比如 307 跳转、HttpOnly Cookie、404 伪装，
 * 只有走真实 HTTP 才能验证。
 *
 * 【为什么用独立端口】
 * 用 3100 而不是 3000：避免和用户正在运行的开发服务冲突。
 */

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";

export type HttpResult = {
  status: number;
  body: any;
  text: string;
  cookies: string[];
  location: string | null;
};

async function request(
  pathname: string,
  init: RequestInit & { cookie?: string } = {}
): Promise<HttpResult> {
  const { cookie, ...rest } = init;

  const headers: Record<string, string> = {
    ...(rest.headers as Record<string, string> | undefined),
  };
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(`${BASE}${pathname}`, {
    ...rest,
    headers,
    redirect: "manual",
  });

  const text = await res.text();
  let body: any = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  return {
    status: res.status,
    body,
    text,
    cookies: res.headers.getSetCookie?.() ?? [],
    location: res.headers.get("location"),
  };
}

export function get(pathname: string, cookie?: string) {
  return request(pathname, { method: "GET", cookie });
}

/**
 * 发送 JSON POST。
 *
 * extraHeaders 主要用于测试限流：不同用例用不同的 x-forwarded-for，
 * 避免共用一个 IP 桶导致互相污染。
 *
 * 注意：项目在不可信环境下不采信 x-forwarded-for（见 lib/client-ip.ts），
 * 所以测试环境所有请求本来共用一个桶。要用 IP 区分，
 * 必须在服务启动时设 TRUST_PROXY=1。
 */
export function postJson(
  pathname: string,
  data: unknown,
  cookie?: string,
  extraHeaders?: Record<string, string>
) {
  return request(pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
    body: JSON.stringify(data),
    cookie,
  });
}

export function putJson(pathname: string, data: unknown, cookie?: string) {
  return request(pathname, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cookie,
  });
}

export function del(pathname: string, cookie?: string) {
  return request(pathname, { method: "DELETE", cookie });
}

export function patch(pathname: string, cookie?: string) {
  return request(pathname, { method: "PATCH", cookie });
}

/** 把 Set-Cookie 数组拼成可直接回传的 Cookie 头 */
export function toCookieHeader(setCookies: string[]): string {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

/** 登录并返回 Cookie 头 */
export async function loginAs(
  username: string,
  password: string
): Promise<string> {
  const res = await postJson("/api/auth/login", { username, password });
  if (res.status !== 200) {
    throw new Error(`登录失败（${username}）：HTTP ${res.status}`);
  }
  return toCookieHeader(res.cookies);
}

export { BASE };
