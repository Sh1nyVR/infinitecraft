function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function cleanName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9 _'-]/g, "")
    .trim()
    .slice(0, 40);
}

function fallbackPixels(result) {
  const colors = ["#d8e8f0", "#ffffff", "#9bb0c0", "#667788"];
  const pixels = [];
  let h = 2166136261;
  const seed = result.name + ":" + result.kind;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let y = 0; y < 16; y++) {
    let row = "";
    for (let x = 0; x < 16; x++) {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      const dx = x - 7.5;
      const dy = y - 7.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      row += String(result.kind !== "block" && d > 7.4 ? 0 : Math.abs(h + x * 3 + y * 7) % colors.length);
    }
    pixels.push(row);
  }
  return { ...result, colors, pixels, generatedPixels: true };
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  let body;
  try {
    body = await readJson(req);
  } catch {
    json(res, 400, { error: "bad_json" });
    return;
  }

  const a = cleanName(body.a);
  const b = cleanName(body.b);
  if (!a || !b) {
    json(res, 400, { error: "missing_elements" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY || "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";
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  if (!apiKey) {
    json(res, 500, { error: "missing_groq_key" });
    return;
  }

  const prompt = `You are the crafting logic for an Infinite Craft style Minecraft mod.
Combine "${a}" and "${b}" into exactly one new discovery.
Think like Infinite Craft: surprising, culturally recognizable, funny, iconic, and aware of memes, Gen Z/Gen Alpha slang, games, fandoms, brands, shows, internet trends.
Examples: Delta + Rune -> Deltarune; Skibidi + Toilet -> Skibidi Toilet; Fanum + Tax -> Fanum Tax; Ohio + Rizz -> Sigma; Fire + Water -> Steam; Earth + Water -> Mud.
Avoid joining words unless that phrase is the real result.
For kind, use "block" for placeable physical things/materials/structures and "item" for tools, food, abstract concepts, liquids/gases/energy, media references, or handheld things.
Respond with exactly one raw json object only. No markdown. No explanation. Schema: {"name":"short title case name","kind":"block or item"}`;

  const groq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Return only valid json. No markdown. No extra text." },
        { role: "user", content: prompt }
      ],
      temperature: 0.45,
      max_completion_tokens: 80,
    }),
  });

  const text = await groq.text();
  if (!groq.ok) {
    json(res, 502, { error: "groq_failed", status: groq.status, detail: text.slice(0, 500) });
    return;
  }

  let parsed;
  try {
    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content || "{}";
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = parseFirstJsonObject(content);
    }
  } catch {
    parsed = {};
  }

  json(res, 200, fallbackPixels({
    name: cleanName(parsed.name) || cleanName(`${a} ${b}`) || "Mystery",
    kind: parsed.kind === "item" ? "item" : "block",
    model,
  }));
}

function parseFirstJsonObject(text) {
  const matches = String(text || "").match(/\{[^{}]*\}/g) || [];
  for (const match of matches) {
    try {
      return JSON.parse(match);
    } catch {}
  }
  return {};
}
