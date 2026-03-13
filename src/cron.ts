import { Bindings } from "./types";
import { getTodayEvents } from "./google-calendar";
import { pushMessages } from "./line";
import { getWeather, Location } from "./weather";
import { getHackerNewsTop, getEconomyNews } from "./news";
import { SYSTEM_PROMPT } from "./claude";

export async function handleMorningNotification(env: Bindings): Promise<void> {
  const now = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  // KVから現在地を取得（なければ岐阜がデフォルト）
  let location: Location | undefined;
  try {
    const raw = await env.CHAT_HISTORY.get("location");
    if (raw) location = JSON.parse(raw);
  } catch {
    location = undefined;
  }

  // 並列で全データ取得
  const [weatherMessage, workEvents, privateEvents, aiNews, economyNews] =
    await Promise.all([
      getWeather(location),
      getTodayEvents(env, false),
      getTodayEvents(env, true),
      getHackerNewsTop(env.ANTHROPIC_API_KEY),
      getEconomyNews(env.ANTHROPIC_API_KEY),
    ]);

  const allEvents = [...workEvents, ...privateEvents].sort((a, b) => {
    const aTime = a.start.dateTime || a.start.date;
    const bTime = b.start.dateTime || b.start.date;
    return aTime.localeCompare(bTime);
  });

  // 3つのメッセージに分けて送信
  const msg1 =
    `${SYSTEM_PROMPT(env.USER_NAME)}おはよう！\n\n${now}\n\n${weatherMessage}\n\n` +
    (allEvents.length === 0
      ? "今日の予定はないよ！ゆっくりできるじゃん"
      : `今日の予定（${allEvents.length}件）\n` +
        allEvents
          .map((e: any) => {
            const start = e.start.dateTime
              ? new Date(e.start.dateTime).toLocaleTimeString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "終日";
            const end = e.end?.dateTime
              ? new Date(e.end.dateTime).toLocaleTimeString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            return end
              ? `${start}〜${end} ${e.summary}`
              : `${start} ${e.summary}`;
          })
          .join("\n"));

  const msg2 =
    aiNews.length > 0
      ? `🤖 AI/Techニュース\n` +
        aiNews.map((n) => `・${n.title}\n ${n.url}`).join("\n\n")
      : "🤖 AI/Techニュースは取得できなかったよ";

  const msg3 =
    economyNews.length > 0
      ? `📈 経済ニュース\n` +
        economyNews.map((n) => `・${n.title}\n ${n.url}`).join("\n\n")
      : "📈 経済ニュースは取得できなかったよ";

  await pushMessages(
    env.LINE_USER_ID,
    [msg1, msg2, msg3],
    env.LINE_CHANNEL_ACCESS_TOKEN,
  );
}
