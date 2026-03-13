import { Bindings } from "./types";
import {
  addEvent as addGoogleEvent,
  getTodayEvents,
  searchEvents,
  deleteEvent,
  updateEvent,
} from "./google-calendar";

export const SYSTEM_PROMPT = (name: string) => `おまえは${name}の個人スケジューラー「スケジューラーくん」だ。

口調は友達みたいなフランクでフレンドリーな感じで話してくれ。
丁寧語は使わず、タメ口でOK。絵文字もたまに使っていいぞ。
例：「了解！入れといたよ〜」「今日は予定ないね！自分の時間を最大限有効活用しよう！」

返答はプレーンテキストのみ使用し、マークダウン記法（**太字**、#見出しなど）は使わないでくれ。
予定を削除・更新する前に、必ずget_today_eventsかsearch_google_calendar_eventsで予定を検索して、正確なイベントIDを取得してから実行すること。イベントIDは必ず検索結果から取得すること。絶対に推測や作成したIDを使わないこと。

カレンダー振り分けルール（is_privateの判断基準）：
【仕事用 is_private=false】
- MTG、ミーティング、打ち合わせ、商談、面談、出張、締め切り、納期、勉強会、セミナー、研修など
- 「仕事で」「仕事の」と明示されている場合

【プライベート用 is_private=true】
- 美容院、歯医者、病院、通院、健康診断、散髪など個人的な用事
- 食事、ランチ、ディナー、飲み会など
- 旅行、帰省、買い物など
- 「プライベートで」と明示されている場合
- 仕事に関係しないと判断できる場合はプライベートとして扱う

判断に迷う場合はプライベート（is_private=true）をデフォルトとする。

ツールを使って予定の登録・確認・削除・更新を行ってくれ。
日時はISO8601形式（例：2026-03-11T14:00:00+09:00）で指定すること。
終了時刻が指定されない場合は開始から1時間後にすること。`;

const tools = [
  {
    name: "add_google_calendar_event",
    description:
      "Googleカレンダーに予定を登録する。仕事はis_private=false、プライベートはis_private=true",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "予定のタイトル" },
        start_datetime: {
          type: "string",
          description: "開始日時（ISO8601形式）",
        },
        end_datetime: {
          type: "string",
          description: "終了日時（ISO8601形式）",
        },
        is_private: {
          type: "boolean",
          description: "プライベートの予定はtrue、仕事はfalse",
        },
      },
      required: ["title", "start_datetime", "end_datetime", "is_private"],
    },
  },
  {
    name: "get_today_events",
    description: "今日の予定を両方のカレンダーから取得する",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "search_google_calendar_events",
    description: "Googleカレンダーの予定をキーワードで検索する",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "検索キーワード（例：MTG、歯医者）",
        },
        is_private: {
          type: "boolean",
          description: "プライベートカレンダーを検索する場合はtrue",
        },
      },
      required: ["query", "is_private"],
    },
  },
  {
    name: "delete_google_calendar_event",
    description: "Googleカレンダーの予定を削除する",
    input_schema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "削除するイベントのID" },
        title: {
          type: "string",
          description: "削除する予定のタイトル（確認用）",
        },
        is_private: {
          type: "boolean",
          description: "プライベートカレンダーの予定はtrue",
        },
      },
      required: ["event_id", "title", "is_private"],
    },
  },
  {
    name: "set_location",
    description: "ユーザーの現在地を設定する。今日の天気通知に反映される",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "場所名（例：東京、大阪、名古屋）",
        },
        latitude: { type: "number", description: "緯度" },
        longitude: { type: "number", description: "経度" },
      },
      required: ["name", "latitude", "longitude"],
    },
  },
  {
    name: "update_google_calendar_event",
    description:
      "Googleカレンダーの予定を更新する（時間変更・タイトル変更・色変更・参加者招待）",
    input_schema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "更新するイベントのID" },
        is_private: {
          type: "boolean",
          description: "プライベートの予定はtrue、仕事はfalse",
        },
        title: {
          type: "string",
          description: "新しいタイトル（変更する場合）",
        },
        start_datetime: {
          type: "string",
          description: "新しい開始日時・ISO8601形式（変更する場合）",
        },
        end_datetime: {
          type: "string",
          description: "新しい終了日時・ISO8601形式（変更する場合）",
        },
        color: {
          type: "string",
          description:
            "色（赤・青・緑・黄・紫・オレンジ・水色・グレー・ピンクなど）",
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "招待するメールアドレスのリスト",
        },
      },
      required: ["event_id", "is_private"],
    },
  },
  {
    name: "get_weather",
    description: "指定した場所の今日の天気予報を取得する",
    input_schema: {
      type: "object",
      properties: {
        latitude: { type: "number", description: "緯度" },
        longitude: { type: "number", description: "経度" },
        location_name: { type: "string", description: "場所名" },
      },
      required: ["latitude", "longitude", "location_name"],
    },
  },
];

type Message = {
  role: "user" | "assistant";
  content: any;
};

