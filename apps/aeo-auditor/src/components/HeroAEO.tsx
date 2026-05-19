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
        Growth Marketing Studios&apos; free AEO Grader is a{' '}
        <em>forensic, source-cited</em> visibility audit that shows how leading
        AI engines like ChatGPT, Perplexity, Claude, and Gemini perceive and
        describe your brand based on their training data. One scan. Four
        engines. Five dimensions of brand perception, with real share-of-voice,
        real citations, and real competitors, all delivered with a clear,
        straightforward interpretation of the results.
      </p>
    </>
  );
}
