import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION,
});

// Database and Data Source IDs
const DATABASE_ID = '120578714dee80feb2a6d1ce23f347a0';
const DATA_SOURCE_ID = '101568ba-726d-4640-b39c-1e80995b0127';
const VIEW_ID = '1e86571b-acea-4b6f-b55d-42f0a34d1017';

// Type definitions for Cashflow properties
export type IOType = 'Income' | 'Expenses';

export type CategoryType =
  | 'sosial'
  | 'keluarga'
  | 'clothing'
  | 'skincare'
  | 'tidak terduga'
  | 'Jajan'
  | 'Transportasi'
  | 'Belanja'
  | 'Tagihan'
  | 'Hiburan'
  | 'Kesehatan'
  | 'Lainnya';

export interface CashflowProperty {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  options?: Array<{ id: string; name: string; color: string }>;
  format?: string;
}

export interface CashflowEntry {
  id: string;
  name: string;
  nominal: number;
  category: CategoryType | null;
  date: string | null;
  io: IOType | null;
}

export interface CashflowSummary {
  totalEntries: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  byCategory: Record<string, number>;
  byIO: Record<string, number>;
}

// Type for page with properties
interface PageWithProperties {
  id: string;
  properties: Record<string, unknown>;
}

/**
 * Get all properties from the Cashflow database with their types and options
 */
export async function getProperties(): Promise<Record<string, CashflowProperty>> {
  const dataSource = await notion.dataSources.retrieve({
    data_source_id: DATA_SOURCE_ID,
  });

  return dataSource.properties as Record<string, CashflowProperty>;
}

/**
 * Get list of available property names with their types
 */
export async function getPropertyList(): Promise<Array<{ name: string; type: string; options?: string[] }>> {
  const properties = await getProperties();
  
  return Object.entries(properties).map(([name, prop]) => ({
    name,
    type: prop.type,
    options: prop.type === 'select' || prop.type === 'multi_select'
      ? prop.options?.map((opt) => opt.name)
      : undefined,
  }));
}

/**
 * Get all entries from the Cashflow database (with pagination and parallel fetching)
 */
export async function getAllEntries(): Promise<CashflowEntry[]> {
  // Create a view query to get all data
  const query = await notion.views.queries.create({
    view_id: VIEW_ID,
  });

  const allPageIds: string[] = [];
  let nextCursor: string | null = null;
  let hasMore = query.total_count > query.results.length;

  // Collect all page IDs first
  allPageIds.push(...query.results.map((r) => r.id));

  // Paginate to get all page IDs
  while (hasMore) {
    const results = await notion.views.queries.results({
      view_id: VIEW_ID,
      query_id: query.id,
      start_cursor: nextCursor || undefined,
      page_size: 100,
    });

    allPageIds.push(...results.results.map((r) => r.id));
    nextCursor = results.next_cursor;
    hasMore = results.has_more;
  }

  // Fetch all pages in parallel with concurrency limit
  const entries: CashflowEntry[] = [];
  const batchSize = 20; // Concurrent requests limit
  
  for (let i = 0; i < allPageIds.length; i += batchSize) {
    const batch = allPageIds.slice(i, i + batchSize);
    const pages = await Promise.all(
      batch.map((id) => notion.pages.retrieve({ page_id: id }))
    );
    
    for (const page of pages) {
      if ('properties' in page) {
        entries.push(parsePageToEntry(page as PageWithProperties));
      }
    }
  }

  return entries;
}

/**
 * Get summary statistics from the same data source used by the table.
 *
 * Do not rely on the view query total_count here: the table reads from the
 * data source directly, and view query pagination can drift from what the
 * table actually loads. Paginating the data source also lets us compute count
 * and sums from one consistent result set.
 */
