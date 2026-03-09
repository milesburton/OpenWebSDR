import { useState, type FormEvent } from 'react';
import type { TuneParams, TuneResponse } from '../hooks/useControlSocket';
import styles from './Panel.module.css';
import tuneStyles from './TunePanel.module.css';

interface TunePanelProps {
  onTune: (params: TuneParams) => void;
  lastResponse: TuneResponse | null;
}

const MODES = ['NFM', 'FM', 'AM', 'USB', 'LSB'];

export function TunePanel({ onTune, lastResponse }: TunePanelProps) {
  const [freqMhz, setFreqMhz] = useState('145.500');
  const [mode, setMode] = useState('NFM');
  const [bandwidth, setBandwidth] = useState('12500');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const frequencyHz = parseFloat(freqMhz) * 1_000_000;
    if (isNaN(frequencyHz)) return;

    onTune({
      frequencyHz,
      mode,
      bandwidthHz: parseInt(bandwidth, 10) || 12_500,
      waterfallRequested: true,
      audioRequested: true,
    });
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Tune</h2>

      <form onSubmit={handleSubmit} className={tuneStyles.form}>
        <label className={tuneStyles.label}>
          Frequency (MHz)
          <input
            type="number"
            step="0.001"
            min="144"
            max="146"
            value={freqMhz}
            onChange={(e) => setFreqMhz(e.target.value)}
            className={tuneStyles.input}
          />
        </label>

        <label className={tuneStyles.label}>
          Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className={tuneStyles.select}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className={tuneStyles.label}>
          Bandwidth (Hz)
          <input
            type="number"
            step="500"
            min="5000"
            max="200000"
            value={bandwidth}
            onChange={(e) => setBandwidth(e.target.value)}
            className={tuneStyles.input}
          />
        </label>

        <button type="submit" className={tuneStyles.button}>
          Tune
        </button>
      </form>

      {lastResponse && (
        <div className={tuneStyles.result}>
          <div className={styles.detail}>Session: {lastResponse.session.id.slice(0, 8)}…</div>
          <div className={styles.detail}>Channel: {lastResponse.channel.id.slice(0, 8)}…</div>
        </div>
      )}
    </div>
  );
}
