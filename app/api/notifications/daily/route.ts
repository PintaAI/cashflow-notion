import { countEntriesForDate } from "@/lib/db";
import { sendDailyReminder } from "@/lib/notifications";

export const runtime = "nodejs";

const TIMEZONE = process.env.NOTIFICATION_TIMEZONE || "Asia/Jakarta";

function getDateInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to format date for timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = getDateInTimezone(new Date(), TIMEZONE);
    const entryCount = await countEntriesForDate(today);

    if (entryCount > 0) {
      return Response.json({
        sent: false,
        reason: "entries-exist",
        date: today,
        timezone: TIMEZONE,
        entryCount,
      });
    }

    const result = await sendDailyReminder();

    return Response.json({
      notificationTriggered: true,
      date: today,
      timezone: TIMEZONE,
      entryCount,
      ...result,
    });
  } catch (error) {
    return Response.json({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
