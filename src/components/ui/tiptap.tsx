"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import UnderlineExt from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";

import {
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Undo2,
  Redo2,
  Eraser,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Maximize2,
  Minimize2,
  Code2,
  IndentDecrease,
  IndentIncrease,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TiptapEditorProps {
  value: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

const ToolbarButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
> = ({ active, className, children, onMouseDown, ...props }) => (
  <button
    type="button"
    className={`flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
      active ? "text-primary border-primary bg-primary/10" : "text-gray-600 dark:text-gray-300"
    } ${className ?? ""}`}
    aria-pressed={active}
    onMouseDown={(e) => { e.preventDefault(); onMouseDown?.(e); }}
    {...props}
  >
    {children}
  </button>
);

export function TiptapEditor({ value, onChange, readOnly = false, placeholder }: TiptapEditorProps) {
  const [charCount, setCharCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCodeView, setIsCodeView] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading.configure({ levels: [1, 2, 3] }),
      Link.configure({ autolink: true, openOnClick: true }),
      UnderlineExt,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder: placeholder || "Write your post…",
        showOnlyWhenEditable: true,
        includeChildren: true,
      }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      try {
        setCharCount(editor.getText().length);
      } catch {
        setCharCount(0);
      }
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none outline-none border-0',
        style: 'outline: none; border: 0; box-shadow: none;'
      }
    },
    immediatelyRender: false,
  });

  const containerCls = useMemo(
    () =>
      "flex flex-col rounded-xl shadow-sm bg-transparent",
    []
  );
  // When exiting code view, push latest value into the editor
  useEffect(() => {
    if (!isCodeView && editor) {
      editor.commands.setContent(value || "", { emitUpdate: true });
    }
  }, [isCodeView, editor, value]);

  if (!editor) {
    return (
      <div className="min-h-[200px] flex items-center justify-center text-gray-500">
        Loading editor...
      </div>
    );
  }

  return (
    <div className={
      `${containerCls} ${isFullscreen ? "fixed inset-0 z-[60] bg-gradient-to-b from-rose-100/60 to-transparent dark:from-sky-900/40" : ""}`
    }>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 p-2 rounded-full mx-auto mt-3 bg-white/95 dark:bg-gray-900/95 shadow-md ring-1 ring-black/5 w-fit sticky top-2 z-10">
          {([1, 2, 3] as (1 | 2 | 3)[]).map((level) => (
            <ToolbarButton
              key={level}
              active={editor.isActive("heading", { level })}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              aria-label={`Toggle heading ${level}`}
            >
              {level === 1 && <Heading1 size={20} />}
              {level === 2 && <Heading2 size={20} />}
              {level === 3 && <Heading3 size={20} />}
            </ToolbarButton>
          ))}

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
            <Bold size={18} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
            <Italic size={18} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline">
            <UnderlineIcon size={18} />
          </ToolbarButton>

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <ToolbarButton active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} aria-label="Align left">
            <AlignLeft size={18} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} aria-label="Align center">
            <AlignCenter size={18} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} aria-label="Align right">
            <AlignRight size={18} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} aria-label="Align justify">
            <AlignJustify size={18} />
          </ToolbarButton>

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list">
            <List size={18} />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Ordered list">
            <ListOrdered size={18} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().sinkListItem('listItem').run()} aria-label="Indent">
            <IndentIncrease size={18} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().liftListItem('listItem').run()} aria-label="Outdent">
            <IndentDecrease size={18} />
          </ToolbarButton>

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Blockquote">
            <Quote size={18} />
          </ToolbarButton>

          <Popover>
            <PopoverTrigger asChild>
              <ToolbarButton active={editor.isActive("link")} aria-label="Add or edit link">
                <LinkIcon size={18} />
              </ToolbarButton>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" side="bottom" align="start">
              <div className="space-y-2">
                <Input
                  placeholder="https://example.com"
                  defaultValue={editor.getAttributes("link").href || ""}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const href = (e.target as HTMLInputElement).value.trim();
                      if (!href) {
                        editor.chain().focus().unsetLink().run();
                      } else {
                        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const href = (e.target as HTMLInputElement).value.trim();
                    if (href) {
                      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={(e) => {
                      const input = (e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement);
                      const href = input?.value?.trim();
                      if (!href) {
                        editor.chain().focus().unsetLink().run();
                      } else {
                        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
                      }
                    }}
                  >
                    Apply
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => editor.chain().focus().unsetLink().run()}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} aria-label="Remove link">
            <X size={18} />
          </ToolbarButton>

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} aria-label="Clear formatting">
            <Eraser size={18} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} aria-label="Undo">
            <Undo2 size={18} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} aria-label="Redo">
            <Redo2 size={18} />
          </ToolbarButton>

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <ToolbarButton
            onClick={() => {
              setIsCodeView((v) => !v);
            }}
            aria-label="Code view"
            active={isCodeView}
          >
            <Code2 size={18} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setIsFullscreen((v) => !v)}
            aria-label="Fullscreen"
            active={isFullscreen}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </ToolbarButton>
        </div>
      )}

      {isCodeView ? (
        <textarea
          className="w-full min-h-[360px] px-4 py-3 rounded-xl font-mono text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 outline-none shadow-sm"
          value={editor.getHTML()}
          onChange={(e) => {
            const html = e.target.value;
            onChange(html);
            setCharCount(html.length);
          }}
        />
      ) : (
    <div className="rounded-2xl bg-white dark:bg-gray-950 shadow ring-1 ring-black/5">
          <EditorContent
            editor={editor}
            className="tiptap prose prose-base md:prose-lg dark:prose-invert max-w-none leading-7 text-gray-900 dark:text-gray-100 px-6 py-5 min-h-[420px] outline-none focus:outline-none rounded-2xl border-0 focus:border-0 ring-0 focus:ring-0 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:font-semibold prose-headings:leading-tight prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:pl-3"
            style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
          />
        </div>
      )}
      {!readOnly && (
        <div className="flex items-center justify-end px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
          Characters: {charCount}
        </div>
      )}
      <style jsx>{`
        .tiptap p.is-editor-empty:first-child::before {
          color: rgb(107 114 128);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
    .tiptap { border: none !important; outline: none !important; box-shadow: none !important; }
    .tiptap * { outline: none !important; }
  .ProseMirror { outline: none !important; border: 0 !important; box-shadow: none !important; caret-color: currentColor; }
  .ProseMirror-focused { outline: none !important; }
      `}</style>
    </div>
  );
}
