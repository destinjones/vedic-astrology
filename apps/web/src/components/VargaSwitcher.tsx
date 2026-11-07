import type { VargaId } from '../types/chart';
import { VARGAS } from '../data/constants';

interface Props { value: VargaId; onChange: (v: VargaId) => void }

export function VargaSwitcher({ value, onChange }: Props) {
  const current = VARGAS.find((v) => v.id === value)!;
  return (
    <div className="varga-switch">
      <div className="varga-tabs" role="tablist" aria-label="Divisional chart">
        {VARGAS.map((v) => (
          <button key={v.id} role="tab" aria-selected={v.id === value} className={v.id === value ? 'is-active' : ''}
            onClick={() => onChange(v.id)} title={`${v.name}: ${v.area}`}>
            {v.id}
          </button>
        ))}
      </div>
      <p className="varga-caption"><b>{current.name}</b> <span className="muted">· {current.area}</span></p>
    </div>
  );
}
