import { useState, useEffect } from 'react';
import { ReceiverPanel } from './components/ReceiverPanel';
import { WaterfallPanel } from './components/WaterfallPanel';
import { TunePanel } from './components/TunePanel';
import { StatusBar } from './components/StatusBar';
import { useControlSocket } from './hooks/useControlSocket';
import { useSystemHealth } from './hooks/useSystemHealth';
import styles from './App.module.css';

export function App() {
  const { connected, tune, lastTuneResponse } = useControlSocket();
  const { health } = useSystemHealth();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Next SDR</h1>
        <StatusBar connected={connected} health={health} />
      </header>

      <main className={styles.main}>
        <aside className={styles.sidebar}>
          <ReceiverPanel />
          <TunePanel onTune={tune} lastResponse={lastTuneResponse} />
        </aside>

        <section className={styles.content}>
          <WaterfallPanel />
        </section>
      </main>
    </div>
  );
}
