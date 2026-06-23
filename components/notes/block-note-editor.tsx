"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import type { Block } from "@blocknote/core"
import "@blocknote/core/fonts/inter.css"
import "@blocknote/shadcn/style.css"
import { cn } from "@/lib/utils"

type SaveContent = {
  contentJson: string
  html: string
  markdown: string
}

type BlockNoteEditorProps = {
  initialContent?: string
  onSave?: (content: SaveContent) => Promise<void>
  debounceMs?: number
  editable?: boolean
  className?: string
}

export function BlockNoteEditor({
  initialContent,
  onSave,
  debounceMs = 1000,
  editable = true,
  className,
}: BlockNoteEditorProps) {
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const parsedContent = initialContent
    ? (JSON.parse(initialContent) as Block[])
    : undefined

  const editor = useCreateBlockNote({
    initialContent: parsedContent,
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

  return (
    <div className={cn("relative", className)}>
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        editable={editable}
        shadCNComponents={{}}
      />
      {saving && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          Saving...
        </div>
      )}
    </div>
  )
}
