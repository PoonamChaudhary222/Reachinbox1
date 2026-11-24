import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import React, { useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onAttachClick?: () => void;
  placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  onAttachClick,
  placeholder = 'Type Your Reply...',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-[#00A838] underline' },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate({ editor: ed }) {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML() && value === '') {
      editor.commands.setContent('');
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter link URL:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const ToolbarBtn = ({
    active,
    onClick,
    title,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded p-1.5 transition-colors ${
        active
          ? 'bg-[#E8F7EE] text-[#00A838]'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-[#FAFAFA]">
      {/* Formatting toolbar matching Figma */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-white px-2.5 py-1.5 rounded-t-lg">
        <ToolbarBtn
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <span className="mx-1 h-4 w-px bg-gray-200" />

        <ToolbarBtn
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading"
        >
          <span className="px-0.5 text-xs font-serif font-semibold">T</span>
        </ToolbarBtn>

        <ToolbarBtn
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <span className="mx-1 h-4 w-px bg-gray-200" />

        <ToolbarBtn
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Align Left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Align Center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Align Right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <span className="mx-1 h-4 w-px bg-gray-200" />

        <ToolbarBtn
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote Block"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <span className="mx-1 h-4 w-px bg-gray-200" />

        <ToolbarBtn active={editor.isActive('link')} onClick={setLink} title="Insert Link">
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        {onAttachClick && (
          <ToolbarBtn onClick={onAttachClick} title="Attach Image / File">
            <ImagePlus className="h-3.5 w-3.5" />
          </ToolbarBtn>
        )}
      </div>

      {/* Editor body */}
      <div className="rounded-b-lg bg-white px-4 py-3 text-[13.5px] text-gray-800">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
