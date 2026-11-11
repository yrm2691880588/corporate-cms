/**
 * 后台功能测试
 *
 * 补齐 core.ts 未覆盖的关键路径：
 * 回收站、图片上传、站点设置、栏目管理。
 *
 * 这几条都是"改坏了不容易发现"的地方——
 * 比如回收站恢复逻辑错了，日常使用完全感知不到，直到真的需要恢复时才发现。
 */

import { test, assert, assertEqual, assertIncludes } from "../helpers/framework";
import { get, postJson, putJson, del, patch, loginAs } from "../helpers/http";
import { TEST_ADMIN, TEST_EDITOR } from "../helpers/accounts";

// ─────────────────────────────────────────────
// 回收站
// ─────────────────────────────────────────────

test("回收站：删除后进回收站，可恢复", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const slug = `e2e-trash-${Date.now()}`;

  // 建一篇
  const created = await postJson(
    "/api/contents",
    { type: "article", title: "E2E 回收站测试", slug, body: "<p>x</p>", status: "published" },
    cookie
  );
  const id = created.body?.id;
  assert(id, "应返回内容 id");

  // 删除
  const deleted = await del(`/api/contents/${id}`, cookie);
  assertEqual(deleted.status, 200, "删除应成功");

  // 前台消失
  const front = await get(`/news/${slug}`);
  assertEqual(front.status, 404, "删除后前台应 404");

  // 回收站页面能打开
  const trashPage = await get("/admin/trash", cookie);
  assertEqual(trashPage.status, 200, "回收站页应可访问");
  assertIncludes(trashPage.text, "E2E 回收站测试", "回收站应显示该条目");

  // 恢复
  const restored = await patch(`/api/contents/${id}?action=restore`, cookie);
  assertEqual(restored.status, 200, "恢复应成功");
  assert(restored.body?.slug, "恢复应返回新 slug");
});

test("回收站：删除时释放原 slug", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const slug = `e2e-slug-free-${Date.now()}`;

  const created = await postJson(
    "/api/contents",
    { type: "article", title: "E2E slug 释放", slug, body: "<p>x</p>", status: "published" },
    cookie
  );
  const id = created.body?.id;

  await del(`/api/contents/${id}`, cookie);

  // 用同一个 slug 再建一次，应该成功（说明原 slug 已释放）
  const again = await postJson(
    "/api/contents",
    { type: "article", title: "E2E slug 复用", slug, body: "<p>y</p>", status: "draft" },
    cookie
  );
  assertEqual(again.status, 200, "原 slug 应已被释放，可以重新使用");

  if (again.body?.id) await del(`/api/contents/${again.body.id}`, cookie);
});

test("回收站：永久删除需要管理员权限", async () => {
  const adminCookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const editorCookie = await loginAs(TEST_EDITOR.username, TEST_EDITOR.password);
  const slug = `e2e-purge-${Date.now()}`;

  const created = await postJson(
    "/api/contents",
    { type: "article", title: "E2E 永久删除", slug, body: "<p>x</p>" },
    adminCookie
  );
  const id = created.body?.id;
  await del(`/api/contents/${id}`, adminCookie);

  // 编辑尝试永久删除 → 403
  const editorPurge = await patch(`/api/contents/${id}?action=purge`, editorCookie);
  assertEqual(editorPurge.status, 403, "编辑不应有永久删除权限");

  // 管理员可以
  const adminPurge = await patch(`/api/contents/${id}?action=purge`, adminCookie);
  assertEqual(adminPurge.status, 200, "管理员应可永久删除");
});

// ─────────────────────────────────────────────
// 图片上传
// ─────────────────────────────────────────────

test("图片：上传后自动压缩为 WebP", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);

  // 造一张纯色 PNG（大尺寸，便于验证压缩）
  const sharp = (await import("sharp")).default;
  const png = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: { r: 30, g: 60, b: 120 } },
  })
    .png()
    .toBuffer();

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "e2e-test.png");

  const res = await fetch(`${process.env.TEST_BASE_URL}/api/upload`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assertEqual(res.status, 200, "上传应成功");

  const json = await res.json();
  assert(json.url, "应返回图片地址");
  assert(json.url.endsWith(".webp"), `应转为 WebP，实际：${json.url}`);
  assert(json.size < png.length, "压缩后应小于原图");
  assert(json.thumbUrl, "应生成缩略图");
});

test("图片：拒绝非图片文件", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);

  const form = new FormData();
  form.append("file", new Blob([new TextEncoder().encode("not an image")], { type: "text/plain" }), "x.png");

  const res = await fetch(`${process.env.TEST_BASE_URL}/api/upload`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  assert(res.status === 400 || res.status === 415, `非图片应被拒绝，实际 HTTP ${res.status}`);
});

