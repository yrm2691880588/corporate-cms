/**
 * 请求体解析助手
 *
 * 【为什么需要】
 * 各处路由原先一半用 try/catch 包 req.json()、一半没有，
 * 导致同一个错误（客户端发了坏 JSON）有时返回 400、有时返回 500。
 * 这里统一成一个行为：解析失败就是 400。
 */

export type JsonResult = { ok: true; data: unknown } | { ok: false };

export async function readJson(req: Request): Promise<JsonResult> {
  try {
    const data = await req.json();
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}
