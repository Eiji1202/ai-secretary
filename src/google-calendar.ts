import { Bindings } from "./types";

async function getAccessToken(
  refreshToken: string,
  env: Bindings,
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json()) as any;
  return data.access_token;
}

export async function addEvent(
  title: string,
  startDatetime: string,
  endDatetime: string,
  env: Bindings,
  isPrivate: boolean = false,
): Promise<void> {
  const refreshToken = isPrivate
    ? env.GOOGLE_REFRESH_TOKEN_PRIVATE
    : env.GOOGLE_REFRESH_TOKEN_WORK;
  const accessToken = await getAccessToken(refreshToken, env);

  await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        summary: title,
        start: { dateTime: startDatetime, timeZone: "Asia/Tokyo" },
        end: { dateTime: endDatetime, timeZone: "Asia/Tokyo" },
      }),
    },
  );
}

export async function getTodayEvents(
  env: Bindings,
  isPrivate: boolean = false,
): Promise<any[]> {
  const refreshToken = isPrivate
    ? env.GOOGLE_REFRESH_TOKEN_PRIVATE
    : env.GOOGLE_REFRESH_TOKEN_WORK;
  const accessToken = await getAccessToken(refreshToken, env);

  // JSTで今日の0時と23:59:59を計算
  const now = new Date();
  const jstDate = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }),
  );

  const startOfDay = new Date(jstDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(jstDate);
  endOfDay.setHours(23, 59, 59, 999);

  // JSTからUTCに変換（9時間引く）
  const startUTC = new Date(startOfDay.getTime() - 9 * 60 * 60 * 1000);
  const endUTC = new Date(endOfDay.getTime() - 9 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: startUTC.toISOString(),
    timeMax: endUTC.toISOString(),
    timeZone: "Asia/Tokyo",
    singleEvents: "true",
    orderBy: "startTime",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = (await response.json()) as any;
  return data.items || [];
}

export async function searchEvents(
  query: string,
  env: Bindings,
  isPrivate: boolean = false,
): Promise<any[]> {
  const refreshToken = isPrivate
    ? env.GOOGLE_REFRESH_TOKEN_PRIVATE
    : env.GOOGLE_REFRESH_TOKEN_WORK;
  const accessToken = await getAccessToken(refreshToken, env);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    q: query,
    timeMin: todayStart.toISOString(),
    timeMax: oneMonthLater.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = (await response.json()) as any;

  return data.items || [];
}

export async function deleteEvent(
  eventId: string,
  env: Bindings,
  isPrivate: boolean = false,
): Promise<boolean> {
  const refreshToken = isPrivate
    ? env.GOOGLE_REFRESH_TOKEN_PRIVATE
    : env.GOOGLE_REFRESH_TOKEN_WORK;
  const accessToken = await getAccessToken(refreshToken, env);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  return response.status === 204; // 成功は204 No Content
}

export async function updateEvent(
  eventId: string,
  updates: {
    title?: string;
    startDatetime?: string;
    endDatetime?: string;
    color?: string;
    attendees?: string[];
  },
  env: Bindings,
  isPrivate: boolean = false,
): Promise<void> {
  const refreshToken = isPrivate
    ? env.GOOGLE_REFRESH_TOKEN_PRIVATE
    : env.GOOGLE_REFRESH_TOKEN_WORK;
  const accessToken = await getAccessToken(refreshToken, env);

  // 色名をGoogleカレンダーのcolorIdに変換
  const colorMap: Record<string, string> = {
    青: "1",
    ブルー: "1",
    緑: "2",
    グリーン: "2",
    紫: "3",
    パープル: "3",
    赤: "4",
    レッド: "4",
    黄: "5",
    イエロー: "5",
    オレンジ: "6",
    水色: "7",
    シアン: "7",
    グレー: "8",
    濃青: "9",
    ネイビー: "9",
    濃緑: "10",
    ピンク: "11",
  };

  const body: any = {};

  if (updates.title) body.summary = updates.title;
  if (updates.startDatetime)
    body.start = { dateTime: updates.startDatetime, timeZone: "Asia/Tokyo" };
  if (updates.endDatetime)
    body.end = { dateTime: updates.endDatetime, timeZone: "Asia/Tokyo" };
  if (updates.color && colorMap[updates.color])
    body.colorId = colorMap[updates.color];
  if (updates.attendees) {
    body.attendees = updates.attendees.map((email) => ({ email }));
  }

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
  );
}
