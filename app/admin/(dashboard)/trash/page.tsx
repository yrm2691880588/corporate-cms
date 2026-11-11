import type { Metadata } from "next";
import { desc, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { contents } from "@/lib/schema";
import TrashList from "@/components/admin/TrashList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "回收站",
  robots: { index: false, follow: false },
};

export default async function TrashPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin");

  const items = getDb()
    .select({
      id: contents.id,
      title: contents.title,
      type: contents.type,
      slug: contents.slug,
      deletedAt: contents.deletedAt,
      updatedAt: contents.updatedAt,
    })
    .from(contents)
    .where(isNotNull(contents.deletedAt))
    .orderBy(desc(contents.updatedAt))
    .limit(200)
    .all();

  return <TrashList items={items} />;
}
