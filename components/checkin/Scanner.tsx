'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type CamStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error';
export type Flash = 'ok' | 'warn' | 'bad' | null;

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type JsQR = typeof import('jsqr').default;

// Browsers with a built-in QR reader (Chrome on Android, macOS, ChromeOS) use it; everyone else
// (iPhone, Windows, Firefox) gets jsQR, loaded only when needed.
async function makeDecoder(): Promise<{ native: Detector | null; jsqr: JsQR | null }> {
  const BD = (window as unknown as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } })
    .BarcodeDetector;
  if (BD) {
    try {
      if ((await BD.getSupportedFormats()).includes('qr_code')) return { native: new BD({ formats: ['qr_code'] }), jsqr: null };
    } catch {
      /* fall through */
    }
  }
  const mod = await import('jsqr');
  return { native: null, jsqr: mod.default };
}

const SCAN_EVERY_MS = 120;
const CROP = 0.8; // decode the middle of the picture, where the frame is drawn
const DECODE_PX = 480;

interface TorchTrack extends MediaStreamTrack {
  getCapabilities(): MediaTrackCapabilities & { torch?: boolean };
}

/**
 * Live camera view that reads QR codes continuously. Calls onDetect with the raw text of each
 * code it sees (the parent decides what to do with repeats).
 */
export default function Scanner({
  onDetect,
  flash,
  flashKey,
}: {
  onDetect: (text: string) => void;
  /** Colour of the frame pulse for the latest result; flashKey changes on every result so it replays. */
  flash: Flash;
  flashKey: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const onDetectRef = useRef(onDetect);
  const [status, setStatus] = useState<CamStatus>('idle');
  const [mirrored, setMirrored] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraIndex, setCameraIndex] = useState(-1);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  const stop = useCallback(() => {
    window.clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }
      stop();
      setStatus('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});

        const track = stream.getVideoTracks()[0] as TorchTrack;
        // Laptop webcams face the user, so show them like a mirror; phone back cameras don't need it.
        setMirrored(track.getSettings().facingMode !== 'environment');
        setTorch({ supported: Boolean(track.getCapabilities?.().torch), on: false });
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        setCameras(devices);
        setCameraIndex(devices.findIndex((d) => d.deviceId === track.getSettings().deviceId));
        setStatus('live');

        const { native, jsqr } = await makeDecoder();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const tick = async () => {
          if (streamRef.current !== stream) return;
          if (document.visibilityState === 'visible' && video.readyState >= 2 && video.videoWidth) {
            try {
              let text: string | undefined;
              if (native) {
                text = (await native.detect(video))[0]?.rawValue;
              } else if (jsqr && ctx) {
                const side = Math.min(video.videoWidth, video.videoHeight) * CROP;
                const size = Math.min(DECODE_PX, Math.round(side));
                canvas.width = canvas.height = size;
                ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, size, size);
                text = jsqr(ctx.getImageData(0, 0, size, size).data, size, size, { inversionAttempts: 'attemptBoth' })?.data;
              }
              if (text) onDetectRef.current(text);
            } catch {
              /* a frame that can't be read — try the next one */
            }
          }
          timerRef.current = window.setTimeout(tick, SCAN_EVERY_MS);
        };
        void tick();
      } catch (e) {
        stop();
        const name = e instanceof DOMException ? e.name : '';
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'error');
      }
    },
    [stop],
  );

  // Start straight away when the camera was already allowed on this device.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((p) => {
        if (!cancelled && p.state === 'granted') void start();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      stop();
    };
  }, [start, stop]);

  // Phones may cut the camera when the screen locks or the app is switched; pick it back up.
  useEffect(() => {
    const onVisible = () => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (document.visibilityState === 'visible' && track && track.readyState === 'ended') {
        void start(cameras[cameraIndex]?.deviceId);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [start, cameras, cameraIndex]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  }

  function switchCamera() {
    if (cameras.length < 2) return;
    const next = (cameraIndex + 1) % cameras.length;
    setCameraIndex(next);
    void start(cameras[next].deviceId);
  }

  const live = status === 'live';
  return (
    <div className={`scanner${live ? ' is-live' : ''}`}>
      <video ref={videoRef} className={mirrored ? 'is-mirrored' : undefined} playsInline muted aria-hidden="true" />
      <div className="scan-frame" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        {live && <span className="scan-line" />}
      </div>
      {flash && <span key={flashKey} className={`scan-flash flash-${flash}`} aria-hidden="true" />}

      {!live && (
        <div className="scanner-idle">
          {status === 'starting' ? (
            <p>
              <span className="spinner" aria-hidden="true" /> Starting the camera…
            </p>
          ) : (
            <>
              <p>
                {status === 'denied'
                  ? 'Camera access is blocked. Allow the camera for this site in the browser settings, then try again — or type the reference number below.'
                  : status === 'unavailable'
                    ? 'No camera found on this device. Type the reference number below instead.'
                    : status === 'error'
                      ? 'The camera could not start (another app may be using it).'
                      : 'Point the camera at the QR code on the boarding pass.'}
              </p>
              {status !== 'unavailable' && (
                <button type="button" className="btn btn-primary" onClick={() => void start()}>
                  {status === 'idle' ? 'Start scanning' : 'Try again'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {live && (
        <div className="scanner-tools">
          <span className="scanner-hint">Hold the QR code inside the frame</span>
          {torch.supported && (
            <button type="button" className="scan-tool" onClick={() => void toggleTorch()} aria-pressed={torch.on}>
              {torch.on ? 'Light off' : 'Light'}
            </button>
          )}
          {cameras.length > 1 && (
            <button type="button" className="scan-tool" onClick={switchCamera}>
              Switch camera
            </button>
          )}
        </div>
      )}
    </div>
  );
}
