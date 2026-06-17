export function connectVoiceEffect(audioContext, source, gain, voiceEffect = {}) {
  if (!voiceEffect.enabled || voiceEffect.type === "none") {
    source.connect(gain);
    return;
  }
  const intensity = Math.max(0, Math.min(1, voiceEffect.intensity ?? 0.5));
  if (voiceEffect.type === "echo") {
    const delay = audioContext.createDelay(1);
    const feedback = audioContext.createGain();
    delay.delayTime.value = 0.22 + intensity * 0.18;
    feedback.gain.value = 0.18 + intensity * 0.35;
    source.connect(gain);
    source.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(gain);
    return;
  }
  if (voiceEffect.type === "robot") {
    const distortion = audioContext.createWaveShaper();
    distortion.curve = makeDistortionCurve(120 + intensity * 520);
    distortion.oversample = "4x";
    source.connect(distortion).connect(gain);
    return;
  }
  if (voiceEffect.type === "reverb") {
    const convolver = audioContext.createConvolver();
    convolver.buffer = createReverb(audioContext, 1.2 + intensity * 1.5, 2.2);
    source.connect(gain);
    source.connect(convolver).connect(gain);
    return;
  }
  source.connect(gain);
}

export function resolveVoicePitch(clip) {
  const effect = clip.voiceEffect ?? {};
  if (!effect.enabled) return 0;
  if (effect.type === "chipmunk") return 8;
  if (effect.type === "deep") return -8;
  return effect.pitchShift ?? 0;
}

function createReverb(audioContext, duration, decay) {
  const length = audioContext.sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}

function makeDistortionCurve(amount) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}
