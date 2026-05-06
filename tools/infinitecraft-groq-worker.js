export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return json({}, 204);
    }
    if (request.method !== "POST" || url.pathname !== "/combine") {
      return json({ error: "not_found" }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_json" }, 400);
    }

    const a = cleanName(body.a);
    const b = cleanName(body.b);
    if (!a || !b) {
      return json({ error: "missing_elements" }, 400);
    }

    const apiKey = env.GROQ_API_KEY;
    const model = env.GROQ_MODEL || "llama-3.1-8b-instant";
    if (!apiKey) {
      return json({ error: "missing_groq_key" }, 500);
    }

    const prompt = `You are the crafting logic for an Infinite Craft style Minecraft mod.
Combine "${a}" and "${b}" into exactly one new discovery.
Think like Infinite Craft: surprising, culturally recognizable, funny, iconic, and aware of memes, Gen Z/Gen Alpha slang, games, fandoms, brands, shows, internet trends.
Examples: Delta + Rune -> Deltarune; Skibidi + Toilet -> Skibidi Toilet; Fanum + Tax -> Fanum Tax; Ohio + Rizz -> Sigma; Fire + Water -> Steam; Earth + Water -> Mud.
Avoid joining words unless that phrase is the real result.
For kind, use "block" for placeable physical things/materials/structures and "item" for tools, food, abstract concepts, liquids/gases/energy, media references, or handheld things.
Respond with exactly one raw json object only. No markdown. No explanation. Schema: {"name":"short title case name","kind":"block or item"}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Return only valid json. No markdown. No extra text." },
          { role: "user", content: prompt },
        ],
        temperature: 0.45,
        max_completion_tokens: 80,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      return json({ error: "groq_failed", status: response.status, detail: text.slice(0, 500) }, 502);
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

    const result = fallbackPixels({
      name: cleanName(parsed.name) || cleanName(`${a} ${b}`) || "Mystery",
      kind: parsed.kind === "item" ? "item" : "block",
      model,
    });
    return json(result, 200);
  },
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function cleanName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9 _'-]/g, "")
    .trim()
    .slice(0, 40);
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
