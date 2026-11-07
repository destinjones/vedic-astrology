import type { VargaId } from '../types/chart';
import { VARGAS } from '../data/constants';
import { useI18n } from '../i18n';

interface Props { value: VargaId; onChange: (v: VargaId) => void }

export function VargaSwitcher({ value, onChange }: Props) {
  const { t, v: vocab, tl } = useI18n();
  const area = tl<Record<VargaId, string>>('data.vargaArea');
  const current = VARGAS.find((v) => v.id === value)!;
  return (
    <div className="varga-switch">
      <div className="varga-tabs" role="tablist" aria-label={t('chart.divisional')}>
        {VARGAS.map((v) => (
          <button key={v.id} role="tab" aria-selected={v.id === value} className={v.id === value ? 'is-active' : ''}
            onClick={() => onChange(v.id)} title={`${vocab.vargas[v.id]}: ${area[v.id]}`}>
            {v.id}
          </button>
        ))}
      </div>
      <p className="varga-caption"><b>{vocab.vargas[current.id]}</b> <span className="muted">· {area[current.id]}</span></p>
    </div>
  );
}
