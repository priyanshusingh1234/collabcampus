"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import TextAlign from "@tiptap/extension-text-align";
import Mention from "@tiptap/extension-mention";
import CharacterCount from "@tiptap/extension-character-count";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import {
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Eraser,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Table as TableIcon,
  HelpCircle,
  Smile,
  Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import EmojiPicker from "@/components/ui/emoji-picker";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export type SimpleEditorProps = {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  maxChars?: number;
};

const Btn = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }>(
  ({ active, className, children, onMouseDown, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={`flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
        active ? "text-primary border-primary bg-primary/10" : "text-gray-700 dark:text-gray-300"
      } ${className ?? ""}`}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  )
);
Btn.displayName = "Btn";

export function SimpleEditor({ value, onChange, readOnly = false, placeholder, maxChars = 20000 }: SimpleEditorProps) {
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkHref, setLinkHref] = React.useState("");
  const [linkText, setLinkText] = React.useState("");
  const [linkNewTab, setLinkNewTab] = React.useState(true);
  const [linkNofollow, setLinkNofollow] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const emojiMenuRef = React.useRef<HTMLDivElement | null>(null);
  const emojiBtnRef = React.useRef<HTMLButtonElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading.configure({ levels: [1, 2, 3] }),
      Link.configure({ autolink: true, openOnClick: true, linkOnPaste: true }),
      Underline,
      Strike,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Mention.extend({
        name: "mention",
        renderLabel({ options, node }: { options: any; node: any }) {
          const label = node.attrs.label || node.attrs.id || node.attrs.username || "";
          return `${options.suggestion.char}${label}`;
        },
      }).configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          char: "@",
          items: async (ctx: any) => {
            const query = String(ctx?.query ?? "");
            try {
              const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
              const data = await res.json();
              return (data.users || [])
                .slice(0, 5)
                .map((u: any) => ({ id: u.id || u.uid, label: u.username, username: u.username }));
            } catch {
              return [];
            }
          },
        },
      }),
      Mention.extend({ name: "tag" }).configure({
        HTMLAttributes: { class: "hashtag" },
        suggestion: {
          char: "#",
          items: async (ctx: any) => {
            const query = String(ctx?.query ?? "");
            try {
              const res = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
              const data = await res.json();
              return (data.tags || []).slice(0, 8).map((t: string) => ({ id: t, label: t }));
            } catch {
              return [];
            }
          },
        },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
      Placeholder.configure({
        placeholder: placeholder || "Write your post…",
        showOnlyWhenEditable: true,
        includeChildren: true,
      }),
      CharacterCount.configure({ limit: maxChars }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      try {
        localStorage.setItem("draft", html);
      } catch {}
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "focus:outline-none outline-none border-0",
        style: "outline: none; border: 1px solid transparent; box-shadow: none;",
        spellcheck: "false",
        autocapitalize: "off",
        autocomplete: "off",
        autocorrect: "off",
        "data-gramm": "false",
      },
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData("text/html");
        if (!html) return false;
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        tmp.querySelectorAll("*").forEach((el) => {
          [...(el as HTMLElement).attributes].forEach((attr) => {
            if (/^(style|on)/i.test(attr.name)) (el as HTMLElement).removeAttribute(attr.name);
          });
        });
        event.preventDefault();
        const clean = tmp.innerHTML
          .replace(/<span[^>]*font-weight:\s*700[^>]*>(.*?)<\/span>/gi, "<strong>$1</strong>")
          .replace(/<div>/gi, "<p>")
          .replace(/<\/div>/gi, "</p>");
        editor?.chain().focus().insertContent(clean).run();
        return true;
      },
    },
  });

  // Close emoji picker on outside click / Escape
  React.useEffect(() => {
    if (!emojiOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      const inMenu = emojiMenuRef.current?.contains(t);
      const onBtn = emojiBtnRef.current?.contains(t);
      if (!inMenu && !onBtn) setEmojiOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmojiOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

  // Save draft to Firestore subcollection under current user
  async function saveDraft() {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        if (typeof window !== "undefined") alert("Please sign in to save drafts.");
        return;
      }
      const html = editor?.getHTML() || "";
      await addDoc(collection(db, "users", user.uid, "drafts"), {
        contentHtml: html,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (typeof window !== "undefined") alert("Draft saved.");
    } catch (e) {
      if (typeof window !== "undefined") alert("Failed to save draft.");
    }
  }

  // Ctrl/Cmd+S to save draft
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (isSave) {
        e.preventDefault();
        saveDraft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!editor) return;
    if (!value) {
      try {
          const draft = localStorage.getItem("draft");
          if (draft) editor.commands.setContent(draft, { emitUpdate: false });
      } catch {}
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="min-h-[180px] flex items-center justify-center text-muted-foreground">Loading editor…</div>
    );
  }

  function openLinkDialog() {
  if (!editor) return;
  const attrs = editor!.getAttributes("link") as any;
  const { from, to } = editor!.state.selection;
  const selectedText = editor!.state.doc.textBetween(from, to).trim();
    setLinkHref(attrs?.href || "");
    setLinkText(selectedText || "");
    const relStr = (attrs?.rel as string) || "";
    setLinkNewTab(typeof attrs?.target === "string" ? attrs.target === "_blank" : true);
    setLinkNofollow(relStr.split(/\s+/).includes("nofollow"));
    setLinkOpen(true);
  }

  function applyLink() {
  if (!editor) return;
    const href = linkHref.trim();
    const text = linkText.trim();
    if (!href) {
  editor!.chain().focus().unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const attrs: any = { href };
    if (linkNewTab) attrs.target = "_blank";
    const rel: string[] = [];
    if (linkNewTab) rel.push("noopener", "noreferrer");
    if (linkNofollow) rel.push("nofollow");
    if (rel.length) attrs.rel = Array.from(new Set(rel)).join(" ");

  const { empty } = editor!.state.selection;
  const chain = editor!.chain().focus();
    if (empty) {
      chain.setLink(attrs).insertContent(text || href);
    } else {
      chain.extendMarkRange("link").setLink(attrs);
    }
    chain.run();
    setLinkOpen(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <div className="relative flex flex-wrap items-center gap-1 p-2 rounded-full mx-auto bg-white/95 dark:bg-gray-900/95 shadow-md ring-1 ring-black/5 w-fit sticky top-2 z-10">
          {([1, 2, 3] as const).map((level) => (
            <Btn
              key={level}
              active={editor.isActive("heading", { level })}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              aria-label={`Heading ${level}`}
            >
              {level === 1 && <Heading1 size={18} />}
              {level === 2 && <Heading2 size={18} />}
              {level === 3 && <Heading3 size={18} />}
            </Btn>
          ))}

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
            <Bold size={18} />
          </Btn>
          <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
            <Italic size={18} />
          </Btn>
          <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline">
            <UnderlineIcon size={18} />
          </Btn>
          <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} aria-label="Strikethrough">
            <Strikethrough size={18} />
          </Btn>
          <Btn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} aria-label="Inline code">
            <Code size={18} />
          </Btn>

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bulleted list">
            <List size={18} />
          </Btn>
          <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Numbered list">
            <ListOrdered size={18} />
          </Btn>

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Blockquote">
            <Quote size={18} />
          </Btn>
          <Btn active={editor.isActive("link")} onClick={openLinkDialog} aria-label="Add link">
            <LinkIcon size={18} />
          </Btn>

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} aria-label="Align left">
            <AlignLeft size={18} />
          </Btn>
          <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} aria-label="Align center">
            <AlignCenter size={18} />
          </Btn>
          <Btn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} aria-label="Align right">
            <AlignRight size={18} />
          </Btn>

          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

          <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} aria-label="Code block">
            <Code size={18} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} aria-label="Horizontal rule">
            <Minus size={18} />
          </Btn>

          <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} aria-label="Insert table">
            <TableIcon size={18} />
          </Btn>

          <Btn ref={emojiBtnRef as any} onClick={() => setEmojiOpen((v) => !v)} aria-label="Emoji">
            <Smile size={18} />
          </Btn>

          <Btn onClick={saveDraft} aria-label="Save draft" title="Save draft (Ctrl/Cmd+S)">
            <Save size={18} />
          </Btn>

          <Btn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} aria-label="Clear formatting">
            <Eraser size={18} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().undo().run()} aria-label="Undo">
            <Undo2 size={18} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} aria-label="Redo">
            <Redo2 size={18} />
          </Btn>
          <Btn onClick={() => setHelpOpen(true)} aria-label="Help">
            <HelpCircle size={18} />
          </Btn>
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-gray-950 shadow ring-1 ring-black/5">
        <EditorContent
          editor={editor}
          className="tiptap prose prose-base md:prose-lg dark:prose-invert max-w-none leading-7 text-gray-900 dark:text-gray-100 px-6 py-5 min-h-[360px] outline-none focus:outline-none rounded-2xl border-0 focus:border-0 ring-0 focus:ring-0 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:font-semibold prose-headings:leading-tight prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:pl-3"
          style={{ border: "1px solid transparent", outline: "none", boxShadow: "none", backgroundColor: "transparent" }}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          data-gramm="false"
        />
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit link</DialogTitle>
            <DialogDescription>Enter the URL and options. If no text is selected, we'll insert the provided text.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <label className="text-sm font-medium">URL</label>
              <Input
                placeholder="https://example.com"
                value={linkHref}
                onChange={(e) => setLinkHref(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyLink();
                }}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Text</label>
              <Input
                placeholder="Link text (optional)"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyLink();
                }}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox checked={linkNewTab} onCheckedChange={(v) => setLinkNewTab(Boolean(v))} />
                Open in new tab
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox checked={linkNofollow} onCheckedChange={(v) => setLinkNofollow(Boolean(v))} />
                Nofollow
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                editor?.chain().focus().unsetLink().run();
                setLinkOpen(false);
              }}
            >
              Remove
            </Button>
            <Button onClick={applyLink}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {emojiOpen && (
        <div ref={emojiMenuRef} className="absolute z-50 mt-2 right-2 top-12">
          <EmojiPicker
            onSelect={(e) => {
              setEmojiOpen(false);
              editor?.chain().focus().insertContent(e).run();
            }}
          />
        </div>
      )}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>Speed up your writing with these shortcuts.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div>Ctrl/Cmd + B — Bold</div>
            <div>Ctrl/Cmd + I — Italic</div>
            <div>Ctrl/Cmd + U — Underline</div>
            <div>Ctrl/Cmd + K — Link</div>
            <div>Ctrl/Cmd + Shift + 7 — Ordered list</div>
            <div>Ctrl/Cmd + Shift + 8 — Bullet list</div>
            <div>Ctrl/Cmd + Z / Y — Undo / Redo</div>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx>{`
        .tiptap p.is-editor-empty:first-child::before {
          color: rgb(107 114 128);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap { border: 1px solid transparent !important; outline: none !important; box-shadow: none !important; }
        .tiptap * { outline: none !important; }
        .ProseMirror { outline: none !important; border: 1px solid transparent !important; box-shadow: none !important; caret-color: currentColor; }
        .ProseMirror-focused { outline: none !important; }
        .ProseMirror, .ProseMirror * { border: 0 !important; outline: 0 !important; box-shadow: none !important; background: transparent !important; }
        .tiptap > * { border: 0 !important; outline: 0 !important; box-shadow: none !important; background: transparent !important; }
        .mention { color: #2563eb; background: rgba(37,99,235,0.08); padding: 0 2px; border-radius: 3px; }
        .hashtag { color: #16a34a; background: rgba(22,163,74,0.08); padding: 0 2px; border-radius: 3px; }
      `}</style>
      {!readOnly && (
        <div className="text-xs text-muted-foreground text-right mt-1">
          {editor.storage.characterCount?.characters() || 0} / {maxChars} characters
        </div>
      )}
    </div>
  );
}

export default SimpleEditor;
