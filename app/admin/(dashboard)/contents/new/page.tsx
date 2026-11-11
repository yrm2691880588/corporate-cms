import { listCategories } from "@/lib/content";
import { getDb } from "@/lib/db";
import { tags } from "@/lib/schema";
import { asc } from "drizzle-orm";
import ContentForm from "@/components/admin/ContentForm";

export const dynamic = "force-dynamic";

export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const type = (sp.type as "article" | "product" | "page") || "article";

  const categories = listCategories(true).map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    slug: c.slug,
  }));

  const allTags = getDb().select({ id: tags.id, name: tags.name, slug: tags.slug }).from(tags).orderBy(asc(tags.name)).all();

  return <ContentForm mode="new" type={type} categories={categories} allTags={allTags} />;
}