export async function getSummary(): Promise<CashflowSummary> {
  const summary: CashflowSummary = {
    totalEntries: 0,
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    byCategory: {},
    byIO: { Income: 0, Expenses: 0 },
  };

  let nextCursor: string | null = null;

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      page_size: 100,
      start_cursor: nextCursor || undefined,
    });

    for (const page of response.results) {
      if ('properties' in page) {
        const props = (page as PageWithProperties).properties as Record<string, { type: string; [key: string]: unknown }>;
        
        // Extract only what we need for summary
        const nominalProp = props['Nominal'];
        const ioProp = props['I/O'];
        const categoryProp = props['Category'];
        
        const nominal = extractNumber(nominalProp);
        const io = extractSelect(ioProp);
        const category = extractSelect(categoryProp);

        summary.totalEntries += 1;
        
        if (io === 'Income') {
          summary.totalIncome += nominal;
          summary.byIO.Income += nominal;
        } else if (io === 'Expenses') {
          summary.totalExpenses += nominal;
          summary.byIO.Expenses += nominal;
        }
        
        if (category) {
          summary.byCategory[category] = (summary.byCategory[category] || 0) + nominal;
        }
      }
    }

    nextCursor = response.next_cursor;
  } while (nextCursor);

  summary.balance = summary.totalIncome - summary.totalExpenses;
  return summary;
}

/**
 * Get entries with pagination
 */
export async function getEntries(options?: {
  pageSize?: number;
  startCursor?: string;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  const pageSize = options?.pageSize || 100;
  
  const query = await notion.views.queries.create({
    view_id: VIEW_ID,
  });

  // Get view query results with pagination - need both view_id and query_id
  const results = await notion.views.queries.results({
    view_id: VIEW_ID,
    query_id: query.id,
    page_size: pageSize,
    start_cursor: options?.startCursor,
  });

  const entries: CashflowEntry[] = [];
  
  for (const pageRef of results.results) {
    const page = await notion.pages.retrieve({
      page_id: pageRef.id,
    });
    
    if ('properties' in page) {
      entries.push(parsePageToEntry(page as PageWithProperties));
    }
  }

  return {
    entries,
    nextCursor: results.next_cursor,
    hasMore: results.has_more,
  };
}

/**
 * Count total entries in the database
 */
export async function countEntries(): Promise<number> {
  let total = 0;
  let nextCursor: string | null = null;

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      page_size: 100,
      start_cursor: nextCursor || undefined,
    });

    total += response.results.length;
    nextCursor = response.next_cursor;
  } while (nextCursor);

  return total;
}

/**
 * Get entries with pagination and optional I/O filter
 * Uses native Notion data source query with filter support
 */
