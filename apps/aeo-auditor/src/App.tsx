import { useState } from 'react';
import { Header, HexBackground, TopRule, VectorsStrip } from '@gms/ui';
import gmsLogo from './assets/gms-logo.png';
import { AuditForm } from './components/AuditForm';
import { GeoPillsRow, type Geo } from './components/GeoPillsRow';
import { HeroAEO } from './components/HeroAEO';
import { SampleLinks } from './components/SampleLinks';
import { ScopePillsRow } from './components/ScopePillsRow';
import s from './App.module.css';

const HERO_LEAD: Record<Geo, string> = {
  'Florida Medical Practices': 'Most Florida medical practices are',
  Miami: 'Most Miami medical practices are',
  Orlando: 'Most Orlando medical practices are',
  Tampa: 'Most Tampa medical practices are',
  Jacksonville: 'Most Jacksonville medical practices are',
};

const NAV_ITEMS = [
  { label: 'How it works', href: '#how' },
  { label: 'Engines', href: '#engines' },
  { label: 'Methodology', href: '#methodology' },
];

export default function App() {
  const [geo, setGeo] = useState<Geo>('Florida Medical Practices');

  return (
    <>
      <HexBackground />
      <TopRule />

      <Header
        mark={<img src={gmsLogo} alt="Growth Marketing Studios" className={s.logo} />}
        brandName="Growth Marketing Studios"
        productName="AEO Visibility Auditor"
        navItems={NAV_ITEMS}
        cta={{ label: 'Run an audit', href: '#audit' }}
      />

      <main className={s.main}>
        <GeoPillsRow value={geo} onChange={setGeo} />
        <HeroAEO lead={HERO_LEAD[geo]} />
        <ScopePillsRow />
        <AuditForm />
        <SampleLinks />
      </main>

      <VectorsStrip lead="The 4 /" highlight="AI engines evaluated" />
    </>
  );
}
