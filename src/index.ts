import { Hono } from "hono";
import { Bindings } from "./types";
import { replyMessage } from "./line";
import { askClaude } from "./claude";
import { handleMorningNotification } from "./cron";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.text("AI秘書 動作中!");
});

app.post("/webhook", async (c) => {
  const body = await c.req.json();

  if (!body.events || body.events.length === 0) {
    return c.json({ status: "ok" });
  }

  const event = body.events[0];

  if (event.type !== "message" || event.message.type !== "text") {
    return c.json({ status: "ok" });
  }

  const userMessage = event.message.text;
  const replyToken = event.replyToken;
  const userId = event.source.userId;

  c.executionCtx.waitUntil(
    (async () => {
      const reply = await askClaude(userMessage, userId, c.env);
      await replyMessage(replyToken, reply, c.env.LINE_CHANNEL_ACCESS_TOKEN);
    })(),
  );

  return c.json({ status: "ok" });
});

// Cronトリガー（毎朝7時JST）
export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Bindings,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(handleMorningNotification(env));
  },
};
