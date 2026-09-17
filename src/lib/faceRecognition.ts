export interface FaceEnrollment {
  nomorQr: string;
  nama: string;
  embedding: number[];
  createdAt: string;
}

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
const STORAGE_KEY = 'presensi_face_enrollments';

const ensureScript = (src: string): Promise<void> => {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }

  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Gagal memuat script: ${src}`));
    document.head.appendChild(script);
  });
};

async function loadFaceApi(): Promise<any | null> {
  if (typeof window === 'undefined') return null;

  if (!(window as any).faceapi) {
    try {
      await ensureScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      await ensureScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js');
    } catch {
      return null;
    }
  }

  return (window as any).faceapi || null;
}

export async function loadFaceRecognitionModels(): Promise<boolean> {
  const faceapi = await loadFaceApi();
  if (!faceapi || !faceapi.nets) return false;

  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    return true;
  } catch {
    return false;
  }
}

export function getStoredFaceEnrollments(): FaceEnrollment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFaceEnrollment(entry: FaceEnrollment): void {
  const existing = getStoredFaceEnrollments();
  const filtered = existing.filter(item => item.nomorQr !== entry.nomorQr);
  filtered.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function detectFaceDescriptor(video: HTMLVideoElement): Promise<Float32Array | null> {
  const faceapi = await loadFaceApi();
  if (!faceapi || !video) return null;

  try {
    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
      )
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection) return null;
    return detection.descriptor;
  } catch {
    return null;
  }
}

export function getFaceDistance(current: Float32Array | number[], stored: number[]): number {
  const currentValues = Array.from(current);
  let total = 0;

  for (let i = 0; i < Math.min(currentValues.length, stored.length); i += 1) {
    const diff = currentValues[i] - stored[i];
    total += diff * diff;
  }

  return Math.sqrt(total);
}

export function findBestFaceMatch(current: Float32Array, enrollments: FaceEnrollment[]) {
  if (!enrollments.length) return null;

  let bestMatch: { entry: FaceEnrollment; distance: number } | null = null;

  for (const entry of enrollments) {
    const distance = getFaceDistance(current, entry.embedding);
    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { entry, distance };
    }
  }

  return bestMatch;
}
