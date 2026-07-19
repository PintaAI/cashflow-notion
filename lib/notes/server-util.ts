import { ServerBlockNoteEditor } from "@blocknote/server-util";
import type { Block } from "@blocknote/core";

export async function deriveContentFromJson(
  contentJson: string,
): Promise<{ html: string; markdown: string }> {
  let blocks: Block[];
  try {
    blocks = JSON.parse(contentJson) as Block[];
  } catch {
    throw new Error("contentJson is not valid JSON");
  }

  if (!Array.isArray(blocks)) {
    throw new Error("contentJson is not a valid BlockNote document (expected array)");
  }

  const editor = ServerBlockNoteEditor.create();
  const [html, markdown] = await Promise.all([
    editor.blocksToHTMLLossy(blocks),
    editor.blocksToMarkdownLossy(blocks),
  ]);

  return { html, markdown };
}
