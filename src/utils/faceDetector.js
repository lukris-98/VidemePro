let detector = null;
let pendingResult = null;

export async function detectFaces(image) {
  const instance = await getDetector();
  pendingResult = null;
  await instance.send({ image });
  const detections = pendingResult?.detections ?? [];
  return detections
    .map((detection) => detection.boundingBox)
    .filter(Boolean)
    .map((box) => ({
      x: box.xCenter - box.width / 2,
      y: box.yCenter - box.height / 2,
      w: box.width,
      h: box.height
    }));
}

export function boxesToReframe(boxes) {
  if (!boxes?.length) return null;
  const box = boxes[0];
  return {
    centerX: Math.max(0, Math.min(1, box.x + box.w / 2)),
    centerY: Math.max(0, Math.min(1, box.y + box.h / 2))
  };
}

async function getDetector() {
  if (detector) return detector;
  const { FaceDetection } = await import("@mediapipe/face_detection");
  detector = new FaceDetection({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
  });
  detector.setOptions({ model: "short", minDetectionConfidence: 0.5 });
  detector.onResults((results) => {
    pendingResult = results;
  });
  return detector;
}
