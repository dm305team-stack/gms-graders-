import { Pill, PillGroup } from '@gms/ui';
import s from './ScopePillsRow.module.css';

interface ScopeItem {
  label: string;
  dot: string;
}

const SCOPE_ITEMS: ScopeItem[] = [
  { label: 'ChatGPT (GPT-5.2)', dot: '#10a37f' },
  { label: 'Perplexity Sonar', dot: '#2d8aa3' },
  { label: 'Gemini 3 Pro', dot: '#4285f4' },
  { label: 'Claude Sonnet 4.6', dot: '#c15f3c' },
  { label: 'Share of Voice', dot: 'var(--ink-mute)' },
  { label: 'Sentiment', dot: 'var(--ink-mute)' },
  { label: 'Source Authority', dot: 'var(--ink-mute)' },
];

/** The four evaluated AI engines plus the signal dimensions scored. */
export function ScopePillsRow() {
  return (
    <PillGroup wrap className={s.scopeGroup}>
      {SCOPE_ITEMS.map((item) => (
        <Pill key={item.label} variant="outline" dotColor={item.dot}>
          {item.label}
        </Pill>
      ))}
    </PillGroup>
  );
}
