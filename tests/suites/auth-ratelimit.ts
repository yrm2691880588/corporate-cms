/**
 * 登录限流测试
 *
 * 验证两个维度都生效：
 * - 账号维度：同一账号连续失败 5 次后锁定（防单账号暴力破解）
 * - IP 维度：同一 IP 连续失败 20 次后锁定（防撞库喷洒）
 *
 * 【关键：每个用例必须用独立 IP】
 * 限流状态存在内存里，且测试环境开启了 TRUST_PROXY（让 x-forwarded-for 生效）。
 * 如果所有用例共用一个 IP，前面用例的失败次数会累加，
 * 20 次 IP 限额很快被打满，后面所有登录请求都会返回 429——
 * 那是测试互相污染，不是功能缺陷。
 *
 * 所以每个用例用自己的 x-forwarded-for。
 */

import { test, assert, assertEqual } from "../helpers/framework";
import { postJson } from "../helpers/http";
import { TEST_ADMIN } from "../helpers/accounts";

/** 生成一个独立的测试 IP 头，避免用例之间互相污染 */
function testIp(ip: string): Record<string, string> {
  return { "x-forwarded-for": ip };
}

test("登录限流：同账号连续 5 次失败后被锁", async () => {
  const username = `ratelimit-${Date.now()}`;
  const ip = testIp("203.0.113.1");
  const statuses: number[] = [];

  for (let i = 0; i < 6; i++) {
    const res = await postJson(
      "/api/auth/login",
      { username, password: "wrong-password-attempt" },
      undefined,
      ip
    );
    statuses.push(res.status);
  }

  // 前 5 次应是 401（账号不存在），第 6 次应是 429（被锁）
  assert(
    statuses.slice(0, 5).every((s) => s === 401),
    `前 5 次应为 401，实际：${statuses.join(",")}`
  );
  assertEqual(statuses[5], 429, "第 6 次应被锁定（429）");
});

test("登录限流：账号锁定后，正确密码也进不去", async () => {
  const username = `ratelimit-lock-${Date.now()}`;
  const ip = testIp("203.0.113.2");

  for (let i = 0; i < 5; i++) {
    await postJson("/api/auth/login", { username, password: "wrong" }, undefined, ip);
  }

  // 即使用正确密码也应被锁（防止攻击者靠猜中密码绕过限流）
  const res = await postJson(
    "/api/auth/login",
    { username, password: TEST_ADMIN.password },
    undefined,
    ip
  );
  assertEqual(res.status, 429, "锁定期间即使密码正确也应拒绝");
});

test("登录限流：不同账号互不影响（账号维度独立）", async () => {
  const userA = `ratelimit-a-${Date.now()}`;
  const userB = `ratelimit-b-${Date.now()}`;
  // 两个不同 IP，确保只考察账号维度
  const ipA = testIp("203.0.113.3");
  const ipB = testIp("203.0.113.4");

  for (let i = 0; i < 5; i++) {
    await postJson("/api/auth/login", { username: userA, password: "wrong" }, undefined, ipA);
  }
  const blockedA = await postJson(
    "/api/auth/login",
    { username: userA, password: "wrong" },
    undefined,
    ipA
  );
  assertEqual(blockedA.status, 429, "A 应已被锁定");

  // B 用独立 IP、独立账号，应该是第一次失败
  const firstB = await postJson(
    "/api/auth/login",
    { username: userB, password: "wrong" },
    undefined,
    ipB
  );
  assertEqual(firstB.status, 401, "B 未被锁定前应是 401，说明账号维度互不影响");
});

test("登录限流：IP 维度拦住换账号撞库", async () => {
  // 攻击者换 25 个用户名试同一个密码，每个账号只错 1 次，
  // 账号维度永远触发不了 —— 必须靠 IP 维度拦住。
  const ip = testIp("203.0.113.5");
  const statuses: number[] = [];

  for (let i = 0; i < 25; i++) {
    const res = await postJson(
      "/api/auth/login",
      { username: `spray-${Date.now()}-${i}`, password: "common-weak-password" },
      undefined,
      ip
    );
    statuses.push(res.status);
  }

  // 前 20 次是 401，第 21 次起应被 IP 维度锁定为 429
  assert(
    statuses.slice(0, 20).every((s) => s === 401),
    `前 20 次应为 401，实际：${statuses.slice(0, 20).join(",")}`
  );
  assertEqual(statuses[20], 429, "第 21 次应被 IP 维度锁定");
});

test("登录限流：正常登录不受影响", async () => {
  const res = await postJson(
    "/api/auth/login",
    { username: TEST_ADMIN.username, password: TEST_ADMIN.password },
    undefined,
    testIp("203.0.113.6")
  );
  assertEqual(res.status, 200, "正常登录应成功");
});

test("登录限流：攻击者无法跨 IP 锁死管理员账号", async () => {
  // 【这是修「恶意锁号」的核心验证】
  // 攻击者从 IP-A 故意输错 5 次，想把 admin 锁住。
  // 账号维度的键是「IP+账号」，所以只锁住 IP-A 与 admin 的组合。
  // 真实用户从 IP-B 用正确密码登录，必须仍然成功。
  const attackerIp = testIp("203.0.113.7");
  const realUserIp = testIp("203.0.113.8");

  // 攻击者打满 5 次
  for (let i = 0; i < 5; i++) {
    await postJson(
      "/api/auth/login",
      { username: TEST_ADMIN.username, password: "attacker-guess" },
      undefined,
      attackerIp
    );
  }

  // 攻击者自己被锁（拿不到进一步猜测机会）
  const attackerTry = await postJson(
    "/api/auth/login",
    { username: TEST_ADMIN.username, password: TEST_ADMIN.password },
    undefined,
    attackerIp
  );
  assertEqual(attackerTry.status, 429, "攻击者自己的 IP 应被锁");

  // 真实用户从另一个 IP 登录，必须成功 —— 这是「恶意锁号」已修复的证据
  const realUser = await postJson(
    "/api/auth/login",
    { username: TEST_ADMIN.username, password: TEST_ADMIN.password },
    undefined,
    realUserIp
  );
  assertEqual(
    realUser.status,
    200,
    "真实用户从其他 IP 应能正常登录（攻击者不应能锁死账号）"
  );
});
