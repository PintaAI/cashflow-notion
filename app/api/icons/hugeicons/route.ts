import { readdir } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"

const iconsDir = join(
  process.cwd(),
  "node_modules/@hugeicons/core-free-icons/dist/esm"
)

let iconNamesCache: string[] | null = null

async function getIconNames() {
  if (iconNamesCache) return iconNamesCache

  const files = await readdir(iconsDir)
  iconNamesCache = files
    .filter((file) => file.endsWith("Icon.js"))
    .map((file) => file.replace(/\.js$/, ""))
    .sort((a, b) => a.localeCompare(b))

  return iconNamesCache
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim().toLowerCase() ?? ""
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0)
  const limit = Math.min(120, Math.max(12, Number(searchParams.get("limit") ?? 60) || 60))

  const iconNames = await getIconNames()
  const filteredIconNames = query
    ? iconNames.filter((name) => name.toLowerCase().includes(query))
    : iconNames
  const items = filteredIconNames.slice(offset, offset + limit)

  return Response.json(
    {
      items,
      total: filteredIconNames.length,
      hasMore: offset + items.length < filteredIconNames.length,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  )
}
