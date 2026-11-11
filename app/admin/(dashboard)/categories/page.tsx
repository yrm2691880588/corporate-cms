import { listCategories } from "@/lib/content";
import CategoryManager from "@/components/admin/CategoryManager";

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  // 直接用 owner 层返回的驼峰对象，不再 cast 成 any（那会掩盖字段错位）
  const categories = listCategories(true);
  return <CategoryManager categories={categories} />;
}
