export async function detectBlackFrames(mediaFile, threshold = 0.1) {
  if (!window.videmeNative?.ffmpeg) return null;
  const bytes = new Uint8Array(await mediaFile.arrayBuffer());
  const ext = mediaFile.name.split(".").pop() || "mp4";
  const result = await window.videmeNative.ffmpeg.transcodeBuffer({
    bytes,
    inputExt: ext,
    outputExt: "null",
    args: ["-i", "{input}", "-vf", `blackdetect=d=0.1:pix_th=${threshold}`, "-f", "null", "{output}"]
  });
  return parseBlackDetect(result?.stderr || "");
}

export async function detectSilence(mediaFile, threshold = -40, duration = 0.5) {
  if (!window.videmeNative?.ffmpeg) return null;
  const bytes = new Uint8Array(await mediaFile.arrayBuffer());
  const ext = mediaFile.name.split(".").pop() || "mp4";
  const result = await window.videmeNative.ffmpeg.transcodeBuffer({
    bytes,
    inputExt: ext,
    outputExt: "null",
    args: ["-i", "{input}", "-af", `silencedetect=n=${threshold}dB:d=${duration}`, "-f", "null", "{output}"]
  });
  return parseSilenceDetect(result?.stderr || "");
}

export async function detectSceneChanges(mediaFile, threshold = 0.3) {
  if (!window.videmeNative?.ffmpeg) return null;
  const bytes = new Uint8Array(await mediaFile.arrayBuffer());
  const ext = mediaFile.name.split(".").pop() || "mp4";
  const result = await window.videmeNative.ffmpeg.transcodeBuffer({
    bytes,
    inputExt: ext,
    outputExt: "null",
    args: ["-i", "{input}", "-vf", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "{output}"]
  });
  return parseSceneDetect(result?.stderr || "");
}

export async function generateThumbnails(mediaFile, count = 5, duration) {
  if (!window.videmeNative?.ffmpeg) return [];
  const bytes = new Uint8Array(await mediaFile.arrayBuffer());
  const ext = mediaFile.name.split(".").pop() || "mp4";
  const fps = count / (duration || 60);
  const result = await window.videmeNative.ffmpeg.transcodeBuffer({
    bytes,
    inputExt: ext,
    outputExt: "jpg",
    args: ["-i", "{input}", "-vf", `fps=${fps.toFixed(4)},scale=160:-1`, "-q:v", "5", "{output}"]
  });
  if (!result?.ok) return [];
  return [URL.createObjectURL(new Blob([result.bytes], { type: "image/jpeg" }))];
}

function parseBlackDetect(stderr) {
  const segments = [];
  const startRe = /black_start:([\d.]+)/g;
  const endRe = /black_end:([\d.]+)/g;
  let startMatch;
  let endMatch;
  while ((startMatch = startRe.exec(stderr)) !== null) {
    endMatch = endRe.exec(stderr);
    if (endMatch) {
      segments.push({ start: parseFloat(startMatch[1]), end: parseFloat(endMatch[1]) });
    }
  }
  return segments;
}

function parseSilenceDetect(stderr) {
  const segments = [];
  const lines = stderr.split(/\r?\n/);
  let start = null;
  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) start = parseFloat(startMatch[1]);
    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch && start != null) {
      segments.push({ start, end: parseFloat(endMatch[1]) });
      start = null;
    }
  }
  return segments;
}

function parseSceneDetect(stderr) {
  const scenes = [];
  const re = /pts_time:([\d.]+)/g;
  let match;
  while ((match = re.exec(stderr)) !== null) {
    scenes.push({ time: parseFloat(match[1]) });
  }
  return scenes;
}
