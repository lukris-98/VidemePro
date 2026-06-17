import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { buildH264Args, chooseBestH264Encoder, getNativeFFmpegCapabilities, transcodeBlobNative } from "./ffmpegRuntime.js";

const ffmpeg = new FFmpeg();
let ffmpegReady = false;

export async function initFFmpeg(onProgress) {
  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => onProgress(Math.max(0, Math.min(1, progress || 0))));
  }
  if (ffmpegReady) return ffmpeg;
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
  });
  ffmpegReady = true;
  return ffmpeg;
}

export function cancelWasmJob() {
  try {
    ffmpeg.terminate();
  } catch {
    // worker already gone
  }
  ffmpegReady = false;
}

export async function extractFrame(videoFile, timeInSeconds, onProgress) {
  const instance = await initFFmpeg(onProgress);
  await instance.writeFile("input.mp4", await fetchFile(videoFile));
  await instance.exec(["-i", "input.mp4", "-ss", String(Math.max(0, timeInSeconds)), "-frames:v", "1", "-q:v", "2", "frame.jpg"]);
  const data = await instance.readFile("frame.jpg");
  return new File([data.slice().buffer], "freeze_frame.jpg", { type: "image/jpeg" });
}

export async function convertWebmToMp4(webmBlob, crf, onProgress) {
  try {
    const capabilities = await getNativeFFmpegCapabilities();
    if (capabilities.available) {
      onProgress?.(0.05);
      const encoder = chooseBestH264Encoder(capabilities);
      const args = buildH264Args({ encoder, crf });
      const result = await transcodeBlobNative(webmBlob, { inputExt: "webm", outputExt: "mp4", args });
      onProgress?.(1);
      return result;
    }
  } catch (error) {
    console.warn("Native FFmpeg gagal, fallback ke FFmpeg.wasm.", error);
  }
  const instance = await initFFmpeg(onProgress);
  await instance.writeFile("input.webm", await fetchFile(webmBlob));
  await instance.exec(["-i", "input.webm", "-c:v", "libx264", "-crf", String(crf), "-preset", "veryfast", "output.mp4"]);
  const data = await instance.readFile("output.mp4");
  return new Blob([data.slice().buffer], { type: "video/mp4" });
}

export async function extractAudioWav(mediaFile, onProgress) {
  const instance = await initFFmpeg(onProgress);
  const inputName = mediaFile.type.startsWith("video/") ? "caption-input.mp4" : "caption-input.audio";
  await instance.writeFile(inputName, await fetchFile(mediaFile));
  await instance.exec(["-i", inputName, "-vn", "-ar", "16000", "-ac", "1", "-f", "wav", "caption-audio.wav"]);
  const data = await instance.readFile("caption-audio.wav");
  return new Blob([data.slice().buffer], { type: "audio/wav" });
}
