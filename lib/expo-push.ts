import "server-only";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_ENDPOINT = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_BATCH_SIZE = 100;

export interface ExpoPushRecipient {
  token: string;
  id: string;
}

export interface ExpoPushPayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}

export interface ExpoPushTicket {
  id: string;
  status: "ok" | "error";
  message?: string;
  details?: {
    error?:
      | "DeviceNotRegistered"
      | "MessageTooBig"
      | "MessageRateExceeded"
      | string;
  };
}

export interface ExpoPushResult {
  tickets: ExpoPushTicket[];
  recipientCount: number;
  okCount: number;
  errorCount: number;
  deviceNotRegisteredCount: number;
}

function buildExpoMessage(
  recipient: ExpoPushRecipient,
  url: string | undefined,
  dataObj: Record<string, unknown> | undefined,
) {
  const messageData: Record<string, unknown> = { ...dataObj };
  if (url) {
    messageData.url = url;
  }

  return {
    to: recipient.token,
    title: "",
    body: "",
    ...(Object.keys(messageData).length > 0
      ? { data: messageData }
      : {}),
    sound: "default" as const,
  };
}

export async function sendExpoPush(
  recipients: ExpoPushRecipient[],
  payload: ExpoPushPayload,
): Promise<ExpoPushResult> {
  const allTickets: ExpoPushTicket[] = [];

  for (let i = 0; i < recipients.length; i += MAX_BATCH_SIZE) {
    const batch = recipients.slice(i, i + MAX_BATCH_SIZE);

    const messages = batch.map((r) =>
      buildExpoMessage(r, payload.url, payload.data),
    );

    // Set title/body after building so they don't end up in data
    for (let j = 0; j < messages.length; j++) {
      messages[j].title = payload.title;
      messages[j].body = payload.body;
    }

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      throw new Error(
        `Expo Push API returned ${response.status}: ${await response.text()}`,
      );
    }

    const body = (await response.json()) as { data?: ExpoPushTicket[] };
    const batchTickets: ExpoPushTicket[] = (body.data ?? []).map(
      (ticket, index) => ({
        ...ticket,
        id: ticket.id ?? `unknown-${i + index}`,
      }),
    );
    allTickets.push(...batchTickets);
  }

  return {
    tickets: allTickets,
    recipientCount: recipients.length,
    okCount: allTickets.filter((t) => t.status === "ok").length,
    errorCount: allTickets.filter((t) => t.status === "error").length,
    deviceNotRegisteredCount: allTickets.filter(
      (t) => t.details?.error === "DeviceNotRegistered",
    ).length,
  };
}

export interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: {
    error?:
      | "DeviceNotRegistered"
      | "MessageTooBig"
      | "MessageRateExceeded"
      | string;
  };
}

export async function checkExpoReceipts(
  ticketIds: string[],
): Promise<Map<string, ExpoPushReceipt>> {
  const response = await fetch(EXPO_RECEIPTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ ids: ticketIds }),
  });

  if (!response.ok) {
    throw new Error(`Expo Receipt API returned ${response.status}`);
  }

  const body = (await response.json()) as {
    data?: Record<string, ExpoPushReceipt>;
  };
  return new Map(Object.entries(body.data ?? {}));
}

const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;
const PROTOCOL_RELATIVE_RE = /^\/\//;

function isValidInternalUrl(raw: string): boolean {
  if (raw.length > 2000) return false;
  if (CONTROL_CHAR_RE.test(raw)) return false;
  if (PROTOCOL_RELATIVE_RE.test(raw)) return false;

  // Internal relative route starting with a single /
  if (raw.startsWith("/") && !raw.startsWith("//")) return true;

  // Narrow ethos: scheme
  if (raw.startsWith("ethos://") || raw.startsWith("ethos:")) {
    try {
      new URL(raw);
      return true;
    } catch {
      return false;
    }
  }

  // Reject everything else (https://, http://, etc. is not internal)
  return false;
}

export function validateExpoPushPayload(
  payload: ExpoPushPayload,
): string | null {
  const title = payload.title?.trim();
  const body = payload.body?.trim();
  const url = payload.url?.trim();

  if (!title || title.length === 0) return "Title is required";
  if (title.length > 200) return "Title must be 200 characters or less";
  if (!body || body.length === 0) return "Body is required";
  if (body.length > 500) return "Body must be 500 characters or less";
  if (url) {
    if (!isValidInternalUrl(url)) {
      return "URL must be a relative internal path (e.g. /forms/automatic-entry) or ethos:// scheme";
    }
  }

  if (payload.data) {
    const jsonStr = JSON.stringify(payload.data);
    if (jsonStr.length > 4096) return "Data payload too large (max 4 KB)";
  }

  return null;
}
