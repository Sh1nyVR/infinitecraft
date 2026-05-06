# InfiniteCraft AI Proxy

```powershell
$env:GEMINI_API_KEY="your-rotated-key-here"
node .\tools\infinitecraft-gemini-proxy.js
```

Open the test UI at:

```text
http://localhost:8787/
```

The game-side client can send:

```json
{ "a": "Fire", "b": "Water" }
```

to:

```text
http://localhost:8787/combine
```

and receives:

```json
{
  "name": "Steam",
  "kind": "item",
  "colors": ["#dce8f2", "#9fb7c8", "#f7fbff", "#5f7689"],
  "pixels": [
    "0011223344556677"
  ]
}
```

`pixels` is normalized to a 16x16 grid of digits. Each digit indexes the
`colors` array, so the game can build a simple generated texture.

## Image Generation

The browser templates load Puter.js:

```html
<script src="https://js.puter.com/v2/"></script>
```

The game asks Gemini only for the discovery `name` and whether it is a `block`
or `item`. Then it asks Puter for actual image generation with
`puter.ai.txt2img(...)`, shrinks the image to 16x16, builds an 8-color palette,
and returns the pixel grid.

## Cache

The game and browser test UI cache finished discoveries in `localStorage` using
a sorted key like:

```text
infinitecraft.discovery.v2:fire+water
```

That means `Fire + Water` and `Water + Fire` reuse the same cached discovery and
skip Gemini/Puter after the first run on that browser.

## GitHub Shared Cache

For a shared cache across friends, use a private GitHub repo plus a fine-grained
personal access token. Give the token Contents read/write access only to that
repo, then run the proxy with:

```powershell
$env:GITHUB_TOKEN="github_pat_..."
$env:GITHUB_REPO="yourname/infinitecraft-cache"
$env:GITHUB_BRANCH="main"
$env:GEMINI_API_KEY="your-gemini-key"
node .\tools\infinitecraft-gemini-proxy.js
```

The safe shape for that repo is:

```text
discoveries/index.json
discoveries/fire+water.json
textures/fire+water.png
```

Do this through the local proxy, not directly from the browser, so your GitHub
token is not shipped inside the game.

When `GITHUB_REPO` is configured, `/combine` checks
`discoveries/<combo>.json` first. If it exists, the proxy returns it and skips
Gemini. If it does not exist, the proxy creates the discovery and commits it.
