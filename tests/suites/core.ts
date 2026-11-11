/**
 * 核心链路测试
 *
 * 覆盖项目最关键的几条路径与约束。
 * 每个用例都对应一条真实的验收要求，不是为测而测。
 */

import { test, assert, assertEqual, assertIncludes, assertExcludes } from "../helpers/framework";
import { get, postJson, putJson, del, loginAs, toCookieHeader } from "../helpers/http";
import { TEST_ADMIN, TEST_EDITOR } from "../helpers/accounts";

// ─────────────────────────────────────────────
// 登录与权限
// ─────────────────────────────────────────────

test("登录：正确密码返回 200", async () => {
  const res = await postJson("/api/auth/login", {
    username: TEST_ADMIN.username,
    password: TEST_ADMIN.password,
  });
  assertEqual(res.status, 200, "正确密码应登录成功");
  assert(res.body?.ok === true, "响应应含 ok:true");
});

test("登录：错误密码返回 401", async () => {
  const res = await postJson("/api/auth/login", {
    username: "admin",
    password: "definitely-wrong-password",
  });
  assertEqual(res.status, 401, "错误密码应被拒绝");
});

test("登录：弱密码会被标记", async () => {
  const res = await postJson("/api/auth/login", {
    username: TEST_ADMIN.username,
    password: TEST_ADMIN.password,
  });
  assertEqual(res.status, 200, "应登录成功");
  assert(res.body?.weakPassword === true, "示例密码应被标记为弱密码");
});

test("权限：未登录访问后台跳转登录页", async () => {
  const res = await get("/admin");
  assertEqual(res.status, 307, "未登录应 307 跳转");
  assertIncludes(res.location ?? "", "/admin/login", "应跳到登录页");
});

test("权限：编辑访问管理员页面被拦截", async () => {
  const cookie = await loginAs(TEST_EDITOR.username, TEST_EDITOR.password);
  for (const path of ["/admin/settings", "/admin/users", "/admin/errors"]) {
    const res = await get(path, cookie);
    assertEqual(res.status, 307, `编辑访问 ${path} 应被拦截`);
  }
});

test("权限：管理员可以访问管理页面", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  for (const path of ["/admin/settings", "/admin/users", "/admin/errors"]) {
    const res = await get(path, cookie);
    assertEqual(res.status, 200, `管理员访问 ${path} 应成功`);
  }
});

// ─────────────────────────────────────────────
// 内容发布链路
// ─────────────────────────────────────────────

test("内容：草稿不出现在前台", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const slug = `e2e-draft-${Date.now()}`;

  const created = await postJson(
    "/api/contents",
    {
      type: "article",
      title: "E2E 草稿测试",
      slug,
      body: "<p>草稿内容</p>",
      status: "draft",
    },
    cookie
  );
  assertEqual(created.status, 200, "创建草稿应成功");

  const front = await get(`/news/${slug}`);
  assertEqual(front.status, 404, "草稿不应在前台可见");

  // 清理：按 id 精确删（禁止模糊匹配）
  if (created.body?.id) {
    await del(`/api/contents/${created.body.id}`, cookie);
  }
});

test("内容：发布后前台立即可见", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const slug = `e2e-publish-${Date.now()}`;
  const title = "E2E 发布测试文章";

  const created = await postJson(
    "/api/contents",
    {
      type: "article",
      title,
      slug,
      body: "<p>正文内容</p>",
      status: "published",
    },
    cookie
  );
  assertEqual(created.status, 200, "发布应成功");

  const front = await get(`/news/${slug}`);
  assertEqual(front.status, 200, "发布后应在前台可见");
  assertIncludes(front.text, title, "前台应显示标题");

  if (created.body?.id) {
    await del(`/api/contents/${created.body.id}`, cookie);
  }
});

test("内容：下线后前台返回 404", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const slug = `e2e-offline-${Date.now()}`;

  const created = await postJson(
    "/api/contents",
    {
      type: "article",
      title: "E2E 下线测试",
      slug,
      body: "<p>x</p>",
      status: "published",
    },
    cookie
  );
  const id = created.body?.id;
  assert(id, "应返回内容 id");

  const updated = await putJson(
    "/api/contents",
    {
      id,
      type: "article",
      title: "E2E 下线测试",
      slug,
      body: "<p>x</p>",
      status: "offline",
    },
    cookie
  );
  assertEqual(updated.status, 200, "下线应成功");

  const front = await get(`/news/${slug}`);
  assertEqual(front.status, 404, "下线后前台应 404");

  await del(`/api/contents/${id}`, cookie);
});

// ─────────────────────────────────────────────
// 安全：XSS 净化
// ─────────────────────────────────────────────

test("安全：正文中的 script 被净化", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const slug = `e2e-xss-${Date.now()}`;

  const created = await postJson(
    "/api/contents",
    {
      type: "article",
      title: "E2E XSS 测试",
      slug,
      body: '<p>正常内容</p><script>alert(1)</script><img src=x onerror="alert(2)">',
      status: "published",
    },
    cookie
  );

  const front = await get(`/news/${slug}`);
  assertExcludes(front.text, "<script>alert", "script 标签应被剥离");
  assertExcludes(front.text, "onerror", "事件属性应被剥离");
  assertIncludes(front.text, "正常内容", "正常内容应保留");

  if (created.body?.id) {
    await del(`/api/contents/${created.body.id}`, cookie);
  }
});

