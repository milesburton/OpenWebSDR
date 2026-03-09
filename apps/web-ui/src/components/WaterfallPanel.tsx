import { useEffect, useRef, useState } from 'react';
import styles from './WaterfallPanel.module.css';

const WATERFALL_HEIGHT = 400;
const COLOR_MAP = buildColorMap();

/** Build a 256-entry RGB colour map (dark blue → yellow → white) */
function buildColorMap(): Uint8ClampedArray {
  const map = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    map[i * 3 + 0] = Math.min(255, Math.floor(t < 0.5 ? t * 2 * 80 : 80 + (t - 0.5) * 2 * 175));
    map[i * 3 + 1] = Math.min(255, Math.floor(t < 0.5 ? 0 : (t - 0.5) * 2 * 255));
    map[i * 3 + 2] = Math.min(255, Math.floor(t < 0.25 ? t * 4 * 140 : Math.max(0, 140 - (t - 0.25) * 4 * 140)));
  }
  return map;
}

function powerToColourIndex(powerDbfs: number, minDb: number, maxDb: number): number {
  const normalised = (powerDbfs - minDb) / (maxDb - minDb);
  return Math.max(0, Math.min(255, Math.floor(normalised * 255)));
}

interface WaterfallPanelProps {
  channelId?: string;
  minDb?: number;
  maxDb?: number;
}

export function WaterfallPanel({ channelId, minDb = -100, maxDb = -20 }: WaterfallPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [fftSize, setFftSize] = useState(0);

  useEffect(() => {
    if (!channelId) return;

    const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/waterfall/${channelId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        renderLine(event.data);
      } else if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data) as { type: string };
          if (msg.type === 'ready') setConnected(true);
        } catch {
          // Ignore
        }
      }
    };

    return () => ws.close();
  }, [channelId]);

  function renderLine(buffer: ArrayBuffer) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const powers = new Float32Array(buffer);
    const width = powers.length;

    if (width !== canvas.width) {
      canvas.width = width;
      setFftSize(width);
    }

    // Scroll existing content up by one pixel
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, -1);

    // Draw new line at the bottom
    const lineData = ctx.createImageData(width, 1);
    for (let i = 0; i < width; i++) {
      const power = powers[i] ?? minDb;
      const colIdx = powerToColourIndex(power, minDb, maxDb);
      lineData.data[i * 4 + 0] = COLOR_MAP[colIdx * 3 + 0] ?? 0;
      lineData.data[i * 4 + 1] = COLOR_MAP[colIdx * 3 + 1] ?? 0;
      lineData.data[i * 4 + 2] = COLOR_MAP[colIdx * 3 + 2] ?? 0;
      lineData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(lineData, 0, canvas.height - 1);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>Waterfall</span>
        {channelId && (
          <span className={connected ? styles.ok : styles.offline}>
            {connected ? 'streaming' : 'offline'}
          </span>
        )}
        {fftSize > 0 && (
          <span className={styles.meta}>FFT: {fftSize} bins</span>
        )}
      </div>

      {!channelId ? (
        <div className={styles.placeholder}>
          Tune to a frequency to start the waterfall display
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={1024}
          height={WATERFALL_HEIGHT}
        />
      )}
    </div>
  );
}
