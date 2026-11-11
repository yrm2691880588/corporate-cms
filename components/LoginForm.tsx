"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm({
  logo,
  shortName,
}: {
  logo: string;
  shortName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.get("username"),
          password: data.get("password"),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "登录失败");
        setLoading(false);
        return;
      }
      if (json.weakPassword) {
        toast.warning("当前密码强度不足，建议到「我的账号」修改", { duration: 6000 });
      } else {
        toast.success("登录成功");
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("网络异常，请重试");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt={shortName}
            className="h-14 w-14 mx-auto mb-4 rounded-lg object-contain"
          />
          <h1 className="text-xl font-bold text-gray-900">{shortName}</h1>
          <p className="text-sm text-gray-500 mt-1">内容管理后台</p>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-7">
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">账号</Label>
              <Input
                id="username"
                name="username"
                required
                autoComplete="username"
                autoFocus
                className="mt-1.5"
                placeholder="请输入账号"
              />
            </div>
            <div>
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1.5"
                placeholder="请输入密码"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "登录中…" : "登录"}
            </Button>
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/" className="hover:text-gray-600">← 返回官网</Link>
        </p>

        <p className="text-center text-xs text-gray-400 mt-3 leading-relaxed">
          本页面仅限内部人员使用
          <br />
          连续 5 次密码错误将锁定 15 分钟
        </p>
      </div>
    </div>
  );
}
