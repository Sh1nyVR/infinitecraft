const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.INFINITECRAFT_PROXY_PORT || "8787", 10);
const LOCAL_CONFIG_PATH = path.join(__dirname, "infinitecraft-local-config.json");
let LOCAL_CONFIG = {};
try {
  LOCAL_CONFIG = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, "utf8"));
} catch (_) {}

const API_KEY = process.env.GROQ_API_KEY || LOCAL_CONFIG.groqApiKey || "";
const MODEL = process.env.GROQ_MODEL || LOCAL_CONFIG.groqModel || "llama-3.1-8b-instant";

if (!API_KEY) {
  console.error("Set GROQ_API_KEY or tools/infinitecraft-local-config.json groqApiKey before starting this proxy.");
  process.exit(1);
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(text);
}

function readBody(req, cb, maxBytes = 65536) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > maxBytes) {
      req.destroy();
    }
  });
  req.on("end", () => cb(body));
}

function cleanName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9 _'-]/g, "")
    .trim()
    .slice(0, 40);
}

function fallbackPixels(result) {
  const colors = result.colors && result.colors.length > 1 ? result.colors : ["#d8e8f0", "#ffffff", "#9bb0c0", "#667788"];
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
  result.colors = colors;
  result.pixels = pixels;
  result.generatedPixels = true;
  return result;
}

function normalizeResult(raw, a, b) {
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    const matches = String(raw || "").match(/\{[^{}]*\}/g) || [];
    for (const match of matches) {
      try {
        parsed = JSON.parse(match);
        break;
      } catch (_) {}
    }
  }
  const name = cleanName(parsed && parsed.name) || cleanName(`${a} ${b}`) || "Mystery";
  const kind = parsed && parsed.kind === "item" ? "item" : "block";
  return fallbackPixels({ name, kind, model: MODEL });
}

function groqCombine(a, b, cb) {
  const prompt = `You are the crafting logic for an Infinite Craft style Minecraft mod.
Combine "${a}" and "${b}" into exactly one new discovery.
Think like Infinite Craft: surprising, culturally recognizable, funny, iconic, and aware of memes, Gen Z/Gen Alpha slang, games, fandoms, brands, shows, internet trends.
Examples: Delta + Rune -> Deltarune; Skibidi + Toilet -> Skibidi Toilet; Fanum + Tax -> Fanum Tax; Ohio + Rizz -> Sigma; Fire + Water -> Steam; Earth + Water -> Mud.
Avoid joining words unless that phrase is the real result.
For kind, use "block" for placeable physical things/materials/structures and "item" for tools, food, abstract concepts, liquids/gases/energy, media references, or handheld things.
Respond with exactly one raw json object only. No markdown. No explanation. Schema: {"name":"short title case name","kind":"block or item"}`;

  const payload = JSON.stringify({
    model: MODEL,
    messages: [
      { role: "system", content: "Return only valid json. No markdown. No extra text." },
      { role: "user", content: prompt },
    ],
    temperature: 0.45,
    max_completion_tokens: 80,
  });

  const req = https.request(
    {
      method: "POST",
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "Authorization": `Bearer ${API_KEY}`,
      },
    },
    (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(body || `Groq HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          cb(err);
          return;
        }
        try {
          const json = JSON.parse(body);
          const text = json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : "{}";
          cb(null, normalizeResult(text, a, b));
        } catch (e) {
          cb(e);
        }
      });
    }
  );
  req.on("error", cb);
  req.write(payload);
  req.end();
}

http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }
  if (req.method === "GET" && req.url === "/config") {
    sendJson(res, 200, { model: MODEL, ok: true });
    return;
  }
  if (req.method !== "POST" || req.url !== "/combine") {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  readBody(req, (body) => {
    let json;
    try {
      json = JSON.parse(body);
    } catch (_) {
      sendJson(res, 400, { error: "bad_json" });
      return;
    }
    const a = cleanName(json.a);
    const b = cleanName(json.b);
    if (!a || !b) {
      sendJson(res, 400, { error: "missing_elements" });
      return;
    }
    groqCombine(a, b, (err, result) => {
      if (err) {
        sendJson(res, 502, { error: "groq_failed", detail: String(err.message || err), statusCode: err.statusCode || null });
        return;
      }
      sendJson(res, 200, result);
    });
  });
}).listen(PORT, () => {
  console.log(`InfiniteCraft Groq proxy listening at http://localhost:${PORT}/`);
  console.log(`Using Groq model ${MODEL}`);
});
