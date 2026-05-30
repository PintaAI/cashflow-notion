import "dotenv/config";

import { Client } from "@notionhq/client";
import { PrismaClient } from "@prisma/client";

import { extractDate, extractNumber, extractSelect, type IOType } from "../lib/notion";

const DATA_SOURCE_ID = "101568ba-726d-4640-b39c-1e80995b0127";

const prisma = new PrismaClient();
const notion = new Client({ auth: process.env.NOTION });

interface NotionEntry {
  id: string;
  name: string;
  nominal: number;
  category: string | null;
  date: string | null;
  io: IOType | null;
  createdAt: Date;
}

interface PageWithProperties {
  id: string;
  created_time?: string;
  properties: Record<string, unknown>;
}

function extractTitle(prop: { type: string; title?: { plain_text?: string }[] } | undefined): string {
  if (!prop || prop.type !== "title") return "";
  return prop.title?.[0]?.plain_text || "";
}

function parsePageToEntry(page: PageWithProperties): NotionEntry {
  const props = page.properties as Record<string, { type: string; [key: string]: unknown }>;

  return {
    id: page.id,
    name: extractTitle(props.Name || props.title),
    nominal: extractNumber(props.Nominal),
    category: extractSelect(props.Category),
    date: extractDate(props.Date),
    io: extractSelect(props["I/O"]) as IOType | null,
    createdAt: page.created_time ? new Date(page.created_time) : new Date(),
  };
}

async function getNotionEntries(): Promise<NotionEntry[]> {
  const entries = new Map<string, NotionEntry>();
  let nextCursor: string | null = null;

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      page_size: 100,
      start_cursor: nextCursor || undefined,
    });

    for (const page of response.results) {
      if ("properties" in page) {
        const entry = parsePageToEntry(page as PageWithProperties);
        entries.set(entry.id, entry);
      }
    }

    nextCursor = response.next_cursor;
  } while (nextCursor);

  return Array.from(entries.values());
}

async function main() {
  console.log("Fetching categories from Notion...");

  const dataSource = await notion.dataSources.retrieve({
    data_source_id: DATA_SOURCE_ID,
  });
  const props = dataSource.properties as Record<string, { select?: { options?: Array<{ name: string; color: string }> } }>;
  const notionCategories = props.Category?.select?.options ?? [];

  const categoryMap = new Map<string, string>();
  for (const opt of notionCategories) {
    const category = await prisma.category.upsert({
      where: { name: opt.name },
      update: { color: opt.color },
      create: { name: opt.name, color: opt.color },
    });
    categoryMap.set(opt.name, category.id);
  }

  console.log(`Synced ${categoryMap.size} categories`);

  const entries = await getNotionEntries();
  console.log(`Found ${entries.length} unique Notion entries`);

  let migrated = 0;
  for (const entry of entries) {
    await prisma.entry.upsert({
      where: { notionId: entry.id },
      update: {
        name: entry.name,
        nominal: entry.nominal,
        categoryId: entry.category ? categoryMap.get(entry.category) ?? null : null,
        date: entry.date,
        io: entry.io,
        createdAt: entry.createdAt,
      },
      create: {
        notionId: entry.id,
        name: entry.name,
        nominal: entry.nominal,
        categoryId: entry.category ? categoryMap.get(entry.category) ?? null : null,
        date: entry.date,
        io: entry.io,
        createdAt: entry.createdAt,
      },
    });

    migrated += 1;
    if (migrated % 50 === 0) {
      console.log(`Migrated ${migrated}/${entries.length} entries`);
    }
  }

  const dbCount = await prisma.entry.count();
  console.log(`Migration complete: ${migrated} processed, ${dbCount} entries in PostgreSQL`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
