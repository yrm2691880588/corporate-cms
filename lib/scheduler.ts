/**
 * 后台定时任务
 *
 * 【为什么需要】
 * 之前的做法是在前台页面渲染时顺带调用 `publishScheduledDue()`，
 * 这有两个问题：
 * 1. 没人访问首页/列表页时，定时内容永远不会发布
 * 2. 在渲染路径里写库，并发访问时会产生重复写入
 *
 * 【现在的做法】
 * 在一个独立的定时器里检查（进程启动时注册，默认 60 秒一次），
 * 与页面渲染完全解耦。
 *
 * 【注意事项】
 * 这是单进程方案，适合一期的本机/单机部署。
 * 若二期上多实例，需要换成外部的定时任务（如 Cloudflare Cron、
 * 服务器 crontab），否则每个实例都会各跑一遍（虽然 UPDATE 幂等，不会出错）。
 */

import { publishScheduledDue } from "./content";

/**
 * 轮询间隔。
 *
 * 生产用 60 秒；测试时可用环境变量调短（如 1000ms），
 * 这样能验证「真的会到点自动发布」，而不必等一分钟。
 *
 * 用环境变量而不是给测试开专用接口，是为了让测试走和线上完全一样的代码路径——
 * 加个 /api/test/publish-now 之类的后门，测的就不是真实行为了。
 */
const INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS) || 60 * 1000;

type Timer = ReturnType<typeof setInterval>;

// 挂到 globalThis，避免 Next.js 热更新时重复注册定时器
const g = globalThis as unknown as { __scheduledPublisher?: Timer };

export function startScheduledPublisher() {
  if (g.__scheduledPublisher) return;

  const tick = () => {
    try {
      const n = publishScheduledDue();
      if (n > 0) {
        console.log(`[定时发布] ${n} 条内容已到点上线`);
      }
    } catch (err) {
      // 定时任务出错不能让进程崩，记录后等下一轮
      console.error("[定时发布] 执行失败", err);
    }
  };

  // 立即跑一次，避免重启后要等一分钟
  tick();
  g.__scheduledPublisher = setInterval(tick, INTERVAL_MS);
  console.log(`[定时发布] 定时器已启动，每 ${INTERVAL_MS / 1000} 秒检查一次`);
}
