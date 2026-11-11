/**
 * API 路由包装器 —— 统一捕获异常并记录日志
 *
 * 【为什么需要】
 * 路由里抛出的未捕获异常，Next.js 只会返回 500，
 * 日志里没有业务上下文（哪个接口、什么参数），排查全靠猜。
 *
 * 用这个包装后：
 * - 异常被捕获，写入 data/logs/error-*.log
 * - 客户端收到结构化的中文错误，而不是英文堆栈页
 * - 不泄漏堆栈给客户端（只记在日志里）
 *
 * 用法：
 *   export const POST = withErrorLogging("POST /api/xxx", async (req) => { ... })
 */

import { NextRequest, NextResponse } from "next/server";
import { logError } from "./logger";

type Handler = (req: NextRequest, ctx: any) => Promise<Response> | Response;

export function withErrorLogging(where: string, handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      logError({
        where,
        error: err,
        extra: {
          method: req.method,
          url: req.nextUrl?.pathname,
        },
      });

      // 给客户端结构化错误，不回传堆栈
      return NextResponse.json(
        { error: "服务器处理出错，已记录日志。如果反复出现请联系管理员。" },
        { status: 500 }
      );
    }
  };
}
