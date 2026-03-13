const HACKER_NEWS_TOP_URL =
  "https://hacker-news.firebaseio.com/v0/topstories.json";
const HACKER_NEWS_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item";

type NewsItem = {
  title: string;
  url: string;
  originalTitle: string;
};

// Hacker NewsからAI/Tech系トップ5件取得
export async function getHackerNewsTop(apiKey: string): Promise<NewsItem[]> {
  const response = await fetch(HACKER_NEWS_TOP_URL);
  const ids = (await response.json()) as number[];

  // 上位20件から記事を取得してAI/Tech関連をフィルタリング
  const items = await Promise.all(
    ids.slice(0, 20).map(async (id) => {
      const res = await fetch(`${HACKER_NEWS_ITEM_URL}/${id}.json`);
      return (await res.json()) as any;
    }),
  );

  const aiKeywords = [
    "AI",
    "LLM",
    "GPT",
    "Claude",
    "Gemini",
    "ML",
    "machine learning",
    "deep learning",
    "neural",
    "OpenAI",
    "Anthropic",
    "Google",
    "Meta",
    "model",
    "agent",
    "robot",
  ];

  const filtered = items
    .filter(
      (item: any) =>
        item?.url &&
        aiKeywords.some((kw) =>
          item.title?.toLowerCase().includes(kw.toLowerCase()),
        ),
    )
    .slice(0, 5);

  // タイトルを日本語に翻訳
  const translated = await translateTitles(
    filtered.map((i: any) => i.title),
    apiKey,
  );

  return filtered.map((item: any, idx: number) => ({
    title: translated[idx] || item.title,
    url: item.url,
    originalTitle: item.title,
  }));
}

// Google News RSSから経済ニュース5件取得
export async function getEconomyNews(apiKey: string): Promise<NewsItem[]> {
  const query = encodeURIComponent(
    "経済 OR 株価 OR 日経 OR 円相場 OR GDP OR 景気",
  );
  const url = `https://news.google.com/rss/search?q=${query}&hl=ja&gl=JP&ceid=JP:ja`;

  const response = await fetch(url);
  const text = await response.text();

  const items: { title: string; url: string }[] = [];
  const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const content = match[1];

    // タイトル（CDATAなしパターンに対応）
    const titleMatch =
      content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
      content.match(/<title>(.*?)<\/title>/);

    // リンク（Google NewsはlinkタグではなくCBMi...形式のURLをguidに持つ）
    const linkMatch =
      content.match(/<link>(https?:\/\/[^<]+)<\/link>/) ||
      content.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/);

    if (titleMatch && linkMatch && items.length < 5) {
      items.push({
        title: titleMatch[1].trim(),
        url: linkMatch[1].trim(),
      });
    }
  }

  return items.map((item) => ({
    title: item.title,
    url: item.url,
    originalTitle: item.title,
  }));
}

// Claude APIでタイトルを日本語に翻訳
async function translateTitles(
  titles: string[],
  apiKey: string,
): Promise<string[]> {
  if (titles.length === 0) return [];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `以下の英語ニュースタイトルを自然な日本語に翻訳してください。
番号付きリストで返してください。余計な説明は不要です。

${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
        },
      ],
    }),
  });

  const data = (await response.json()) as any;
  const text = data.content[0].text;

  // 番号付きリストをパース
  const lines = text.split("\n").filter((l: string) => l.match(/^\d+\./));
  return lines.map((l: string) => l.replace(/^\d+\.\s*/, "").trim());
}
