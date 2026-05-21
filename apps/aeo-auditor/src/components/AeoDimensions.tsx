import s from './AeoDimensions.module.css';

type Dimension = {
  num: string;
  meta: string;
  title: string;
  body: string;
};

const DIMENSIONS: Dimension[] = [
  {
    num: '01',
    meta: 'WEIGHT 20',
    title: 'Brand Recognition',
    body: 'Does the engine name you when no one asks for you by name?',
  },
  {
    num: '02',
    meta: 'WEIGHT 10',
    title: 'Market Position',
    body: 'When you appear, where do you sit against competitors in the answer?',
  },
  {
    num: '03',
    meta: 'WEIGHT 20',
    title: 'Presence Quality',
    body: 'How deeply does the engine describe what you actually do?',
  },
  {
    num: '04',
    meta: 'WEIGHT 40',
    title: 'Brand Perception',
    body: 'Sentiment and source quality behind every mention. Heaviest weight.',
  },
  {
    num: '05',
    meta: 'WEIGHT 10',
    title: 'Share of Voice',
    body: 'What share of category answers name your brand at all?',
  },
  {
    num: '06',
    meta: 'STRUCTURAL',
    title: 'Citation Sources',
    body: 'The directories, reviews, and publications engines pull from when citing anyone.',
  },
];

/** Six parameters of the AEO analysis, 3x2 grid, shown under the sample-report links. */
export function AeoDimensions() {
  return (
    <section className={s.wrap} aria-label="AEO analysis parameters">
      <div className={s.grid}>
        {DIMENSIONS.map((d) => (
          <article key={d.num} className={s.card}>
            <div className={s.label}>
              <span className={s.num}>{d.num}</span>
              <span className={s.sep}>/</span>
              <span className={s.meta}>{d.meta}</span>
            </div>
            <h3 className={s.title}>{d.title}</h3>
            <p className={s.body}>{d.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
