"use client";

import { useState } from "react";

export default function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    setState("sending");
    setMessage("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          contact: data.get("contact"),
          content: data.get("content"),
          // 蜜罐字段：正常用户看不见也不会填
          website: data.get("website"),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(json.error ?? "提交失败，请稍后重试");
        return;
      }

      setState("done");
      setMessage("已收到你的留言，我们会尽快与你联系。");
      form.reset();
    } catch {
      setState("error");
      setMessage("网络异常，请检查连接后重试");
    }
  }

  if (state === "done") {
    return (
      <div className="bg-green-50 border border-green-100 rounded-xl p-8 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="font-bold text-green-900 mb-2">提交成功</h3>
        <p className="text-sm text-green-700">{message}</p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-6 text-sm font-medium text-green-700 underline"
        >
          再提交一条
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-gray-100 rounded-xl p-6 sm:p-8 shadow-sm">
      <div className="space-y-5">
        <div>
          <label htmlFor="name" className="field-label">
            称呼 <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={50}
            className="field"
            placeholder="怎么称呼你"
          />
        </div>

        <div>
          <label htmlFor="contact" className="field-label">
            联系方式 <span className="text-red-500">*</span>
          </label>
          <input
            id="contact"
            name="contact"
            required
            maxLength={100}
            className="field"
            placeholder="手机号 / 微信 / 邮箱，任选一种"
          />
          <p className="field-hint">方便我们联系到你即可</p>
        </div>

        <div>
          <label htmlFor="content" className="field-label">
            留言内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="content"
            name="content"
            required
            rows={5}
            maxLength={1000}
            className="field resize-y"
            placeholder="简单说说你的需求或想了解的内容"
          />
        </div>

        {/* 蜜罐：对真实用户隐藏，机器人会填 */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website">网站</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        {state === "error" && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={state === "sending"}
          className="btn btn-primary w-full"
        >
          {state === "sending" ? "提交中…" : "提交留言"}
        </button>

        <p className="text-xs text-gray-400 text-center">
          提交即表示同意我们使用该信息与你联系，我们不会用于其他用途。
        </p>
      </div>
    </form>
  );
}
