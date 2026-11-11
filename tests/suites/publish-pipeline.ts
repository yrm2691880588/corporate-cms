/**
 * 内容发布链路测试
 *
 * 【为什么单独一个文件】
 * 审查指出：原来的「发布」测试并不是一条链路 ——
 * 一个是「建草稿后删掉」，另一个是「直接建 published」，
 * 两个独立终态的验证，从未测过「草稿 → 发布」这个跃迁。
 * 而需求原文要的就是「发布」这条链路。
 *
 * 这里补的是完整跃迁：
 *   创建草稿 → 前台不可见 → 改成发布 → 前台可见 → 下线 → 前台消失
 */

import { test, assert, assertEqual, assertIncludes, assertExcludes } from "../helpers/framework";
import { get, postJson, putJson, del, loginAs } from "../helpers/http";
import { TEST_ADMIN } from "../helpers/accounts";

test("发布链路：草稿 → 发布 → 前台可见 → 下线 → 消失", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const stamp = Date.now();
  const slug = `e2e-pipeline-${stamp}`;
  const title = "E2E 发布链路测试";

  // ── 1. 建草稿 ──
  const created = await postJson(
    "/api/contents",
    {
      type: "article",
      title,
      slug,
      summary: "链路测试摘要",
      body: "<h2>正文标题</h2><p>正文内容</p>",
      status: "draft",
    },
    cookie
  );
  assertEqual(created.status, 200, "创建草稿应成功");
  const id = created.body?.id;
  assert(id, "应返回内容 id");

  // ── 2. 草稿阶段：前台必须看不到 ──
  const draftFront = await get(`/news/${slug}`);
  assertEqual(draftFront.status, 404, "草稿不应在前台可见");

  // ── 3. 同一个 id 改成发布状态（这是原来的测试没做的关键一步）──
  const published = await putJson(
    "/api/contents",
    {
      id,
      type: "article",
      title,
      slug,
      summary: "链路测试摘要",
      body: "<h2>正文标题</h2><p>正文内容</p>",
      status: "published",
    },
    cookie
  );
  assertEqual(published.status, 200, "从草稿改为发布应成功");

  // ── 4. 发布阶段：前台必须能看到 ──
  const publishedFront = await get(`/news/${slug}`);
  assertEqual(publishedFront.status, 200, "发布后前台应可见");
  assertIncludes(publishedFront.text, title, "前台应显示标题");
  assertIncludes(publishedFront.text, "正文内容", "前台应显示正文");

  // ── 5. 出现在列表页 ──
  const listPage = await get("/news");
  assertIncludes(listPage.text, slug, "应出现在新闻列表页");

  // ── 6. 下线 ──
  const offline = await putJson(
    "/api/contents",
    { id, type: "article", title, slug, body: "<p>x</p>", status: "offline" },
    cookie
  );
  assertEqual(offline.status, 200, "下线应成功");

  const offlineFront = await get(`/news/${slug}`);
  assertEqual(offlineFront.status, 404, "下线后前台应 404");

  // ── 7. 清理 ──
  await del(`/api/contents/${id}`, cookie);
});

test("发布链路：从草稿发布时会记录发布时间", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const stamp = Date.now();
  const slug = `e2e-pubtime-${stamp}`;

  const created = await postJson(
    "/api/contents",
    { type: "article", title: "E2E 发布时间", slug, body: "<p>x</p>", status: "draft" },
    cookie
  );
  const id = created.body?.id;

  await putJson(
    "/api/contents",
    { id, type: "article", title: "E2E 发布时间", slug, body: "<p>x</p>", status: "published" },
    cookie
  );

  // 前台详情页应有时间显示（dateTime 属性）
  const front = await get(`/news/${slug}`);
  assertEqual(front.status, 200, "发布后应可见");
  assertIncludes(front.text, "dateTime", "详情页应输出时间标签");

  await del(`/api/contents/${id}`, cookie);
});

test("发布链路：修改已发布内容的标题不影响 URL", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const stamp = Date.now();
  const slug = `e2e-urlnail-${stamp}`;

  const created = await postJson(
    "/api/contents",
    { type: "article", title: "原标题", slug, body: "<p>x</p>", status: "published" },
    cookie
  );
  const id = created.body?.id;

  // 改标题，slug 保持不变
  await putJson(
    "/api/contents",
    { id, type: "article", title: "改过的标题", slug, body: "<p>x</p>", status: "published" },
    cookie
  );

  const front = await get(`/news/${slug}`);
  assertEqual(front.status, 200, "改标题后旧 URL 应仍可访问");
  assertIncludes(front.text, "改过的标题", "应显示新标题");

  await del(`/api/contents/${id}`, cookie);
});
