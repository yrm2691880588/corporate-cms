"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, MailOpen, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Msg = {
  id: number;
  name: string;
  contact: string;
  content: string;
  sourceUrl: string | null;
  isRead: number;
  isProcessed: number;
  createdAt: string;
};

type Filter = "all" | "unread" | "pending" | "done";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "unread", label: "未读" },
  { id: "pending", label: "待跟进" },
  { id: "done", label: "已处理" },
];

export default function MessageList({ items }: { items: Msg[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const unread = items.filter((m) => !m.isRead).length;
  const pending = items.filter((m) => !m.isProcessed).length;

  const shown = items.filter((m) => {
    if (filter === "unread") return !m.isRead;
    if (filter === "pending") return !m.isProcessed;
    if (filter === "done") return !!m.isProcessed;
    return true;
  });

  async function patch(id: number, body: { isRead?: boolean; isProcessed?: boolean }) {
    setBusy(id);
    const res = await fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "更新失败");
      return;
    }
    if (body.isProcessed !== undefined) {
      toast.success(body.isProcessed ? "已标记为处理完成" : "已恢复为待跟进");
    }
    router.refresh();
  }

  function countOf(f: Filter) {
    if (f === "unread") return unread;
    if (f === "pending") return pending;
    if (f === "done") return items.length - pending;
    return items.length;
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            留言
            {unread > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-semibold text-white bg-red-500 rounded-full">
                {unread}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {items.length} 条{pending > 0 && `，${pending} 条待跟进`}
          </p>
        </div>

        <div className="flex gap-1 bg-white border border-gray-100 rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-sm rounded-md transition whitespace-nowrap ${
                filter === f.id
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
              {countOf(f.id) > 0 && (
                <span className="ml-1 text-xs text-gray-400">{countOf(f.id)}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-20 text-center text-gray-400">
          {filter === "unread"
            ? "没有未读留言"
            : filter === "pending"
            ? "没有待跟进的留言"
            : filter === "done"
            ? "还没有处理完成的留言"
            : "还没有留言"}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((m) => {
            const isOpen = open === m.id;
            const done = !!m.isProcessed;
            return (
              <div
                key={m.id}
                className={`bg-white rounded-xl border transition ${
                  done
                    ? "border-gray-100 opacity-75"
                    : m.isRead
                    ? "border-gray-100"
                    : "border-red-100 bg-red-50/20"
                }`}
              >
                <button
                  onClick={() => {
                    setOpen(isOpen ? null : m.id);
                    if (!m.isRead && !isOpen) patch(m.id, { isRead: true });
                  }}
                  className="w-full text-left px-5 py-4 flex items-start gap-3"
                >
                  {!m.isRead && <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{m.name}</span>
                      <span className="text-sm text-gray-500">{m.contact}</span>
                      {done && (
                        <Badge variant="success" className="ml-1">
                          已处理
                        </Badge>
                      )}
                      <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <p className={`text-sm text-gray-600 mt-1 ${isOpen ? "" : "line-clamp-1"}`}>
                      {m.content}
                    </p>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 flex flex-wrap items-center gap-3 border-t border-gray-50 pt-3">
                    <button
                      onClick={() => patch(m.id, { isProcessed: !done })}
                      disabled={busy === m.id}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition ${
                        done
                          ? "text-gray-500 hover:bg-gray-100"
                          : "text-green-700 bg-green-50 hover:bg-green-100"
                      }`}
                    >
                      {done ? (
                        <>
                          <Circle className="h-3.5 w-3.5" />
                          撤销已处理
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          标记为已处理
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => patch(m.id, { isRead: !m.isRead })}
                      className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition"
                    >
                      {m.isRead ? (
                        <>
                          <Mail className="h-3.5 w-3.5" />
                          标记为未读
                        </>
                      ) : (
                        <>
                          <MailOpen className="h-3.5 w-3.5" />
                          标记为已读
                        </>
                      )}
                    </button>

                    {m.sourceUrl && (
                      <span className="text-xs text-gray-400 truncate max-w-xs">
                        来源页：{m.sourceUrl}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
