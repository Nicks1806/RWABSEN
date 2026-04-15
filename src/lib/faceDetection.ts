// Face Detection Helper using @vladmandic/face-api
// Models loaded from CDN on first use

let modelsLoaded = false;
let loadPromise: Promise<void> | null = null;

const MODEL_URL = "https://vladmandic.github.io/face-api/model";

async function loadModels() {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const faceapi = await import("@vladmandic/face-api");
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    modelsLoaded = true;
  })();

  return loadPromise;
}

/**
 * Returns true if the image contains at least one human face.
 * Uses TinyFaceDetector which is fast (~200KB model).
 */
export async function hasFace(imageDataUrl: string): Promise<boolean> {
  try {
    await loadModels();
    const faceapi = await import("@vladmandic/face-api");

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imageDataUrl;
    });

    const detections = await faceapi.detectAllFaces(
      img,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
    );

    return detections.length > 0;
  } catch (err) {
    console.error("Face detection error:", err);
    // Fail open - don't block absen if model fails to load
    return true;
  }
}

// Pre-warm models on page load (optional)
export function prewarmFaceModels() {
  loadModels().catch(() => {});
}
