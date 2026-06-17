let segmenter = null;
let pendingResult = null;

export async function segmentFrame(image) {
  const instance = await getSegmenter();
  pendingResult = null;
  await instance.send({ image });
  if (!pendingResult?.segmentationMask) return null;
  const width = image.videoWidth || image.naturalWidth || image.width;
  const height = image.videoHeight || image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(pendingResult.segmentationMask, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

async function getSegmenter() {
  if (segmenter) return segmenter;
  const { SelfieSegmentation } = await import("@mediapipe/selfie_segmentation");
  segmenter = new SelfieSegmentation({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
  });
  segmenter.setOptions({ modelSelection: 1 });
  segmenter.onResults((results) => {
    pendingResult = results;
  });
  return segmenter;
}
