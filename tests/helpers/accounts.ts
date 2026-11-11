/**
 * 测试账号配置
 *
 * 【为什么不能硬编码密码】
 * 如果测试里写死 `admin12345`，用户一旦按安全建议改了密码，
 * 所有用例会集体失败——那不是发现了 bug，而是测试自己过时了。
 * 这种"假失败"会让人不再相信测试结果。
 *
 * 【解法】
 * 账号密码从环境变量读，默认值只作为开箱即用的兜底。
 * 用户改了密码后，只需在跑测试时指定：
 *
 *   ADMIN_PASSWORD=新密码 npm test
 *
 * 【为什么不从数据库读哈希反推】
 * 那是不可能的——bcrypt 不可逆。只能由用户提供明文，
 * 或者用一个专用的测试账号。
 */

export const TEST_ADMIN = {
  username: process.env.TEST_ADMIN_USER || "admin",
  password: process.env.TEST_ADMIN_PASSWORD || "admin12345",
};

export const TEST_EDITOR = {
  username: process.env.TEST_EDITOR_USER || "editor",
  password: process.env.TEST_EDITOR_PASSWORD || "editor12345",
};
