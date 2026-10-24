"use client";

import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Underline as UnderlineIcon,
  Undo,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

export type EditorLabels = {
  toolbar: string;
  bold: string;
  italic: string;
  underline: string;
  heading: string;
  subheading: string;
  bulletList: string;
  orderedList: string;
  quote: string;
  link: string;
  linkPrompt: string;
  unlink: string;
  image: string;
  undo: string;
  redo: string;
  imageNeedsSave: string;
};

type Props = {
  id: string;
  value: string;
  onChange: (html: string) => void;
  labels: EditorLabels;
  lang: "en" | "bn";
  invalid?: boolean;
  describedBy?: string;
  /** Uploads an image and returns its public URL, or null when it failed (the caller shows why). */
  onUploadImage?: (file: File) => Promise<string | null>;
};

const SAFE_LINK = /^(https:\/\/|mailto:|tel:|\/)/;

/** Rich text editor (Tiptap). The HTML it produces is sanitised again on the server. */
export function RichTextEditor({
  id,
  value,
  onChange,
  labels,
  lang,
  invalid,
  describedBy,
  onUploadImage,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ["https", "mailto", "tel"],
        },
      }),
      Image,
    ],
    content: value,
    editorProps: {
      attributes: {
        id,
        lang,
        role: "textbox",
        "aria-labelledby": `${id}-label`,
        "aria-multiline": "true",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        class: "rich-text min-h-60 px-3 py-2 outline-none",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
          }
        : null,
  });

  if (!editor)
    return (
      <div
        className="bg-muted/30 min-h-72 rounded-md border"
        aria-busy="true"
      />
    );

  const chain = () => editor.chain().focus();
  const buttons: {
    label: string;
    Icon: LucideIcon;
    run: () => void;
    pressed?: boolean;
  }[] = [
    {
      label: labels.bold,
      Icon: Bold,
      run: () => chain().toggleBold().run(),
      pressed: state?.bold,
    },
    {
      label: labels.italic,
      Icon: Italic,
      run: () => chain().toggleItalic().run(),
      pressed: state?.italic,
    },
    {
      label: labels.underline,
      Icon: UnderlineIcon,
      run: () => chain().toggleUnderline().run(),
      pressed: state?.underline,
    },
    {
      label: labels.heading,
      Icon: Heading2,
      run: () => chain().toggleHeading({ level: 2 }).run(),
      pressed: state?.h2,
    },
    {
      label: labels.subheading,
      Icon: Heading3,
      run: () => chain().toggleHeading({ level: 3 }).run(),
      pressed: state?.h3,
    },
    {
      label: labels.bulletList,
      Icon: List,
      run: () => chain().toggleBulletList().run(),
      pressed: state?.bullet,
    },
    {
      label: labels.orderedList,
      Icon: ListOrdered,
      run: () => chain().toggleOrderedList().run(),
      pressed: state?.ordered,
    },
    {
      label: labels.quote,
      Icon: Quote,
      run: () => chain().toggleBlockquote().run(),
      pressed: state?.quote,
    },
    {
      label: labels.link,
      Icon: LinkIcon,
      run: () => {
        const href = window.prompt(
          labels.linkPrompt,
          editor.getAttributes("link").href ?? "https://",
        );
        if (href && SAFE_LINK.test(href))
          chain().extendMarkRange("link").setLink({ href }).run();
      },
      pressed: state?.link,
    },
    {
      label: labels.unlink,
      Icon: Unlink,
      run: () => chain().unsetLink().run(),
    },
    {
      label: onUploadImage ? labels.image : labels.imageNeedsSave,
      Icon: ImagePlus,
      run: () =>
        onUploadImage
          ? fileRef.current?.click()
          : window.alert(labels.imageNeedsSave),
    },
    { label: labels.undo, Icon: Undo, run: () => chain().undo().run() },
    { label: labels.redo, Icon: Redo, run: () => chain().redo().run() },
  ];

  return (
    <div
      className={cn(
        "bg-background rounded-md border",
        invalid && "border-destructive",
      )}
    >
      <div
        role="toolbar"
        aria-label={labels.toolbar}
        aria-controls={id}
        className="flex flex-wrap gap-0.5 border-b p-1"
      >
        {buttons.map(({ label, Icon, run, pressed }) => (
          <button
            key={label}
            type="button"
            onClick={run}
            aria-label={label}
            title={label}
            aria-pressed={pressed === undefined ? undefined : pressed}
            className={cn(
              "hover:bg-accent focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded outline-none focus-visible:ring-[3px]",
              pressed && "bg-accent text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || !onUploadImage) return;
          const url = await onUploadImage(file);
          if (url) chain().setImage({ src: url, alt: "" }).run();
        }}
      />
    </div>
  );
}
