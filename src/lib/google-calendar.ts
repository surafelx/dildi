import { google } from "googleapis";

/**
 * Google Calendar via a pre-configured service account.
 * Decodes a base64 service-account JSON key from env.
 */
function getAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!b64 || !email) throw new Error("Google service account not configured");
  const keyJson = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  return new google.auth.JWT({
    email,
    key: keyJson.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

function calendarClient() {
  return google.calendar({ version: "v3", auth: getAuth() });
}

const CAL_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

export interface GCalEvent {
  googleEventId: string;
  title: string;
  start: Date;
  end: Date | null;
  location: string | null;
}

export async function listUpcomingEvents(maxResults = 50): Promise<GCalEvent[]> {
  const cal = calendarClient();
  const res = await cal.events.list({
    calendarId: CAL_ID,
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items ?? []).map((e) => ({
    googleEventId: e.id!,
    title: e.summary ?? "(untitled)",
    start: new Date(e.start?.dateTime ?? e.start?.date ?? Date.now()),
    end: e.end?.dateTime || e.end?.date ? new Date(e.end?.dateTime ?? e.end?.date!) : null,
    location: e.location ?? null,
  }));
}

export async function createEvent(opts: {
  title: string;
  start: Date;
  end: Date;
  description?: string;
}): Promise<string> {
  const cal = calendarClient();
  const res = await cal.events.insert({
    calendarId: CAL_ID,
    requestBody: {
      summary: opts.title,
      description: opts.description,
      start: { dateTime: opts.start.toISOString() },
      end: { dateTime: opts.end.toISOString() },
    },
  });
  return res.data.id!;
}
