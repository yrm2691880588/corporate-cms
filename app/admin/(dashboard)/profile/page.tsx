import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import PasswordForm from "@/components/admin/PasswordForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我的账号",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const user = await getCurrentUser();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">我的账号</h1>
        <p className="text-sm text-gray-500 mt-1">查看账号信息、修改密码</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">账号信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-50">
            <span className="text-gray-500">显示名称</span>
            <span className="text-gray-900 font-medium">{user?.displayName}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-50">
            <span className="text-gray-500">登录账号</span>
            <span className="text-gray-900 font-mono">{user?.username}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-gray-500">角色</span>
            <span className="text-gray-900">{user?.role === "admin" ? "管理员" : "编辑"}</span>
          </div>
        </CardContent>
      </Card>

      <PasswordForm />
    </div>
  );
}
