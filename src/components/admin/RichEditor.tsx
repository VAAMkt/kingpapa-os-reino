import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { uploadBlogImage } from "@/lib/posts";
import { sanitizeLegacyHtml } from "@/lib/sanitize-html";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

const btnCls =
  "px-2 py-1 text-xs font-display uppercase border-2 border-kp-ink bg-kp-cheese shadow-brutal-sm hover:bg-kp-yellow active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50";
const activeCls = "bg-kp-yellow";

export function RichEditor({ value, onChange, placeholder }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Image.configure({ HTMLAttributes: { class: "max-w-full h-auto border-2 border-kp-ink my-3" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Escribe la historia…" }),
    ],
    content: sanitizeLegacyHtml(value || ""),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[300px] px-4 py-3 bg-white border-2 border-kp-ink shadow-brutal-sm focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sincronizar si el valor externo cambia (ej. carga del post)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = sanitizeLegacyHtml(value || "");
    if (incoming && incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return <div className="text-xs">Cargando editor…</div>;

  async function handleImageUpload(file: File) {
    try {
      const url = await uploadBlogImage(file);
      editor?.chain().focus().setImage({ src: url }).run();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function setLink() {
    const prev = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor?.chain().focus().unsetLink().run(); return; }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="space-y-2">
      <Toolbar editor={editor} onPickImage={() => fileRef.current?.click()} onLink={setLink} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageUpload(f);
          e.target.value = "";
        }}
      />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, onPickImage, onLink }: { editor: Editor; onPickImage: () => void; onLink: () => void }) {
  const Btn = ({ on, active, children, title }: { on: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <button type="button" onClick={on} title={title} className={cn(btnCls, active && activeCls)}>
      {children}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1.5 p-2 border-2 border-kp-ink bg-kp-cheese/50">
      <Btn title="Negrita" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>B</Btn>
      <Btn title="Cursiva" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><i>I</i></Btn>
      <Btn title="Tachado" on={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><s>S</s></Btn>
      <span className="w-px bg-kp-ink/30 mx-1" />
      <Btn title="Título H2" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>H2</Btn>
      <Btn title="Subtítulo H3" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>H3</Btn>
      <span className="w-px bg-kp-ink/30 mx-1" />
      <Btn title="Lista" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>•</Btn>
      <Btn title="Lista numerada" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>1.</Btn>
      <Btn title="Cita" on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>“”</Btn>
      <span className="w-px bg-kp-ink/30 mx-1" />
      <Btn title="Enlace" on={onLink} active={editor.isActive("link")}>🔗</Btn>
      <Btn title="Insertar imagen" on={onPickImage}>🖼️</Btn>
      <span className="w-px bg-kp-ink/30 mx-1" />
      <Btn title="Limpiar formato" on={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>✕</Btn>
      <Btn title="Deshacer" on={() => editor.chain().focus().undo().run()}>↶</Btn>
      <Btn title="Rehacer" on={() => editor.chain().focus().redo().run()}>↷</Btn>
    </div>
  );
}