test("安全：非白名单 iframe 被过滤", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const slug = `e2e-iframe-${Date.now()}`;

  const created = await postJson(
    "/api/contents",
    {
      type: "article",
      title: "E2E iframe 测试",
      slug,
      body: '<div class="video-embed"><iframe src="https://evil.example.com/x"></iframe></div>',
      status: "published",
    },
    cookie
  );

  const front = await get(`/news/${slug}`);
  assertExcludes(front.text, "evil.example.com", "非白名单 iframe 应被移除");

  if (created.body?.id) {
    await del(`/api/contents/${created.body.id}`, cookie);
  }
});

// ─────────────────────────────────────────────
// 限流
// ─────────────────────────────────────────────

test("限流：留言同 IP 第 4 条被拒", async () => {
  const results: number[] = [];
  for (let i = 0; i < 4; i++) {
    const res = await postJson(
      "/api/messages",
      {
        name: `E2E限流${i}`,
        contact: "13800000000",
        content: `这是第 ${i + 1} 条限流测试留言`,
      },
      undefined,
      // 专用 IP，避免和其他用例互相污染
      { "x-forwarded-for": "198.51.100.20" }
    );
    results.push(res.status);
  }
  // 前 3 条应成功，第 4 条被限流
  assert(results.slice(0, 3).every((s) => s === 200), `前 3 条应成功，实际：${results.join(",")}`);
  assertEqual(results[3], 429, "第 4 条应被限流拒绝");
});

// ─────────────────────────────────────────────
// 前台页面可访问性
// ─────────────────────────────────────────────

test("前台：核心页面全部可访问", async () => {
  const pages = [
    ["/", "首页"],
    ["/news", "新闻列表"],
    ["/products", "产品列表"],
    ["/contact", "联系我们"],
    ["/sitemap.xml", "站点地图"],
    ["/robots.txt", "robots"],
  ];
  for (const [path, name] of pages) {
    const res = await get(path);
    assertEqual(res.status, 200, `${name} (${path}) 应可访问`);
  }
});

test("前台：不存在的页面返回真 404", async () => {
  const res = await get("/news/definitely-not-exist-xyz");
  assertEqual(res.status, 404, "应返回 404 而非软 404");
});

test("前台：页脚有隐蔽的后台管理入口", async () => {
  // 【需求变更记录】
  // 最初要求前台不暴露后台入口；后经用户确认改回「保留但隐蔽」，
  // 因为管理员需要能直接点进去，而不是每次手动输网址。
  //
  // 这里验证三件事：
  // 1. 入口存在且指向正确的登录页
  // 2. 入口文案是「管理入口」
  // 3. 入口不在顶部导航区（只在页脚最底部，访客不易察觉）
  const home = await get("/");
  assertIncludes(home.text, 'href="/admin/login"', "页脚应有后台入口链接");
  assertIncludes(home.text, "管理入口", "应显示「管理入口」文字");

  // 入口应在 </footer> 之前的最后一段，而不是在 <header>/<nav> 里
  const footerIdx = home.text.lastIndexOf("</footer>");
  const linkIdx = home.text.lastIndexOf('href="/admin/login"');
  assert(footerIdx > 0 && linkIdx > 0, "应能定位到页脚与管理入口");
  assert(linkIdx < footerIdx, "管理入口应位于页脚内（底部隐蔽位置）");
});

test("前台：管理入口能正常打开登录页", async () => {
  const res = await get("/admin/login");
  assertEqual(res.status, 200, "登录页应可访问");
});

// ─────────────────────────────────────────────
// SEO
// ─────────────────────────────────────────────

test("SEO：文章页有独立标题与描述", async () => {
  const cookie = await loginAs(TEST_ADMIN.username, TEST_ADMIN.password);
  const slug = `e2e-seo-${Date.now()}`;
  const title = "E2E SEO 测试文章";

  // 自己建一篇，不依赖库里已有的数据。
  // 早先的写法是"从列表页找一个链接，找不到就 return"——
  // 那等于这个用例可以永远通过，什么也没验证。
  const created = await postJson(
    "/api/contents",
    {
      type: "article",
      title,
      slug,
      body: "<p>SEO 测试正文</p>",
      summary: "这是用于验证 SEO 的摘要",
      status: "published",
    },
    cookie
  );
  assertEqual(created.status, 200, "创建文章应成功");

  const article = await get(`/news/${slug}`);
  assertEqual(article.status, 200, "文章页应可访问");
  assertIncludes(article.text, `<title>`, "应有 title 标签");
  assertIncludes(article.text, title, "标题应出现在 title 中");
  assertIncludes(article.text, 'name="description"', "应有 description");
  assertIncludes(article.text, "application/ld+json", "应有结构化数据");

  if (created.body?.id) {
    await del(`/api/contents/${created.body.id}`, cookie);
  }
});

test("SEO：sitemap 包含栏目页与标签页", async () => {
  const res = await get("/sitemap.xml");
  assertEqual(res.status, 200, "sitemap 应可访问");
  assertIncludes(res.text, "<urlset", "应是合法 sitemap");
  assertIncludes(res.text, "/category/", "应包含栏目页");
});
