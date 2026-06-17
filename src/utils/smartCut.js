import { getAudioContext } from "./audioHelper.js";

export async function analyzeSilence(mediaFile, { thresholdDb = -40, minDuration = 0.5, padding = 0.08, onProgress } = {}) {
  if (!mediaFile) throw new Error("Media audio/video belum dipilih.");
  const audioContext = getAudioContext();
  onProgress?.(0.12, "Decode audio");
  const buffer = await audioContext.decodeAudioData(await mediaFile.arrayBuffer());
  const samples = mixToMono(buffer);
  const sampleRate = buffer.sampleRate;
  const chunkSize = Math.max(1, Math.floor(sampleRate * 0.01));
  const chunks = [];
  for (let index = 0; index < samples.length; index += chunkSize) {
    let sum = 0;
    const end = Math.min(samples.length, index + chunkSize);
    for (let sample = index; sample < end; sample += 1) sum += samples[sample] * samples[sample];
    const rms = Math.sqrt(sum / Math.max(1, end - index));
    const db = 20 * Math.log10(Math.max(rms, 0.000001));
    chunks.push({ time: index / sampleRate, db, silent: db < thresholdDb });
    if (index % (chunkSize * 500) === 0) onProgress?.(0.12 + (index / samples.length) * 0.72, "Analisis volume");
  }
  const ranges = groupSilence(chunks, minDuration, padding, buffer.duration);
  const waveform = buildWaveform(samples, 180);
  onProgress?.(1, "Selesai");
  return { ranges, waveform, duration: buffer.duration };
}

function mixToMono(buffer) {
  const output = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) output[i] += data[i] / buffer.numberOfChannels;
  }
  return output;
}

function groupSilence(chunks, minDuration, padding, duration) {
  const ranges = [];
  let start = null;
  for (const chunk of chunks) {
    if (chunk.silent && start === null) start = chunk.time;
    if (!chunk.silent && start !== null) {
      if (chunk.time - start >= minDuration) ranges.push({ start: Math.max(0, start - padding), end: Math.min(duration, chunk.time + padding) });
      start = null;
    }
  }
  if (start !== null && duration - start >= minDuration) ranges.push({ start: Math.max(0, start - padding), end: duration });
  return ranges;
}

function buildWaveform(samples, points) {
  const step = Math.max(1, Math.floor(samples.length / points));
  return Array.from({ length: points }, (_, point) => {
    let max = 0;
    const start = point * step;
    const end = Math.min(samples.length, start + step);
    for (let index = start; index < end; index += 1) max = Math.max(max, Math.abs(samples[index]));
    return Number(max.toFixed(3));
  });
}
