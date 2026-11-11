import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并类名 —— shadcn/ui 标准做法
 *
 * clsx 负责条件拼接，tailwind-merge 负责解决冲突
 * （比如 cn("px-2", "px-4") 结果是 "px-4"，而不是两个都保留）。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
