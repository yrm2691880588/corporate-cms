import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { messages } from "@/lib/schema";
import MessageList from "@/components/admin/MessageList";

export const dynamic = "force-dynamic";

export default function MessagesPage() {
  const items = getDb()
    .select({
      id: messages.id,
      name: messages.name,
      contact: messages.contact,
      content: messages.content,
      sourceUrl: messages.sourceUrl,
      isRead: messages.isRead,
      isProcessed: messages.isProcessed,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .orderBy(desc(messages.createdAt))
    .limit(200)
    .all();

  return <MessageList items={items} />;
}
