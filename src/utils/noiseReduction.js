import { getAudioContext } from "./audioHelper.js";

export async function reduceNoiseFile(file, { intensity = 70, onProgress } = {}) {
  if (!file) throw new Error("File audio belum tersedia.");
  const audioContext = getAudioContext();
  onProgress?.(0.12, "Decode audio");
  const input = await audioContext.decodeAudioData(await file.arrayBuffer());
  const mono = mixToMono(input);
  onProgress?.(0.28, "Noise profile");
  const profile = estimateNoiseFloor(mono, input.sampleRate);
  const amount = Math.max(0, Math.min(1, intensity / 100));
  const processed = new Float32Array(mono.length);
  const attack = 0.12;
  let gate = 1;
  for (let i = 0; i < mono.length; i += 1) {
    const level = Math.abs(mono[i]);
    const target = level < profile * (1.2 + amount * 2.2) ? 1 - amount * 0.78 : 1;
    gate += (target - gate) * attack;
    processed[i] = mono[i] * gate;
    if (i % 48000 === 0) onProgress?.(0.28 + (i / mono.length) * 0.52, "Membersihkan noise");
  }
  const mixed = new Float32Array(mono.length);
  for (let i = 0; i < mono.length; i += 1) mixed[i] = mono[i] * (1 - amount) + processed[i] * amount;
  onProgress?.(0.86, "Encode WAV");
  const wav = encodeWav(mixed, input.sampleRate);
  const output = new File([wav], file.name.replace(/\.[^.]+$/, "") + "-denoise.wav", { type: "audio/wav" });
  onProgress?.(1, "Selesai");
  return {
    file: output,
    url: URL.createObjectURL(output),
    waveformBefore: waveform(mono, 64),
    waveformAfter: waveform(mixed, 64)
  };
}

function mixToMono(buffer) {
  const output = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) output[i] += data[i] / buffer.numberOfChannels;
  }
  return output;
}

function estimateNoiseFloor(samples, sampleRate) {
  const window = Math.max(1, Math.floor(sampleRate * 0.02));
  const levels = [];
  for (let i = 0; i < samples.length; i += window) {
    let sum = 0;
    const end = Math.min(samples.length, i + window);
    for (let j = i; j < end; j += 1) sum += samples[j] * samples[j];
    levels.push(Math.sqrt(sum / Math.max(1, end - i)));
  }
  levels.sort((a, b) => a - b);
  return levels[Math.floor(levels.length * 0.18)] || 0.01;
}

function waveform(samples, points) {
  const step = Math.max(1, Math.floor(samples.length / points));
  return Array.from({ length: points }, (_, index) => {
    let max = 0;
    for (let i = index * step; i < Math.min(samples.length, (index + 1) * step); i += 1) max = Math.max(max, Math.abs(samples[i]));
    return Number(max.toFixed(3));
  });
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);
  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}
