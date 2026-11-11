"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Underline from "@tiptap/extension-underline";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Images, Video } from "lucide-react";
import MediaPicker from "./MediaPicker";
import { toEmbedUrl } from "@/lib/sanitize";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

/** 工具栏按钮 */
function TBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2.5 py-1.5 text-sm rounded-md transition ${
        active
          ? "bg-indigo-100 text-indigo-700 font-semibold"
          : "text-gray-600 hover:bg-gray-100"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export default function RichEditor({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: { HTMLAttributes: { class: "code-block" } },
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: "开始写正文… 可以用工具栏插入图片、表格、链接" }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-content min-h-[400px] px-5 py-4 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // 外部 value 变化时同步（如切换内容）
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  /** 上传图片并插入 */
  const uploadImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "上传失败");
          return;
        }
        editor.chain().focus().setImage({ src: json.url, alt: json.alt ?? "" }).run();
      } catch {
        toast.error("上传失败，请检查网络");
      } finally {
        setUploading(false);
      }
    },
    [editor]
  );

  if (!editor) {
    return (
      <div className="border border-gray-200 rounded-lg min-h-[460px] flex items-center justify-center text-gray-400 text-sm">
        编辑器加载中…
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/60 sticky top-0 z-10">
        <TBtn title="加粗" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </TBtn>
        <TBtn title="斜体" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </TBtn>
        <TBtn title="下划线" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <u>U</u>
        </TBtn>
        <span className="w-px h-5 bg-gray-200 mx-1" />

        <TBtn title="二级标题" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </TBtn>
        <TBtn title="三级标题" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </TBtn>
        <span className="w-px h-5 bg-gray-200 mx-1" />

        <TBtn title="无序列表" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • 列表
        </TBtn>
        <TBtn title="有序列表" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. 列表
        </TBtn>
        <TBtn title="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          引用
        </TBtn>
        <span className="w-px h-5 bg-gray-200 mx-1" />

        <TBtn title="插入链接" active={editor.isActive("link")} onClick={() => setShowLink((v) => !v)}>
          链接
        </TBtn>
        <TBtn title="上传新图片" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <span className="inline-flex items-center gap-1">
            <ImagePlus className="h-3.5 w-3.5" />
            {uploading ? "上传中…" : "上传"}
          </span>
        </TBtn>
        <TBtn title="从图库选择已有图片" onClick={() => setShowPicker(true)}>
          <span className="inline-flex items-center gap-1 text-brand font-medium">
            <Images className="h-3.5 w-3.5" />
            图库
          </span>
        </TBtn>
        <TBtn title="插入视频（B站/YouTube/Vimeo）" onClick={() => setShowVideo((v) => !v)}>
          <span className="inline-flex items-center gap-1">
            <Video className="h-3.5 w-3.5" />
            视频
          </span>
        </TBtn>
        <TBtn
          title="插入表格"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          表格
        </TBtn>
        <TBtn title="分割线" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          —
        </TBtn>
        <span className="w-px h-5 bg-gray-200 mx-1" />

        <TBtn title="撤销" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          ↶
        </TBtn>
        <TBtn title="重做" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          ↷
        </TBtn>
      </div>

      {/* 链接输入 */}
      {showLink && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-indigo-50/40">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://"
            className="field !py-1.5 !text-sm flex-1"
          />
          <button
            type="button"
            className="btn btn-primary !py-1.5 !px-3 text-sm"
            onClick={() => {
              if (linkUrl) editor.chain().focus().setLink({ href: linkUrl }).run();
              setLinkUrl("");
              setShowLink(false);
            }}
          >
            确定
          </button>
          <button
            type="button"
            className="btn btn-secondary !py-1.5 !px-3 text-sm"
            onClick={() => {
              editor.chain().focus().unsetLink().run();
              setShowLink(false);
            }}
          >
            移除
          </button>
        </div>
      )}

      {/* 视频地址输入 */}
      {showVideo && (
        <div className="px-3 py-2 border-b border-gray-100 bg-indigo-50/40">
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="粘贴 B站 / YouTube / Vimeo 视频链接"
              className="field !py-1.5 !text-sm flex-1"
            />
            <button
              type="button"
              className="btn btn-primary !py-1.5 !px-3 text-sm"
              onClick={() => {
                const embed = toEmbedUrl(videoUrl);
                if (!embed) {
                  toast.error("无法识别这个链接，请用 B站 / YouTube / Vimeo 的视频页地址");
                  return;
                }
                // 用 div 包一层，由 CSS 控制响应式 16:9 比例
                editor
                  .chain()
                  .focus()
                  .insertContent(
                    `<div class="video-embed"><iframe src="${embed}" allowfullscreen allow="accelerometer; encrypted-media; picture-in-picture" frameborder="0" referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p></p>`
                  )
                  .run();
                setVideoUrl("");
                setShowVideo(false);
                toast.success("视频已插入");
              }}
            >
              插入
            </button>
            <button
              type="button"
              className="btn btn-secondary !py-1.5 !px-3 text-sm"
              onClick={() => {
                setShowVideo(false);
                setVideoUrl("");
              }}
            >
              取消
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            支持 B站、YouTube、Vimeo。只允许这些平台的视频，其他网页不能嵌入。
          </p>
        </div>
      )}

      {/* 编辑区 */}
      <EditorContent editor={editor} />

      {/* 图库选图 */}
      <MediaPicker
        open={showPicker}
        onOpenChange={setShowPicker}
        onPick={(url, alt) => {
          editor.chain().focus().setImage({ src: url, alt }).run();
          toast.success("已插入图片");
        }}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadImage(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
