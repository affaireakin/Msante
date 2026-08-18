'use client'
import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

function ToolbarButton({ active, onClick, icon, title }: { active?: boolean; onClick: () => void; icon: string; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
      style={{ backgroundColor: active ? '#82d8ff' : 'transparent', color: active ? '#0b1c30' : '#6f787e' }}
    >
      <Icon name={icon} style={{ fontSize: '18px' }} />
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL du lien', previous ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 rounded-t-xl border border-b-0 border-[#bec8ce] bg-[#f8f9ff]">
      <ToolbarButton title="Gras" icon="format_bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton title="Italique" icon="format_italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <span className="w-px h-5 bg-[#bec8ce] mx-1" />
      <ToolbarButton title="Titre" icon="format_h2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <ToolbarButton title="Sous-titre" icon="format_h3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <ToolbarButton title="Paragraphe" icon="notes" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} />
      <span className="w-px h-5 bg-[#bec8ce] mx-1" />
      <ToolbarButton title="Liste à puces" icon="format_list_bulleted" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarButton title="Liste numérotée" icon="format_list_numbered" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <span className="w-px h-5 bg-[#bec8ce] mx-1" />
      <ToolbarButton title="Aligner à gauche" icon="format_align_left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
      <ToolbarButton title="Centrer" icon="format_align_center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
      <ToolbarButton title="Aligner à droite" icon="format_align_right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
      <span className="w-px h-5 bg-[#bec8ce] mx-1" />
      <ToolbarButton title="Lien" icon="link" active={editor.isActive('link')} onClick={setLink} />
    </div>
  )
}

export default function RichTextEditor({ value, onChange, resetKey }: { value: string; onChange: (html: string) => void; resetKey: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'min-h-[260px] px-4 py-3 text-sm text-[#0b1c30] outline-none [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:list-inside [&_ol]:list-decimal [&_ol]:list-inside [&_a]:text-[#82d8ff] [&_a]:underline [&_p]:mb-2',
      },
    },
  })

  // Recharge le contenu quand on change de page (slug) — pas à chaque frappe,
  // pour ne pas faire sauter le curseur pendant la saisie.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, editor])

  if (!editor) return null

  return (
    <div className="rounded-xl overflow-hidden">
      <Toolbar editor={editor} />
      <div className="border border-[#bec8ce] rounded-b-xl bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
