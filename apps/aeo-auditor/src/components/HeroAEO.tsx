import s from './HeroAEO.module.css';

export interface HeroAEOProps {
  /** Geo-dependent lead sentence, e.g. "Most Miami medical practices are". */
  lead: string;
}

/** AEO landing hero: headline plus benchmark subtitle. */
export function HeroAEO({ lead }: HeroAEOProps) {
  return (
    <>
      <h1 className={s.heroTitle}>
        {lead} <span className={s.accentBlue}>invisible</span> to{' '}
        <span className={s.accentGrad}>AI search</span> right now.
      </h1>
      <p className={s.subtitle}>
        A <em>forensic, source-cited</em> AEO visibility audit, benchmarked against
        ChatGPT, Perplexity, Gemini, and Claude. One scan. Four engines. Real
        share-of-voice, real citations, real competitors.
      </p>
    </>
  );
}
