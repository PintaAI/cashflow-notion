"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import type { Block } from "@blocknote/core"
import { en } from "@blocknote/core/locales"
import { useTheme } from "next-themes"
import "@blocknote/shadcn/style.css"
import { cn } from "@/lib/utils"

type SaveContent = {
  contentJson: string
  html: string
  markdown: string
}

type BlockNoteEditorProps = {
  noteId: string
  initialContent?: string
  onSave?: (content: SaveContent) => Promise<void>
  debounceMs?: number
  editable?: boolean
  className?: string
}

export function BlockNoteEditor({
  noteId,
  initialContent,
  onSave,
  debounceMs = 1000,
  editable = true,
  className,
}: BlockNoteEditorProps) {
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const { resolvedTheme } = useTheme()

  const parsedContent = initialContent
    ? (JSON.parse(initialContent) as Block[])
    : undefined

  const editor = useCreateBlockNote({
    initialContent: parsedContent,
    dictionary: {
      ...en,
      placeholders: {
        ...en.placeholders,
        default: "Ketik teks atau '/' untuk perintah",
        heading: "Judul",
        bulletListItem: "Daftar",
        numberedListItem: "Daftar",
        checkListItem: "Daftar",
        toggleListItem: "Toggle",
      },
    },
    uploadFile: async (file) => {
      const formData = new FormData()
      formData.append("noteId", noteId)
      formData.append("file", file)

      const response = await fetch("/api/notes/files", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(result?.message ?? "Gagal mengupload file.")
      }

      const result = (await response.json()) as { url: string }
      return result.url
    },
  })

  const performSave = useCallback(async () => {
    if (!editor) return
    const blocks = editor.document
    const contentJson = JSON.stringify(blocks)
    const html = await editor.blocksToHTMLLossy(blocks)
    const markdown = await editor.blocksToMarkdownLossy(blocks)
    if (onSave) {
      setSaving(true)
      try {
        await onSave({ contentJson, html, markdown })
      } finally {
        setSaving(false)
      }
    }
  }, [editor, onSave])

  const handleChange = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(performSave, debounceMs)
  }, [performSave, debounceMs])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const blockNoteTheme = resolvedTheme === "dark" ? "dark" : "light"

  return (
    <div
      className={cn(
        "relative bg-transparent text-foreground",
        "cashflow-blocknote",
        "[&_.bn-container]:bg-transparent [&_.bn-container]:text-foreground",
        "[&_.bn-editor]:min-h-[58dvh] [&_.bn-editor]:bg-transparent [&_.bn-editor]:px-0 [&_.bn-editor]:text-foreground sm:[&_.bn-editor]:min-h-[520px] sm:[&_.bn-editor]:px-2",
        "[&_.bn-editor]:font-[var(--font-body)] [&_.bn-editor_*]:font-[var(--font-body)]",
        "[&_.bn-block-content]:text-foreground [&_.bn-inline-content]:text-foreground [&_.bn-toolbar]:font-[var(--font-body)]",
        className
      )}
    >
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        editable={editable}
        theme={blockNoteTheme}
        shadCNComponents={{}}
      />
      {saving && (
        <div className="absolute right-2 top-2">
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
    </div>
  )
}
