import { notFound } from "next/navigation";
import { getById, listCategories } from "@/lib/content";
import { getDb } from "@/lib/db";
import { tags } from "@/lib/schema";
import { asc } from "drizzle-orm";
import ContentForm from "@/components/admin/ContentForm";

export const dynamic = "force-dynamic";

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = getById(Number(id));
  if (!item) notFound();

  const categories = listCategories(true).map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    slug: c.slug,
  }));

  const allTags = getDb().select({ id: tags.id, name: tags.name, slug: tags.slug }).from(tags).orderBy(asc(tags.name)).all();

  return (
    <ContentForm
      mode="edit"
      type={item.type}
      categories={categories}
      allTags={allTags}
      initial={{
        id: item.id,
        title: item.title,
        slug: item.slug,
        summary: item.summary,
        body: item.body,
        coverImage: item.coverImage,
        coverThumb: item.coverThumb,
        categoryId: item.categoryId,
        status: item.status,
        isFeatured: item.isFeatured,
        seoTitle: item.seoTitle,
        seoDescription: item.seoDescription,
        scheduledAt: item.scheduledAt,
        tags: item.tags ?? [],
      }}
    />
  );
}
