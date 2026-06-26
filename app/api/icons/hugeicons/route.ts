import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

export const runtime = "nodejs"

const iconsDir = join(
  process.cwd(),
  "node_modules/@hugeicons/core-free-icons/dist/esm"
)

let iconNamesCache: string[] | null = null

type IconSvgElement = readonly (readonly [string, { readonly [key: string]: string | number }])[]

function isHugeiconName(name: string) {
  return /^[A-Za-z0-9]+Icon$/.test(name)
}

async function loadIcon(name: string) {
  if (!isHugeiconName(name)) return null

  try {
    const mod = (await import(pathToFileURL(join(iconsDir, `${name}.js`)).href)) as {
      default: IconSvgElement
    }
    return mod.default
  } catch {
    return null
  }
}

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
  const requestedNames = searchParams
    .get("names")
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0)
  const limit = Math.min(120, Math.max(12, Number(searchParams.get("limit") ?? 60) || 60))

  if (requestedNames?.length) {
    const entries = await Promise.all(
      requestedNames.map(async (name) => [name, await loadIcon(name)] as const)
    )

    return Response.json(
      {
        icons: Object.fromEntries(entries.filter(([, icon]) => icon)),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      }
    )
  }

  const iconNames = await getIconNames()
  const filteredIconNames = query
    ? iconNames.filter((name) => name.toLowerCase().includes(query))
    : iconNames
  const items = filteredIconNames.slice(offset, offset + limit)
  const iconEntries = await Promise.all(
    items.map(async (name) => [name, await loadIcon(name)] as const)
  )

  return Response.json(
    {
      items,
      icons: Object.fromEntries(iconEntries.filter(([, icon]) => icon)),
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
