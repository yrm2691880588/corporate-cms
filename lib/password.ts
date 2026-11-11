/**
 * 密码加密 —— 与框架无关的纯逻辑
 *
 * 单独成文件的原因：脚本（如初始化数据）需要它，
 * 但不应该被迫加载 Next.js 的运行时依赖。
 */

import bcrypt from "bcryptjs";

const ROUNDS = 10;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, ROUNDS);
}

export function checkPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}
