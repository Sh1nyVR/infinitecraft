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
const API_KEY = process.env.GEMINI_API_KEY || LOCAL_CONFIG.geminiApiKey;
const MODEL = process.env.GEMINI_MODEL || LOCAL_CONFIG.geminiModel || "gemini-2.0-flash-lite";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || LOCAL_CONFIG.githubToken || "";
const GITHUB_REPO = process.env.GITHUB_REPO || LOCAL_CONFIG.githubRepo || "";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || LOCAL_CONFIG.githubBranch || "main";
const FALLBACK_MODELS = (process.env.GEMINI_MODELS || [
  MODEL,
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
].join(","))
  .split(",")
  .map((s) => s.trim())
  .filter((s, i, a) => s && a.indexOf(s) === i);

if (!API_KEY) {
  console.error("Set GEMINI_API_KEY before starting this proxy.");
  process.exit(1);
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(text);
}

function sendHtml(res, body) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function testPage() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>InfiniteCraft Combine Test</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #151515; color: #f4f4f4; font-family: Arial, sans-serif; }
    main { width: min(720px, calc(100vw - 32px)); }
    h1 { font-size: 24px; margin: 0 0 18px; }
    .row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; }
    input, button { font: inherit; padding: 10px 12px; border-radius: 6px; border: 1px solid #444; }
    input { background: #232323; color: #fff; }
    button { background: #f3c443; color: #171717; border-color: #f3c443; font-weight: 700; cursor: pointer; }
    section { margin-top: 18px; display: grid; grid-template-columns: 160px 1fr; gap: 18px; align-items: start; }
    canvas { width: 160px; height: 160px; image-rendering: pixelated; border: 1px solid #555; background: #222; }
    pre { margin: 0; padding: 14px; overflow: auto; background: #0e0e0e; border: 1px solid #333; border-radius: 6px; min-height: 132px; }
    .status { margin-top: 10px; color: #bdbdbd; min-height: 20px; }
  </style>
  <script src="https://js.puter.com/v2/"></script>
</head>
<body>
  <main>
    <h1>InfiniteCraft Combine Test</h1>
    <div class="row">
      <input id="a" value="Fire" autocomplete="off">
      <input id="b" value="Water" autocomplete="off">
      <button id="go">Combine</button>
    </div>
    <div class="status" id="status"></div>
    <section>
      <canvas id="preview" width="16" height="16"></canvas>
      <pre id="out">Press Combine.</pre>
    </section>
  </main>
  <script>
    const a = document.getElementById("a");
    const b = document.getElementById("b");
    const go = document.getElementById("go");
    const out = document.getElementById("out");
    const status = document.getElementById("status");
    const canvas = document.getElementById("preview");
    const ctx = canvas.getContext("2d");
    window.addEventListener("unhandledrejection", (event) => {
      if (String(event.reason && (event.reason.message || event.reason.error || JSON.stringify(event.reason))).includes("puter")) {
        event.preventDefault();
      }
    });

    function clean(value) {
      return String(value || "").replace(/[^a-zA-Z0-9 _'-]/g, "").trim();
    }

    function cacheKey(x, y) {
      return "infinitecraft.discovery.v3:" + [clean(x).toLowerCase(), clean(y).toLowerCase()].sort().join("+");
    }

    function draw(result) {
      ctx.clearRect(0, 0, 16, 16);
      const colors = result.colors || ["#777"];
      const pixels = result.pixels || [];
      for (let y = 0; y < 16; y++) {
        const row = String(pixels[y] || "").padEnd(16, "0");
        for (let x = 0; x < 16; x++) {
          const idx = parseInt(row.charAt(x), 10) || 0;
          ctx.fillStyle = colors[idx % colors.length] || "#000";
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    function hex(n) {
      n = Math.max(0, Math.min(255, n | 0)).toString(16);
      return n.length < 2 ? "0" + n : n;
    }

    function pixelateImage(img, result) {
      const off = document.createElement("canvas");
      off.width = 16;
      off.height = 16;
      const offCtx = off.getContext("2d", { willReadFrequently: true });
      offCtx.imageSmoothingEnabled = true;
      offCtx.drawImage(img, 0, 0, 16, 16);
      const data = offCtx.getImageData(0, 0, 16, 16).data;
      const palette = [];
      const pixels = [];
      function dist(p, r, g, b) {
        const dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
        return dr * dr + dg * dg + db * db;
      }
      for (let y = 0; y < 16; y++) {
        let row = "";
        for (let x = 0; x < 16; x++) {
          const p = (y * 16 + x) * 4;
          const r = data[p], g = data[p + 1], b = data[p + 2];
          let best = -1, bestDist = Infinity;
          for (let i = 0; i < palette.length; i++) {
            const d = dist(palette[i], r, g, b);
            if (d < bestDist) {
              bestDist = d;
              best = i;
            }
          }
          if (best < 0 || (palette.length < 8 && bestDist > 1800)) {
            palette.push([r, g, b]);
            best = palette.length - 1;
          }
          row += String(best);
        }
        pixels.push(row);
      }
      const first = pixels[0] && pixels[0].charAt(0);
      let blank = true;
      for (const row of pixels) {
        for (let i = 0; i < row.length; i++) {
          if (row.charAt(i) !== first) blank = false;
        }
      }
      if (blank) {
        throw new Error("Puter generated a blank image");
      }
      result.colors = palette.map((p) => "#" + hex(p[0]) + hex(p[1]) + hex(p[2]));
      while (result.colors.length < 2) result.colors.push("#ffffff");
      result.pixels = pixels;
      result.imageDataURL = img.src || "";
      return result;
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
          h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
          const dx = x - 7.5, dy = y - 7.5;
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

    async function generatePuterTexture(result, left, right) {
      if (!window.puter || !puter.ai || !puter.ai.txt2img) {
        return result;
      }
      status.textContent = "Generating pixel art...";
      const prompt = "pixel art 16x16 Minecraft " + result.kind + " icon of " + result.name +
        ", created by combining " + left + " and " + right +
        ", centered, readable silhouette, crisp square pixels, no text, no letters, transparent or simple background";
      const attempts = [
        { model: "black-forest-labs/flux-schnell" },
        { model: "gpt-image-1-mini", quality: "low" },
        true
      ];
      let lastError = null;
      for (const options of attempts) {
        try {
          const img = await Promise.resolve(puter.ai.txt2img(prompt, options));
          return pixelateImage(img, result);
        } catch (e) {
          lastError = e;
        }
      }
      result.puterError = lastError && (lastError.message || lastError.error)
        ? String(lastError.message || lastError.error)
        : JSON.stringify(lastError);
      return fallbackPixels(result);
    }

    async function saveDiscovery(result, left, right) {
      const res = await fetch("/save-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: left, b: right, result })
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.detail || json.error || ("HTTP " + res.status));
        err.response = json;
        throw err;
      }
      return json;
    }

    async function loadModels() {
      try {
        const res = await fetch("/models");
        const json = await res.json();
        if (json.fallbackModels) {
          status.textContent = "Trying: " + json.fallbackModels.join(", ");
        }
      } catch (e) {}
    }

    go.onclick = async () => {
      status.textContent = "Combining...";
      out.textContent = "";
      try {
        const key = cacheKey(a.value, b.value);
        const cached = localStorage.getItem(key);
        if (cached) {
          const json = JSON.parse(cached);
          out.textContent = JSON.stringify(json, null, 2);
          draw(json);
          status.textContent = json.name + " (" + json.kind + ") from cache";
          return;
        }
        const res = await fetch("/combine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ a: a.value, b: b.value })
        });
        let json = await res.json();
        if (!res.ok) throw new Error(json.error || ("HTTP " + res.status));
        json = await generatePuterTexture(json, a.value, b.value);
        localStorage.setItem(key, JSON.stringify(json));
        try {
          await saveDiscovery(json, a.value, b.value);
          json.savedToGitHub = true;
          localStorage.setItem(key, JSON.stringify(json));
        } catch (saveError) {
          json.githubCacheWarning = saveError.message;
          if (saveError.response) {
            json.githubCacheError = saveError.response;
          }
        }
        out.textContent = JSON.stringify(json, null, 2);
        draw(json);
        status.textContent = json.name + " (" + json.kind + ")" + (json.model ? " via " + json.model : "");
      } catch (e) {
        status.textContent = "Failed: " + e.message;
      }
    };
    loadModels();
  </script>
</body>
</html>`;
}

function readBody(req, cb, maxBytes = 65536) {
  let body = "";
  let tooLarge = false;
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > maxBytes) {
      tooLarge = true;
      req.destroy();
    }
  });
  req.on("end", () => {
    if (!tooLarge) cb(body);
  });
}

function cleanName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9 _'-]/g, "")
    .trim()
    .slice(0, 40);
}

function comboKey(a, b) {
  return [cleanName(a).toLowerCase(), cleanName(b).toLowerCase()]
    .sort()
    .join("+")
    .replace(/[^a-z0-9+_-]/g, "");
}

function githubContentPath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function githubRequest(method, path, body, cb) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    cb(new Error("GitHub cache is not configured"));
    return;
  }
  const payload = body ? JSON.stringify(body) : null;
  const req = https.request(
    {
      method,
      hostname: "api.github.com",
      path,
      headers: {
        "User-Agent": "infinitecraft-local-proxy",
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    },
    (res) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch (_) {}
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(text || `GitHub HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          err.responseText = text;
          err.json = json;
          cb(err);
          return;
        }
        cb(null, json);
      });
    }
  );
  req.on("error", cb);
  if (payload) req.write(payload);
  req.end();
}

function githubReadDiscovery(key, cb) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    cb(null, null);
    return;
  }
  const path = `/repos/${GITHUB_REPO}/contents/${githubContentPath(`discoveries/v3/${key}.json`)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  githubRequest("GET", path, null, (err, json) => {
    if (err && err.statusCode === 404) {
      cb(null, null);
      return;
    }
    if (err) {
      cb(err);
      return;
    }
    try {
      const content = Buffer.from(json.content || "", "base64").toString("utf8");
      cb(null, JSON.parse(content));
    } catch (e) {
      cb(e);
    }
  });
}

function githubWriteDiscovery(key, result, cb) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    cb(null);
    return;
  }
  const filePath = `discoveries/v3/${key}.json`;
  const apiPath = `/repos/${GITHUB_REPO}/contents/${githubContentPath(filePath)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const content = Buffer.from(JSON.stringify(result, null, 2)).toString("base64");
  githubRequest("GET", apiPath, null, (readErr, current) => {
    if (readErr && readErr.statusCode !== 404) {
      cb(readErr);
      return;
    }
    githubRequest(
      "PUT",
      `/repos/${GITHUB_REPO}/contents/${githubContentPath(filePath)}`,
      {
        message: `cache ${key}`,
        branch: GITHUB_BRANCH,
        content,
        ...(current && current.sha ? { sha: current.sha } : {}),
      },
      cb
    );
  });
}

function githubWriteTexture(key, imageDataURL, cb) {
  if (!GITHUB_TOKEN || !GITHUB_REPO || !imageDataURL) {
    cb(null);
    return;
  }
  const match = String(imageDataURL).match(/^data:image\/(?:png|webp|jpeg);base64,(.+)$/);
  if (!match) {
    cb(null);
    return;
  }
  const filePath = `textures/v3/${key}.png`;
  const apiPath = `/repos/${GITHUB_REPO}/contents/${githubContentPath(filePath)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  githubRequest("GET", apiPath, null, (readErr, current) => {
    if (readErr && readErr.statusCode !== 404) {
      cb(readErr);
      return;
    }
    githubRequest(
      "PUT",
      `/repos/${GITHUB_REPO}/contents/${githubContentPath(filePath)}`,
      {
        message: `cache texture ${key}`,
        branch: GITHUB_BRANCH,
        content: match[1],
        ...(current && current.sha ? { sha: current.sha } : {}),
      },
      cb
    );
  });
}

function githubSaveCompleteDiscovery(key, result, cb) {
  githubWriteDiscovery(key, result, (jsonErr) => {
    if (jsonErr) {
      cb(jsonErr);
      return;
    }
    githubWriteTexture(key, result.imageDataURL, cb);
  });
}

function fallback(a, b) {
  const seed = `${a} ${b}`.trim() || "Mystery";
  return {
    name: seed
      .split(/\s+/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
      .join(" "),
    kind: "block",
    colors: ["#2b6cb0", "#63b3ed", "#edf2f7", "#1a365d"],
    pixels: [
      "0011110000111100",
      "0122221001222210",
      "1223332112233321",
      "2233332222333322",
      "3332223333322233",
      "3321113333211133",
      "3210002332100023",
      "2100001221000012",
      "1001110110011101",
      "0012221001222100",
      "0123332112333210",
      "1233332223333221",
      "2233223333223332",
      "3322113332211333",
      "3211002332110023",
      "2100001221000012",
    ],
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; ++i) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed) {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
}

function generatePixels(name, kind, colors) {
  let seed = hashString(name + ":" + kind + ":" + colors.join(","));
  const rows = [];
  const blocky = kind !== "item";
  for (let y = 0; y < 16; ++y) {
    let row = "";
    for (let x = 0; x < 16; ++x) {
      seed = rand(seed + x * 31 + y * 131);
      const dx = x - 7.5;
      const dy = y - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let idx;
      if (!blocky && dist > 7.4) {
        idx = 0;
      } else if (blocky && (x === 0 || y === 0 || x === 15 || y === 15)) {
        idx = 2 % colors.length;
      } else {
        const waves = Math.sin((x + (seed & 7)) * 0.7) + Math.cos((y + ((seed >>> 4) & 7)) * 0.65);
        idx = Math.abs(Math.floor(waves * 1.4 + (seed % colors.length))) % colors.length;
      }
      row += String(idx);
    }
    rows.push(row);
  }
  return rows;
}

function pixelsAreBlank(pixels) {
  if (!Array.isArray(pixels) || pixels.length !== 16) return true;
  let first = null;
  for (let y = 0; y < 16; ++y) {
    const row = String(pixels[y] || "");
    if (row.length !== 16) return true;
    for (let x = 0; x < 16; ++x) {
      const ch = row.charAt(x);
      if (first === null) first = ch;
      if (ch !== first) return false;
    }
  }
  return true;
}

function normalizeResult(raw, a, b) {
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch (_) {}
    }
  }
  const out = parsed || fallback(a, b);
  const fb = fallback(a, b);
  out.name = cleanName(out.name) || fb.name;
  out.kind = out.kind === "item" ? "item" : "block";
  out.colors = Array.isArray(out.colors) ? out.colors.slice(0, 8) : fb.colors;
  while (out.colors.length < 2) out.colors.push("#ffffff");
  out.pixels = Array.isArray(out.pixels) ? out.pixels.slice(0, 16) : fb.pixels;
  while (out.pixels.length < 16) out.pixels.push("0".repeat(16));
  out.pixels = out.pixels.map((row) => String(row).replace(/[^0-7]/g, "0").padEnd(16, "0").slice(0, 16));
  if (pixelsAreBlank(out.pixels)) {
    out.pixels = generatePixels(out.name, out.kind, out.colors);
    out.generatedPixels = true;
  }
  return out;
}

function listModels(cb) {
  const req = https.request(
    {
      method: "GET",
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models?key=${encodeURIComponent(API_KEY)}`,
    },
    (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          cb(new Error(body));
          return;
        }
        try {
          const json = JSON.parse(body);
          cb(null, (json.models || [])
            .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.indexOf("generateContent") !== -1)
            .map((m) => m.name.replace(/^models\//, "")));
        } catch (e) {
          cb(e);
        }
      });
    }
  );
  req.on("error", cb);
  req.end();
}

