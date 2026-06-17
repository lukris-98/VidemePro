export async function generateAiImage({ prompt, style = "cinematic", aspect = "16:9", apiKey, onProgress }) {
  onProgress?.(0.12, "Membaca prompt");
  if (apiKey?.trim()) {
    const remote = await tryRemoteImage({ prompt, style, aspect, apiKey, onProgress });
    if (remote) return remote;
  }
  return generateLocalImage({ prompt, style, aspect, onProgress });
}

async function tryRemoteImage({ prompt, style, aspect, apiKey, onProgress }) {
  try {
    onProgress?.(0.35, "Mencoba API eksternal");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 280,
        messages: [{ role: "user", content: `Create a concise visual prompt for an image generator. Subject: ${prompt}. Style: ${style}. Aspect: ${aspect}.` }]
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.content?.map((item) => item.text).filter(Boolean).join(" ") || prompt;
    return generateLocalImage({ prompt: text, style, aspect, onProgress });
  } catch {
    return null;
  }
}

async function generateLocalImage({ prompt, style, aspect, onProgress }) {
  const [wRatio, hRatio] = aspect.split(":").map(Number);
  const width = 1280;
  const height = Math.round((width * hRatio) / wRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const palette = getPalette(prompt, style);
  onProgress?.(0.5, "Membuat komposisi");
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(0.48, palette[1]);
  gradient.addColorStop(1, palette[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 36; i += 1) {
    const seed = hash(`${prompt}-${style}-${i}`);
    const x = (seed % width);
    const y = (Math.floor(seed / 7) % height);
    const radius = 70 + (seed % 180);
    ctx.globalAlpha = 0.05 + ((seed % 18) / 100);
    ctx.fillStyle = palette[(i + 1) % palette.length];
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.6, radius, (seed % 360) * Math.PI / 180, 0, Math.PI * 2);
    ctx.fill();
  }

  onProgress?.(0.82, "Finishing frame");
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = `700 ${Math.max(34, height / 13)}px Arial`;
  wrapText(ctx, prompt || "AI generated image", width * 0.08, height * 0.62, width * 0.72, height / 11);
  ctx.font = `400 ${Math.max(18, height / 34)}px Arial`;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText(style.toUpperCase(), width * 0.08, height * 0.16);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  const file = new File([blob], `ai-${Date.now()}.png`, { type: "image/png" });
  const url = URL.createObjectURL(file);
  onProgress?.(1, "Selesai");
  return { file, url, width, height };
}

function getPalette(prompt, style) {
  const palettes = {
    cinematic: ["#0b0d12", "#254f6f", "#d98248"],
    anime: ["#20223a", "#ff6aa2", "#7bdff2"],
    product: ["#101114", "#4b5563", "#d9dee8"],
    neon: ["#050508", "#00d1ff", "#ff2fb3"],
    natural: ["#12352c", "#6b8e4e", "#d5b36a"]
  };
  const base = palettes[style] ?? palettes.cinematic;
  if (hash(prompt) % 2) return [...base].reverse();
  return base;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const test = `${line} ${word}`.trim();
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function hash(input = "") {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}
