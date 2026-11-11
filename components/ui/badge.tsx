import * as React from "react";
import { cn } from "@/lib/utils";

/** Badge —— shadcn/ui 标准组件，用于状态标签 */
const badgeVariants: Record<string, string> = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-indigo-50 text-indigo-700",
  outline: "border border-gray-200 text-gray-600",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof badgeVariants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        badgeVariants[variant] ?? badgeVariants.default,
        className
      )}
      {...props}
    />
  );
}
