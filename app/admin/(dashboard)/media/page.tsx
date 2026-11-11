import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { media } from "@/lib/schema";
import MediaLibrary from "@/components/admin/MediaLibrary";

export const dynamic = "force-dynamic";

/** 单页展示上限。图片库是列表型界面，不给上界会随使用无限增长 */
const PAGE_LIMIT = 200;

export default function MediaPage() {
  const items = getDb()
    .select({
      id: media.id,
      filename: media.filename,
      originalName: media.originalName,
      sizeBytes: media.sizeBytes,
      width: media.width,
      height: media.height,
      thumbPath: media.thumbPath,
      createdAt: media.createdAt,
    })
    .from(media)
    .orderBy(desc(media.createdAt))
    .limit(PAGE_LIMIT)
    .all();

  return <MediaLibrary items={items} limited={items.length >= PAGE_LIMIT} />;
}
