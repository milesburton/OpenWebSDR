import type { SystemHealth } from '../hooks/useSystemHealth';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  connected: boolean;
  health: SystemHealth;
}

export function StatusBar({ connected, health }: StatusBarProps) {
  return (
    <div className={styles.bar}>
      <span
        className={`${styles.indicator} ${connected ? styles.ok : styles.err}`}
        title="WebSocket"
      >
        WS: {connected ? 'connected' : 'disconnected'}
      </span>
      <span
        className={`${styles.indicator} ${health.ready ? styles.ok : styles.err}`}
        title="System health"
      >
        API: {health.ready ? 'ready' : 'unavailable'}
      </span>
    </div>
  );
}