export async function getEntriesFiltered(options?: {
  pageSize?: number;
  startCursor?: string;
  io?: IOType;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  const pageSize = options?.pageSize || 20;
  
  // Build filter if I/O is specified - use native Notion filter
  const filter = options?.io ? {
    property: 'I/O',
    select: {
      equals: options.io,
    },
  } : undefined;

  // Query the data source directly with native filter and pagination
  const response = await notion.dataSources.query({
    data_source_id: DATA_SOURCE_ID,
    filter: filter,
    page_size: pageSize,
    start_cursor: options?.startCursor,
  });

  const entries: CashflowEntry[] = [];
  
  // Parse pages directly from response - no need to fetch each page separately
  for (const page of response.results) {
    if ('properties' in page) {
      entries.push(parsePageToEntry(page as PageWithProperties));
    }
  }

  return {
    entries,
    nextCursor: response.next_cursor,
    hasMore: response.has_more,
  };
}

/**
 * Get entries filtered by I/O type (Income or Expenses) with pagination
 */
export async function getEntriesByIOPaginated(ioType: IOType, options?: {
  pageSize?: number;
  startCursor?: string;
}): Promise<{ entries: CashflowEntry[]; nextCursor: string | null; hasMore: boolean }> {
  return getEntriesFiltered({
    pageSize: options?.pageSize,
    startCursor: options?.startCursor,
    io: ioType,
  });
}

/**
 * Create a new cashflow entry
 */
export async function createEntry(data: {
  name: string;
  nominal: number;
  category?: CategoryType;
  date?: string;
  io?: IOType;
}): Promise<CashflowEntry> {
  // Build properties object
  const properties = {
    Name: {
      title: [{ text: { content: data.name } }],
    },
    Nominal: {
      number: data.nominal,
    },
    ...(data.category && {
      Category: {
        select: { name: data.category },
      },
    }),
    ...(data.date && {
      Date: {
        date: { start: data.date },
      },
    }),
    ...(data.io && {
      'I/O': {
        select: { name: data.io },
      },
    }),
  };

  const page = await notion.pages.create({
    parent: {
      database_id: DATABASE_ID,
    },
    properties,
  });

  if ('properties' in page) {
    return parsePageToEntry(page as PageWithProperties);
  }

  // Return a minimal entry if we don't have full properties
  return {
    id: page.id,
    name: data.name,
    nominal: data.nominal,
    category: data.category || null,
    date: data.date || null,
    io: data.io || null,
  };
}

/**
 * Update an existing cashflow entry
 */
export async function updateEntry(
  pageId: string,
  data: Partial<{
    name: string;
    nominal: number;
    category: CategoryType;
    date: string;
    io: IOType;
  }>
): Promise<CashflowEntry> {
  const properties = {
    ...(data.name && {
      Name: {
        title: [{ text: { content: data.name } }],
      },
    }),
    ...(data.nominal !== undefined && {
      Nominal: {
        number: data.nominal,
      },
    }),
    ...(data.category && {
      Category: {
        select: { name: data.category },
      },
    }),
    ...(data.date && {
      Date: {
        date: { start: data.date },
      },
    }),
    ...(data.io && {
      'I/O': {
        select: { name: data.io },
      },
    }),
  };

  const page = await notion.pages.update({
    page_id: pageId,
    properties,
  });

  if ('properties' in page) {
    return parsePageToEntry(page as PageWithProperties);
  }

  // Return a minimal entry if we don't have full properties
  return {
    id: page.id,
    name: data.name || '',
    nominal: data.nominal || 0,
    category: data.category || null,
    date: data.date || null,
    io: data.io || null,
  };
}

/**
 * Delete a cashflow entry (archive it)
 */
export async function deleteEntry(pageId: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    in_trash: true,
  });
}

/**
 * Helper function to parse a Notion page to CashflowEntry
 */
function parsePageToEntry(page: PageWithProperties): CashflowEntry {
  const props = page.properties as Record<string, { type: string; [key: string]: unknown }>;
  
  // Find properties by name
  const nameProp = props['Name'] || props['title'];
  const nominalProp = props['Nominal'];
  const categoryProp = props['Category'];
  const dateProp = props['Date'];
  const ioProp = props['I/O'];

  return {
    id: page.id,
    name: extractTitle(nameProp),
    nominal: extractNumber(nominalProp),
    category: extractSelect(categoryProp) as CategoryType | null,
    date: extractDate(dateProp),
    io: extractSelect(ioProp) as IOType | null,
  };
}

function extractTitle(prop: { type: string; title?: { plain_text?: string }[] } | undefined): string {
  if (!prop || prop.type !== 'title') return '';
  return prop.title?.[0]?.plain_text || '';
}

function extractNumber(prop: { type: string; number?: number } | undefined): number {
  if (!prop || prop.type !== 'number') return 0;
  return prop.number || 0;
}

function extractSelect(prop: { type: string; select?: { name?: string } } | undefined): string | null {
  if (!prop || prop.type !== 'select') return null;
  return prop.select?.name || null;
}

function extractDate(prop: { type: string; date?: { start?: string } } | undefined): string | null {
  if (!prop || prop.type !== 'date') return null;
  return prop.date?.start || null;
}

// Export the notion client for advanced usage
export { notion, DATABASE_ID, DATA_SOURCE_ID, VIEW_ID };
