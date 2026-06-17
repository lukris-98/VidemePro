let sharedAudioContext = null;

export function getAudioContext() {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

export async function generateWaveform(file, points = 1000) {
  if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
    return [];
  }
  try {
    const audioContext = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const samplesPerPoint = Math.max(1, Math.floor(channel.length / points));
    const waveform = [];
    for (let i = 0; i < points; i += 1) {
      let max = 0;
      const start = i * samplesPerPoint;
      const end = Math.min(channel.length, start + samplesPerPoint);
      for (let sample = start; sample < end; sample += 1) {
        max = Math.max(max, Math.abs(channel[sample]));
      }
      waveform.push(Number(max.toFixed(3)));
    }
    return waveform;
  } catch {
    return [];
  }
}

export function drawWaveform(canvas, waveform, color = "#4ade80") {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#1a3a2a";
  ctx.fillRect(0, 0, width, height);
  if (!waveform?.length) return;
  const step = width / waveform.length;
  ctx.fillStyle = color;
  waveform.forEach((value, index) => {
    const barHeight = Math.max(1, value * height);
    const x = index * step;
    const y = (height - barHeight) / 2;
    ctx.fillRect(x, y, Math.max(1, step), barHeight);
  });
}
