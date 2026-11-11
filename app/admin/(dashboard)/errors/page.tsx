import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readRecentLogs } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileWarning } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "错误日志",
  robots: { index: false, follow: false },
};

/** 错误日志查看页（仅管理员） */
export default async function ErrorLogsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin");

  const files = readRecentLogs(300);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">错误日志</h1>
        <p className="text-sm text-gray-500 mt-1">
          记录服务端与客户端异常，按天分文件，保留最近 3 天。文件位置：<code className="bg-gray-100 px-1 rounded text-xs">data/logs/</code>
        </p>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileWarning className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">还没有错误记录</p>
            <p className="text-xs text-gray-400 mt-1">
              这是好事：说明系统运行正常，没有出现异常
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {files.map((f) => (
            <Card key={f.file}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  {f.file}
                  <Badge variant="warning">{f.lines.length} 行</Badge>
                </CardTitle>
                <CardDescription>最新的记录在最下面</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-all">
                  {f.lines.join("\n")}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
