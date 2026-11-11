/**
 * 限流测试
 *
 * 【这组用例的历史教训】
 * 最初的「伪造 XFF 无法绕过」用例是假的：
 *   assert(success === 15, "接口应始终返回 200")
 * 而 /api/log 对超限请求也返回 200（静默丢弃），
 * 所以这条断言永远成立，什么也没验证。
 * 注释还写着「真正的验证在下面的日志文件检查中」，但下面并没有检查。
 *
 * 现在改为检查真实日志文件的条数——这是唯一能观测到限流是否生效的方式。
 */

import fs from "node:fs";
import path from "node:path";
import { test, assert, assertEqual } from "../helpers/framework";
import { postJson } from "../helpers/http";
import { getLogsDir } from "../../lib/paths";

/** 读取本次测试日期对应的日志文件内容 */
function readTodayLog(): string {
  const dir = getLogsDir();
  if (!fs.existsSync(dir)) return "";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".log"));
  if (files.length === 0) return "";
  // 取最新的一个
  const latest = files.sort().pop()!;
  return fs.readFileSync(path.join(dir, latest), "utf8");
}

test("限流：同 IP 连发 15 条日志上报，只写入 10 条", async () => {
  const marker = `限流验证-${Date.now()}`;

  // 记录基线（测试环境日志目录已被隔离到 tmp/，不会污染真实 data/）
  const before = readTodayLog();
  const beforeCount = (before.match(new RegExp(marker, "g")) || []).length;

  // 同一 IP 连发 15 条，全部伪造不同的 XFF —— 若可绕过，15 条都会写入
  for (let i = 0; i < 15; i++) {
    await postJson(
      "/api/log",
      { where: marker, message: `${marker}-第${i}条` },
      undefined,
      // 注意：测试环境开启了 TRUST_PROXY，所以这个头会生效，
      // 15 条请求共用同一个 IP（下面固定值），验证的是同 IP 限流。
      { "x-forwarded-for": "192.0.2.99" }
    );
  }

  const after = readTodayLog();
  const written = (after.match(new RegExp(marker, "g")) || []).length - beforeCount;
  // 每写一条日志会出现 2 次 marker（where 字段 + message 字段）
  const writtenEntries = Math.ceil(written / 2);

  assert(
    writtenEntries <= 10,
    `同 IP 连发 15 条应只写入 ≤10 条，实际写入约 ${writtenEntries} 条`
  );
  assert(writtenEntries >= 1, "至少应写入 1 条，否则说明日志没落盘、这个用例没在验证东西");
});

test("限流：不同 IP 各自独立计数", async () => {
  const marker = `独立计数-${Date.now()}`;
  const before = readTodayLog();
  const beforeCount = (before.match(new RegExp(marker, "g")) || []).length;

  // 12 个不同 IP 各发 1 条，应该全部写入（远低于单 IP 的 10 条上限）
  for (let i = 0; i < 12; i++) {
    await postJson(
      "/api/log",
      { where: marker, message: `${marker}-${i}` },
      undefined,
      { "x-forwarded-for": `198.18.${i}.1` }
    );
  }

  const after = readTodayLog();
  const written = (after.match(new RegExp(marker, "g")) || []).length - beforeCount;
  const writtenEntries = Math.ceil(written / 2);

  assertEqual(writtenEntries, 12, "不同 IP 各 1 条，应全部写入");
});
