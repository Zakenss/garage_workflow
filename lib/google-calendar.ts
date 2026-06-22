/**
 * Optional Google Calendar sync for seller expert appointments.
 * Configure: GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 */

export type ExpertCalendarInput = {
  vehicleId: string;
  licensePlate: string;
  make: string;
  model: string;
  expertName: string;
  date: string;
  time: string;
  existingEventId?: string | null;
};

export function isGoogleCalendarConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CALENDAR_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

function privateKeyPem(): string {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  return raw.replace(/\\n/g, "\n");
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
    "base64url"
  );
  const claim = Buffer.from(
    JSON.stringify({
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const crypto = await import("crypto");
  const signInput = `${header}.${claim}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signInput)
    .sign(privateKeyPem(), "base64url");

  const jwt = `${signInput}.${signature}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth failed: ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function eventDateTime(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time;
  return `${date}T${t}`;
}

export async function syncExpertAppointmentToCalendar(
  input: ExpertCalendarInput
): Promise<string | null> {
  if (!isGoogleCalendarConfigured()) return null;
  if (!input.date || !input.time || !input.expertName.trim()) return null;

  const token = await getAccessToken();
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!);
  const start = eventDateTime(input.date, input.time);
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const end = endDate.toISOString().slice(0, 19);

  const body = {
    summary: `Expert fin de travaux — ${input.licensePlate}`,
    description: [
      `Véhicule: ${input.licensePlate} (${input.make} ${input.model})`,
      `Expert: ${input.expertName}`,
      `Référence: ${input.vehicleId}`,
    ].join("\n"),
    start: { dateTime: start, timeZone: "Europe/Paris" },
    end: { dateTime: end, timeZone: "Europe/Paris" },
  };

  const base = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

  if (input.existingEventId) {
    const res = await fetch(`${base}/${encodeURIComponent(input.existingEventId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar update failed: ${text}`);
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  const res = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar create failed: ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function deleteExpertCalendarEvent(eventId: string): Promise<void> {
  if (!isGoogleCalendarConfigured() || !eventId) return;
  const token = await getAccessToken();
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Google Calendar delete failed: ${text}`);
  }
}
