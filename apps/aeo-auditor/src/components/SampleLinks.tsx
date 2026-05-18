import s from './SampleLinks.module.css';

/** Links to the bilingual sample reports. */
export function SampleLinks() {
  return (
    <div className={s.sampleLinks}>
      <a href="#sample-en">View sample English report</a>
      <a href="#sample-es">Ver informe de muestra en Español</a>
    </div>
  );
}