function callGeminiModel(model, a, b, cb) {
  const prompt = `You are the crafting logic for an Infinite Craft style Minecraft mod.
Combine "${a}" and "${b}" into exactly one new discovery.
Think like Infinite Craft: prefer surprising, culturally recognizable, funny, or iconic results over bland literal word mashups.
If the inputs resemble a meme, Gen Z/Gen Alpha slang, game, fandom, character, brand, song, show, phrase, internet trend, or pop-culture reference, use that reference when it clearly fits.
Examples:
- Delta + Rune -> Deltarune
- Skibidi + Toilet -> Skibidi Toilet
- Fanum + Tax -> Fanum Tax
- Ohio + Rizz -> Sigma
- Fire + Water -> Steam
- Earth + Water -> Mud
Avoid simply joining the two input words unless that joined phrase is the actual recognizable result.
For "kind", prefer "block" when the result is a natural material, terrain, plant, ore, wood, stone, building material, furniture, machine, container, structure, or anything that should be placeable in Minecraft.
Use "item" for tools, weapons, food, small handheld objects, abstract concepts, liquids/gases/energy by themselves, media references that should not be placeable, or results that only make sense in an inventory.
Examples:
- Grass + Wood -> block
- Dirt + Stone -> block
- Dirt + Shovel -> item
- Wood + Pickaxe -> item
- Fire + Water -> item
Return only JSON:
{
  "name": "short title case name",
  "kind": "block or item",
  "colors": ["#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB"],
  "pixels": ["16 rows of 16 digits, each digit indexes the colors array"]
}
The pixels must not all be the same digit. Make a simple readable 16x16 icon.
Make blocks placeable physical things. Make abstract, tiny, liquid, energy, or tool-like things items.`;

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.75,
      responseMimeType: "application/json",
    },
  });

  const req = https.request(
    {
      method: "POST",
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(API_KEY)}`,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    },
    (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(body);
          err.statusCode = res.statusCode;
          cb(err);
          return;
        }
        try {
          const json = JSON.parse(body);
          const text = json.candidates[0].content.parts[0].text;
          const result = normalizeResult(text, a, b);
          result.model = model;
          cb(null, result);
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

function callGemini(a, b, cb) {
  let idx = 0;
  let lastError = null;
  function next() {
    if (idx >= FALLBACK_MODELS.length) {
      cb(lastError || new Error("No Gemini models configured"));
      return;
    }
    const model = FALLBACK_MODELS[idx++];
    callGeminiModel(model, a, b, (err, result) => {
      if (!err) {
        cb(null, result);
        return;
      }
      lastError = err;
      if (err.statusCode === 404 || err.statusCode === 429 || err.statusCode === 503) {
        next();
        return;
      }
      cb(err);
    });
  }
  next();
}

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      sendHtml(res, testPage());
      return;
    }
    if (req.method === "GET" && req.url === "/models") {
      listModels((err, models) => {
        if (err) {
          sendJson(res, 502, { error: "models_failed", detail: String(err.message || err) });
          return;
        }
        sendJson(res, 200, { models, fallbackModels: FALLBACK_MODELS });
      });
      return;
    }
    if (req.method === "GET" && req.url === "/config") {
      sendJson(res, 200, {
        githubRepo: GITHUB_REPO || null,
        githubBranch: GITHUB_BRANCH,
        githubEnabled: !!(GITHUB_TOKEN && GITHUB_REPO),
      });
      return;
    }
    if (req.method === "POST" && req.url === "/save-discovery") {
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
        const result = json.result || {};
        if (!a || !b || !result.name || !result.kind) {
          sendJson(res, 400, { error: "missing_discovery" });
          return;
        }
        const key = comboKey(a, b);
        result.cacheKey = key;
        githubSaveCompleteDiscovery(key, result, (err) => {
          if (err) {
            sendJson(res, 502, {
              error: "github_save_failed",
              detail: String(err.message || err),
              statusCode: err.statusCode || null,
              github: err.json || err.responseText || null,
            });
            return;
          }
          sendJson(res, 200, { ok: true, cacheKey: key, githubRepo: GITHUB_REPO || null });
        });
      }, 20 * 1024 * 1024);
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
      const key = comboKey(a, b);
      githubReadDiscovery(key, (cacheErr, cached) => {
        if (cacheErr) {
          sendJson(res, 502, { error: "github_cache_failed", detail: String(cacheErr.message || cacheErr) });
          return;
        }
        if (cached) {
          cached.cached = true;
          cached.cacheKey = key;
          sendJson(res, 200, cached);
          return;
        }
        callGemini(a, b, (err, result) => {
          if (err) {
            sendJson(res, 502, { error: "gemini_failed", detail: String(err.message || err) });
            return;
          }
          result.cacheKey = key;
          githubWriteDiscovery(key, result, (writeErr) => {
            if (writeErr) {
              result.githubCacheWarning = String(writeErr.message || writeErr);
            }
            sendJson(res, 200, result);
          });
        });
      });
    });
  })
  .listen(PORT, () => {
    console.log(`InfiniteCraft Gemini proxy listening at http://localhost:${PORT}/`);
    if (GITHUB_REPO) {
      console.log(`GitHub cache enabled for ${GITHUB_REPO} on ${GITHUB_BRANCH}`);
    }
  });