async function getHistory(userId: string, env: Bindings): Promise<Message[]> {
  try {
    const raw = await env.CHAT_HISTORY.get(userId);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Message[];

    // tool_result や tool_use を含む履歴は強制リセット
    const hasInvalidMessages = parsed.some(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some(
          (c: any) => c.type === "tool_use" || c.type === "tool_result",
        ),
    );

    if (hasInvalidMessages) {
      await env.CHAT_HISTORY.delete(userId);
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

async function saveHistory(
  userId: string,
  messages: Message[],
  env: Bindings,
): Promise<void> {
  // tool_use と tool_result を含むメッセージを除外
  const filtered = messages.filter((m) => {
    if (Array.isArray(m.content)) {
      return !m.content.some(
        (c: any) => c.type === "tool_use" || c.type === "tool_result",
      );
    }
    if (typeof m.content === "string") return true;
    return false;
  });

  // 先頭がtool_resultにならないようにさらにチェック
  const safe = filtered.filter((m) => typeof m.content === "string");

  const trimmed = safe.slice(-10);
  await env.CHAT_HISTORY.put(userId, JSON.stringify(trimmed), {
    expirationTtl: 86400,
  });
}

export async function askClaude(
  userMessage: string,
  userId: string,
  env: Bindings,
): Promise<string> {
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const history = await getHistory(userId, env);

  let messages: Message[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  let replyText = "";

  // tool_useが続く限りループ
  for (let i = 0; i < 5; i++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: `${SYSTEM_PROMPT}\n現在日時：${now}（Asia/Tokyo）`,
        tools,
        messages,
      }),
    });

    const data = (await response.json()) as any;

    if (!data.content || data.content.length === 0) {
      return "ごめん、エラーが発生したよ。もう一度試してみて！";
    }

    if (data.stop_reason === "tool_use") {
      const toolUse = data.content.find((c: any) => c.type === "tool_use");
      const toolResult = await executeTool(toolUse.name, toolUse.input, env);

      messages = [
        ...messages,
        { role: "assistant", content: data.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: toolResult,
            },
          ],
        },
      ];
      continue; // 次のループへ
    }

    // tool_useが終わったら返答
    replyText = data.content[0].text;
    break;
  }

  await saveHistory(
    userId,
    [...messages, { role: "assistant", content: replyText }],
    env,
  );

  return replyText;
}

async function executeTool(
  toolName: string,
  input: any,
  env: Bindings,
): Promise<string> {
  switch (toolName) {
    case "add_google_calendar_event": {
      await addGoogleEvent(
        input.title,
        input.start_datetime,
        input.end_datetime,
        env,
        input.is_private,
      );
      const calendarName = input.is_private
        ? "プライベートカレンダー"
        : "仕事用カレンダー";
      return `${calendarName}に「${input.title}」を登録したよ`;
    }

    case "get_today_events": {
      const workEvents = await getTodayEvents(env, false);
      const privateEvents = await getTodayEvents(env, true);
      const allEvents = [
        ...workEvents.map((e: any) => ({ ...e, _isPrivate: false })),
        ...privateEvents.map((e: any) => ({ ...e, _isPrivate: true })),
      ].sort((a: any, b: any) => {
        const aTime = a.start.dateTime || a.start.date;
        const bTime = b.start.dateTime || b.start.date;
        return aTime.localeCompare(bTime);
      });
      if (allEvents.length === 0) return "今日の予定はないよ";
      return allEvents
        .map((e: any) => {
          const start = e.start.dateTime
            ? new Date(e.start.dateTime).toLocaleTimeString("ja-JP", {
                timeZone: "Asia/Tokyo",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "終日";
          const calendar = e._isPrivate ? "プライベート" : "仕事";
          return `ID:${e.id} / ${start} / ${e.summary} / カレンダー:${calendar} / is_private:${e._isPrivate}`;
        })
        .join("\n");
    }

    case "search_google_calendar_events": {
      const events = await searchEvents(input.query, env, input.is_private);
      if (events.length === 0)
        return `「${input.query}」って予定は見つからなかったよ`;
      return events
        .map((e: any) => {
          const start = e.start.dateTime
            ? new Date(e.start.dateTime).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
              })
            : e.start.date;
          return `ID:${e.id} / ${start} / ${e.summary}`;
        })
        .join("\n");
    }

    case "delete_google_calendar_event": {
      const success = await deleteEvent(input.event_id, env, input.is_private);
      if (!success) {
        return `「${input.title}」の削除に失敗したよ。イベントIDが正しくないかも`;
      }
      return `「${input.title}」消しといたよ`;
    }

    case "set_location": {
      const location = {
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
      };
      // 翌日0時まで保持（今日限り）
      const now = new Date();
      const jstNow = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }),
      );
      const endOfDay = new Date(jstNow);
      endOfDay.setHours(23, 59, 59, 999);
      const ttl = Math.floor((endOfDay.getTime() - jstNow.getTime()) / 1000);
      await env.CHAT_HISTORY.put("location", JSON.stringify(location), {
        expirationTtl: ttl,
      });
      return `場所を${input.name}に設定したよ`;
    }

    case "update_google_calendar_event": {
      await updateEvent(
        input.event_id,
        {
          title: input.title,
          startDatetime: input.start_datetime,
          endDatetime: input.end_datetime,
          color: input.color,
          attendees: input.attendees,
        },
        env,
        input.is_private,
      );
      const updates = [];
      if (input.title) updates.push(`タイトル→「${input.title}」`);
      if (input.start_datetime) updates.push("開始時間変更");
      if (input.end_datetime) updates.push("終了時間変更");
      if (input.color) updates.push(`色→${input.color}`);
      if (input.attendees) updates.push(`${input.attendees.join(", ")} を招待`);
      return `予定を更新したよ（${updates.join("・")}）`;
    }

    case "get_weather": {
      const { getWeather } = await import("./weather");
      const weather = await getWeather({
        name: input.location_name,
        latitude: input.latitude,
        longitude: input.longitude,
      });
      return weather;
    }

    default:
      return "そのツールは見つからなかったよ";
  }
}
