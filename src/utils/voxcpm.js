import { Client } from "@gradio/client";

const VOXCPM_SPACE = "openbmb/VoxCPM-Demo";
const CONNECT_TIMEOUT_MS = 45_000;
const PREDICT_TIMEOUT_MS = 180_000;
const DOWNLOAD_TIMEOUT_MS = 45_000;

let clientPromise = null;

async function getVoxCpmClient() {
  if (!clientPromise) {
    clientPromise = withTimeout(Client.connect(VOXCPM_SPACE), CONNECT_TIMEOUT_MS, "Koneksi VoxCPM terlalu lama. Coba lagi beberapa saat.").catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export async function generateVoxCpmSpeech({
  text,
  controlInstruction = "",
  referenceAudio = null,
  usePromptText = false,
  promptText = "",
  cfgValue = 2,
  normalize = false,
  denoise = true
}) {
  const client = await getVoxCpmClient();
  const preparedReferenceAudio = referenceAudio ? await prepareReferenceAudio(referenceAudio) : null;
  const result = await withTimeout(client.predict("/generate", {
    text_input: text,
    control_instruction: controlInstruction,
    reference_wav_path_input: preparedReferenceAudio,
    use_prompt_text: usePromptText,
    prompt_text_input: promptText,
    cfg_value_input: cfgValue,
    do_normalize: normalize,
    denoise
  }), PREDICT_TIMEOUT_MS, "VoxCPM terlalu lama merespons. Server mungkin sedang antre atau cold start.");
  return resolveAudioBlob(result?.data?.[0]);
}

async function prepareReferenceAudio(audioFile) {
  const name = audioFile.name || "reference.wav";
  if (/\.wav$/i.test(name) || audioFile.type === "audio/wav" || audioFile.type === "audio/x-wav") {
    return audioFile;
  }
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return audioFile;
  const audioContext = new AudioContextCtor();
  try {
    const buffer = await audioContext.decodeAudioData(await audioFile.arrayBuffer());
    const wav = encodeWav(buffer);
    return new File([wav], name.replace(/\.[^.]+$/, "") + ".wav", { type: "audio/wav" });
  } catch {
    return audioFile;
  } finally {
    audioContext.close?.();
  }
}

function encodeWav(audioBuffer) {
  const channels = Math.min(2, audioBuffer.numberOfChannels || 1);
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channelData = Array.from({ length: channels }, (_, index) => audioBuffer.getChannelData(index));
  for (let i = 0; i < samples; i += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return buffer;
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

async function resolveAudioBlob(output) {
  if (!output) throw new Error("VoxCPM tidak mengembalikan audio.");
  if (output instanceof Blob) return output;
  if (typeof output === "string") {
    const response = await fetchWithTimeout(output);
    if (!response.ok) throw new Error("Gagal mengambil audio VoxCPM.");
    return response.blob();
  }
  if (output.url || output.path) {
    const response = await fetchWithTimeout(output.url ?? output.path);
    if (!response.ok) throw new Error("Gagal mengambil audio VoxCPM.");
    return response.blob();
  }
  throw new Error("Format output VoxCPM tidak dikenali.");
}

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Download audio VoxCPM terlalu lama.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
