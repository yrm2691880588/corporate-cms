/**
 * 极简测试框架
 *
 * 【为什么不用 vitest / jest】
 * 项目需要测的是「真实 HTTP 行为」，不是单元逻辑。
 * 引入完整测试框架会带来配置、转译、mock 等一堆东西，
 * 而这些用例本质上就是「发请求 → 断言状态码和内容」。
 * 一个 30 行的收集器足够，且零新依赖。
 *
 * 如果将来需要 mock、快照、覆盖率，再换成 vitest 也不迟——
 * 那时测试用例本身不用改。
 */

export type TestResult = {
  name: string;
  ok: boolean;
  error?: string;
};

type TestFn = () => Promise<void> | void;

const tests: { name: string; fn: TestFn }[] = [];

/** 注册一个测试用例 */
export function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

/** 断言：条件为真 */
export function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(`断言失败：${message}`);
}

/** 断言：相等 */
export function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`断言失败：${message}\n  期望：${expected}\n  实际：${actual}`);
  }
}

/** 断言：包含子串 */
export function assertIncludes(haystack: string, needle: string, message: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`断言失败：${message}\n  期望包含：${needle}`);
  }
}

/** 断言：不包含子串 */
export function assertExcludes(haystack: string, needle: string, message: string) {
  if (haystack.includes(needle)) {
    throw new Error(`断言失败：${message}\n  不应包含：${needle}`);
  }
}

/** 执行所有已注册的测试 */
export async function runAllTests(): Promise<{
  tests: TestResult[];
  total: number;
  passed: number;
  failed: number;
}> {
  const results: TestResult[] = [];

  for (const t of tests) {
    try {
      await t.fn();
      results.push({ name: t.name, ok: true });
    } catch (err) {
      results.push({
        name: t.name,
        ok: false,
        error: err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err),
      });
    }
  }

  const passed = results.filter((r) => r.ok).length;
  return {
    tests: results,
    total: results.length,
    passed,
    failed: results.length - passed,
  };
}

