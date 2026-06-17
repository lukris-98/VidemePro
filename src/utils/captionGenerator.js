import { extractAudioWav } from "./ffmpegHelper.js";

const languageMap = {
  auto: "",
  indonesia: "id",
  english: "en",
  japanese: "ja",
  korean: "ko",
  spanish: "es"
};

export async function generateCaptions({ media, clip, apiKey, language = "auto", style = "subtitle", onProgress }) {
  if (!media?.file) throw new Error("Pilih klip video/audio dulu.");
  onProgress?.(0.08, "Menyiapkan audio");
  if (apiKey) {
    const wavBlob = await extractAudioWav(media.file, (progress) => onProgress?.(0.1 + progress * 0.35, "Ekstrak audio"));
    const words = await transcribeWithWhisper({ wavBlob, apiKey, language, onProgress });
    return wordsToCaptionClips(words, clip, style);
  }
  onProgress?.(0.45, "Fallback lokal");
  const duration = clip ? clip.end - clip.start : media.duration || 8;
  return fallbackCaptions(media.name, clip?.start ?? 0, duration, style);
}

async function transcribeWithWhisper({ wavBlob, apiKey, language, onProgress }) {
  const formData = new FormData();
  formData.append("file", wavBlob, "audio.wav");
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");
  if (languageMap[language]) formData.append("language", languageMap[language]);
  onProgress?.(0.55, "Mengirim ke Whisper");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Whisper gagal memproses audio.");
  }
  const data = await response.json();
  onProgress?.(0.82, "Menyusun caption");
  if (Array.isArray(data.words) && data.words.length) {
    return data.words.map((word, index) => ({
      word: String(word.word || "").trim(),
      start: Number(word.start ?? index * 0.45),
      end: Number(word.end ?? index * 0.45 + 0.4)
    }));
  }
  return splitPlainText(data.text || "");
}

function wordsToCaptionClips(words, clip, style) {
  const baseStart = clip?.start ?? 0;
  if (style === "word" || style === "karaoke") {
    return words
      .filter((item) => item.word)
      .map((item) => createCaptionClip(item.word, baseStart + item.start, baseStart + item.end, style));
  }
  const groups = [];
  let current = [];
  for (const word of words) {
    current.push(word);
    const phrase = current.map((item) => item.word).join(" ");
    if (/[.!?]$/.test(word.word) || phrase.length > 42 || current.length >= 7) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups.map((group) =>
    createCaptionClip(group.map((item) => item.word).join(" "), baseStart + group[0].start, baseStart + group[group.length - 1].end, "subtitle")
  );
}

function fallbackCaptions(name, start, duration, style) {
  const cleanName = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Auto caption";
  const words = splitPlainText(`Caption draft dari ${cleanName}. Edit teks ini setelah proses AI selesai.`);
  const total = Math.max(2, duration);
  const step = total / words.length;
  const timed = words.map((item, index) => ({ ...item, start: index * step, end: (index + 1) * step }));
  return wordsToCaptionClips(timed, { start }, style);
}

function splitPlainText(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => ({ word, start: index * 0.42, end: index * 0.42 + 0.38 }));
}

function createCaptionClip(text, start, end, style) {
  return {
    id: crypto.randomUUID(),
    type: "text",
    name: "Auto Caption",
    start,
    end: Math.max(start + 0.2, end),
    inPoint: 0,
    outPoint: Math.max(0.2, end - start),
    mediaDuration: Math.max(0.2, end - start),
    text,
    caption: true,
    captionStyle: style,
    color: "#ffffff",
    fontFamily: "Arial",
    fontSize: style === "word" ? 56 : 44,
    fontWeight: "bold",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 10,
    align: "center",
    posX: 0.5,
    posY: 0.84,
    animation: style === "karaoke" ? "bounce" : "fadeIn",
    animDuration: 0.18,
    timelineColor: "var(--clip-text)"
  };
}
