import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { ReceiverInfo } from '../api/client';
import styles from './Panel.module.css';

export function ReceiverPanel() {
  const [receivers, setReceivers] = useState<ReceiverInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await api.getReceivers();
        if (!cancelled) setReceivers(result.receivers);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load receivers');
      }
    }

    void load();
    const timer = setInterval(() => void load(), 5_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Receivers</h2>
      {error && <div className={styles.error}>{error}</div>}
      {receivers.length === 0 && !error && (
        <div className={styles.empty}>No receivers registered</div>
      )}
      {receivers.map((r) => (
        <div key={r.id} className={styles.item}>
          <div className={styles.itemHeader}>
            <span className={styles.label}>{r.kind}</span>
            <span
              className={`${styles.badge} ${r.health.status === 'healthy' ? styles.ok : styles.warn}`}
            >
              {r.health.status}
            </span>
          </div>
          <div className={styles.detail}>Site: {r.site}</div>
          <div className={styles.detail}>Status: {r.status}</div>
        </div>
      ))}
    </div>
  );
}
