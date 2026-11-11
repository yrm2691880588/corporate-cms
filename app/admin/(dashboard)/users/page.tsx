import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import UserManager from "@/components/admin/UserManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "用户管理",
  robots: { index: false, follow: false },
};

export default async function UsersPage() {
  const user = await getCurrentUser();
  // 页面级权限保护：只有管理员能进入
  if (!user || user.role !== "admin") redirect("/admin");

  const items = getDb()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(users.id)
    .all();

  return <UserManager items={items} />;
}
