import { useEffect, useRef } from "react";
import { getAudioContext } from "../utils/audioHelper.js";
import { connectVoiceEffect, resolveVoicePitch } from "../utils/voiceEffects.js";

const bufferCache = new WeakMap();

export function useAudioPlayback({ isPlaying, currentTime, tracks, mediaItems }) {
  const sourcesRef = useRef([]);
  const startTimeRef = useRef(currentTime);

  useEffect(() => {
    if (!isPlaying) startTimeRef.current = currentTime;
  }, [currentTime, isPlaying]);

  useEffect(() => {
    const stopAll = () => {
      sourcesRef.current.forEach(({ source }) => {
        try {
          source.stop();
        } catch {}
      });
      sourcesRef.current = [];
    };

    if (!isPlaying) {
      stopAll();
      return stopAll;
    }

    let cancelled = false;
    const timelineStart = startTimeRef.current;
    const start = async () => {
      const audioContext = getAudioContext();
      await audioContext.resume();
      const soloTrack = tracks.find((track) => track.solo);
      const audibleTracks = tracks.filter((track) => (track.type === "audio" || track.type === "video") && !track.muted && (!soloTrack || soloTrack.id === track.id));

      for (const track of audibleTracks) {
        for (const clip of track.clips) {
          if (clip.end <= timelineStart) continue;
          if (track.type === "video" && clip.linkedItemId) continue;
          if (track.type === "video" && clip.hasAudio === false) continue;
          const media = mediaItems.find((item) => item.id === clip.mediaId);
          if (!media?.file || (!media.type.startsWith?.("audio") && media.type !== "audio" && media.type !== "video")) continue;
          const buffer = await getAudioBuffer(audioContext, media.file);
          if (cancelled || !buffer) continue;
          const clipOffset = Math.max(0, timelineStart - clip.start);
          const mediaOffset = (clip.inPoint ?? 0) + clipOffset * (clip.speed ?? 1);
          const duration = Math.max(0, (clip.end - Math.max(timelineStart, clip.start)) * (clip.speed ?? 1));
          const delay = Math.max(0, clip.start - timelineStart);
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = (clip.speed ?? 1) * Math.pow(2, resolveVoicePitch(clip) / 12);
          const gain = audioContext.createGain();
          const volume = (clip.volume ?? 1) * (track.volume ?? 1);
          const startAt = audioContext.currentTime + delay;
          gain.gain.setValueAtTime(volume, startAt);
          if (clip.fadeIn) {
            gain.gain.setValueAtTime(0, startAt);
            gain.gain.linearRampToValueAtTime(volume, startAt + clip.fadeIn);
          }
          if (clip.fadeOut) {
            const endAt = startAt + Math.max(0, duration - clip.fadeOut);
            gain.gain.setValueAtTime(volume, endAt);
            gain.gain.linearRampToValueAtTime(0, endAt + clip.fadeOut);
          }
          connectVoiceEffect(audioContext, source, gain, clip.voiceEffect);
          connectNoiseReduction(audioContext, gain, clip.noiseReduction).connect(audioContext.destination);
          source.start(startAt, mediaOffset, duration);
          sourcesRef.current.push({ source });
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      stopAll();
    };
  }, [isPlaying, tracks, mediaItems]);
}

function connectNoiseReduction(audioContext, input, noiseReduction = {}) {
  if (!noiseReduction.enabled || !noiseReduction.intensity) return input;
  const highpass = audioContext.createBiquadFilter();
  const lowpass = audioContext.createBiquadFilter();
  const intensity = Math.max(0, Math.min(1, noiseReduction.intensity / 100));
  highpass.type = "highpass";
  highpass.frequency.value = 40 + intensity * 120;
  lowpass.type = "lowpass";
  lowpass.frequency.value = 18000 - intensity * 6500;
  input.connect(highpass).connect(lowpass);
  return lowpass;
}

async function getAudioBuffer(audioContext, file) {
  if (bufferCache.has(file)) return bufferCache.get(file);
  try {
    const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    bufferCache.set(file, buffer);
    return buffer;
  } catch {
    return null;
  }
}
