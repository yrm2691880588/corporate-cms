/**
 * 定时发布测试（需求 C-07）
 *
 * 【此前完全没有覆盖】
 * 定时发布功能的测试覆盖。
 * 这条链路最容易出错的地方是「到点到底会不会自动上线」——
 * 之前还有个 bug：调度器挂在页面渲染上，没人访问就永远不发布。
 *
 * 【怎么测才真实】
 * 不加 /api/test/publish-now 之类的后门——那样测的就不是真实行为。
 * 而是：
 * 1. 测试环境把 SCHEDULER_INTERVAL_MS 调到 1 秒（见 tests/run.ts）
 * 2. 建一条「3 秒后发布」的定时内容
 * 3. 轮询前台，等它自己出现
 * 这样验证的是真实的定时器 + 真实的数据库更新。
 */

import { test, assert, assertEqual } from "../helpers/framework";
import { get, postJson, putJson, del, loginAs } from "../helpers/http";
import { TEST_ADMIN } from "../helpers/accounts";

/** 等待某个条件成立，超时返回 false */
async function waitFor(
  check: () => Promise<boolean>,
  timeoutMs = 15000,
  intervalMs = 500
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

test("定时发布：到点后自动上线", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const stamp = Date.now();
  const slug = `e2e-sched-${stamp}`;

  // 3 秒后发布
  const publishAt = new Date(Date.now() + 3000).toISOString();

  const created = await postJson(
    "/api/contents",
    {
      type: "article",
      title: "E2E 定时发布",
      slug,
      body: "<p>定时内容</p>",
      status: "scheduled",
      scheduledAt: publishAt,
    },
    cookie
  );
  assertEqual(created.status, 200, "创建定时内容应成功");
  const id = created.body?.id;

  // 到点前：前台不可见
  const beforeFront = await get(`/news/${slug}`);
  assertEqual(beforeFront.status, 404, "到点前不应在前台可见");

  // 等调度器自动发布（间隔 1 秒，给 15 秒余量）
  const appeared = await waitFor(async () => {
    const res = await get(`/news/${slug}`);
    return res.status === 200;
  }, 15000);

  assert(appeared, "到点后应在 15 秒内自动上线（调度器未生效？）");

  await del(`/api/contents/${id}`, cookie);
});

test("定时发布：改回草稿后不会自动上线", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const stamp = Date.now();
  const slug = `e2e-sched-cancel-${stamp}`;

  // 10 秒后发布，然后立刻改回草稿
  const publishAt = new Date(Date.now() + 10000).toISOString();

  const created = await postJson(
    "/api/contents",
    {
      type: "article",
      title: "E2E 取消定时",
      slug,
      body: "<p>x</p>",
      status: "scheduled",
      scheduledAt: publishAt,
    },
    cookie
  );
  const id = created.body?.id;

  // 改成草稿，清掉 scheduledAt
  const toDraft = await putJson(
    "/api/contents",
    { id, type: "article", title: "E2E 取消定时", slug, body: "<p>x</p>", status: "draft", scheduledAt: null },
    cookie
  );
  assertEqual(toDraft.status, 200, "改回草稿应成功");

  // 等 12 秒（超过原定发布时间），确认没有自动上线
  await new Promise((r) => setTimeout(r, 12000));

  const front = await get(`/news/${slug}`);
  assertEqual(front.status, 404, "已取消定时的内容不应自动上线");

  await del(`/api/contents/${id}`, cookie);
});

test("定时发布：未来时间的内容不会提前上线", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const stamp = Date.now();
  const slug = `e2e-sched-future-${stamp}`;

  // 1 小时后发布
  const publishAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const created = await postJson(
    "/api/contents",
    {
      type: "article",
      title: "E2E 未来定时",
      slug,
      body: "<p>x</p>",
      status: "scheduled",
      scheduledAt: publishAt,
    },
    cookie
  );
  const id = created.body?.id;

  // 等 3 秒（调度器已跑几轮），确认仍未上线
  await new Promise((r) => setTimeout(r, 3000));

  const front = await get(`/news/${slug}`);
  assertEqual(front.status, 404, "未到时间的内容不应上线");

  await del(`/api/contents/${id}`, cookie);
});