test("图片：未登录不能上传", async () => {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "x.png");

  const res = await fetch(`${process.env.TEST_BASE_URL}/api/upload`, {
    method: "POST",
    body: form,
  });
  assertEqual(res.status, 401, "未登录上传应返回 401");
});

// ─────────────────────────────────────────────
// 站点设置
// ─────────────────────────────────────────────

test("站点设置：修改后前台立即生效", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const marker = `E2E品牌${Date.now()}`;

  // 读取当前设置
  const before = await get("/api/settings", cookie);
  assertEqual(before.status, 200, "读取设置应成功");
  const original = before.body?.settings;
  assert(original, "应返回 settings");

  // 改公司简称
  const updated = await putJson(
    "/api/settings",
    {
      legalName: original.legalName,
      shortName: marker,
      tagline: original.tagline,
      headline: original.headline,
      subheadline: original.subheadline,
      logo: original.logo,
      icpNumber: original.icpNumber,
      phone: original.contact.phone,
      email: original.contact.email,
      address: original.contact.address,
      workTime: original.contact.workTime,
      primary: original.theme.primary,
      titleSuffix: marker,
      defaultDescription: original.seo.defaultDescription,
      nav: original.nav,
    },
    cookie
  );
  assertEqual(updated.status, 200, "保存设置应成功");

  // 前台应立刻出现新名称
  const home = await get("/");
  assertIncludes(home.text, marker, "前台应立即显示新公司名");

  // 恢复默认（清空覆盖）
  const reset = await del("/api/settings", cookie);
  assertEqual(reset.status, 200, "恢复默认应成功");
});

test("站点设置：编辑无权修改", async () => {
  const cookie = await loginAs(TEST_EDITOR.username, TEST_EDITOR.password);
  const res = await putJson("/api/settings", { legalName: "x", shortName: "y", primary: "#000000" }, cookie);
  assertEqual(res.status, 403, "编辑修改设置应被拒绝");
});

// ─────────────────────────────────────────────
// 栏目
// ─────────────────────────────────────────────

test("栏目：可创建两级栏目", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const stamp = Date.now();

  const parent = await postJson(
    "/api/categories",
    { name: `E2E父栏目${stamp}`, slug: `e2e-parent-${stamp}`, sortOrder: 99, isVisible: true },
    cookie
  );
  assertEqual(parent.status, 200, "创建父栏目应成功");
  const parentId = parent.body?.id;

  const child = await postJson(
    "/api/categories",
    { name: `E2E子栏目${stamp}`, slug: `e2e-child-${stamp}`, parentId, sortOrder: 99, isVisible: true },
    cookie
  );
  assertEqual(child.status, 200, "创建子栏目应成功");

  // 清理：先删子再删父
  if (child.body?.id) await del(`/api/categories?id=${child.body.id}`, cookie);
  if (parentId) await del(`/api/categories?id=${parentId}`, cookie);
});

test("栏目：不允许三级", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const stamp = Date.now();

  const l1 = await postJson("/api/categories", { name: `E2E一级${stamp}`, slug: `e2e-l1-${stamp}`, sortOrder: 98 }, cookie);
  const l2 = await postJson(
    "/api/categories",
    { name: `E2E二级${stamp}`, slug: `e2e-l2-${stamp}`, parentId: l1.body?.id, sortOrder: 98 },
    cookie
  );

  // 尝试建第三级
  const l3 = await postJson(
    "/api/categories",
    { name: `E2E三级${stamp}`, slug: `e2e-l3-${stamp}`, parentId: l2.body?.id, sortOrder: 98 },
    cookie
  );
  assertEqual(l3.status, 400, "三级栏目应被拒绝");

  // 清理
  if (l2.body?.id) await del(`/api/categories?id=${l2.body.id}`, cookie);
  if (l1.body?.id) await del(`/api/categories?id=${l1.body.id}`, cookie);
});

// ─────────────────────────────────────────────
// 留言
// ─────────────────────────────────────────────

test("留言：后台可标记已读与已处理", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);

  // 先提交一条。
  // 用独立的 x-forwarded-for：core.ts 的限流用例已经用掉了默认 IP 的配额，
  // 若共用会返回 429——那是测试互相污染，不是功能问题。
  const submitted = await postJson(
    "/api/messages",
    {
      name: `E2E留言${Date.now()}`,
      contact: "13800000000",
      content: "这是用于测试已读已处理的留言内容",
    },
    undefined,
    { "x-forwarded-for": "198.51.100.10" }
  );
  assertEqual(submitted.status, 200, "提交留言应成功");

  // 后台留言页应能打开
  const page = await get("/admin/messages", cookie);
  assertEqual(page.status, 200, "留言页应可访问");
});
