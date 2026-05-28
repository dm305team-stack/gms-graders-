import { useEffect, useState } from 'react';
import { Header, HexBackground, TopRule } from '@gms/ui';
import gmsLogo from '../assets/gms-logo.png';
import { AuditList } from './AuditList';
import { AuditDetail } from './AuditDetail';
import s from './ConsoleApp.module.css';

function currentId(): string | null {
  return new URLSearchParams(window.location.search).get('id');
}

export function ConsoleApp() {
  const [selectedId, setSelectedId] = useState<string | null>(() => currentId());

  // Keep the view in sync with browser back/forward.
  useEffect(() => {
    const onPop = () => setSelectedId(currentId());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function open(id: string) {
    window.history.pushState({ id }, '', `?id=${encodeURIComponent(id)}`);
    setSelectedId(id);
  }

  function back() {
    window.history.pushState({}, '', window.location.pathname);
    setSelectedId(null);
  }

  return (
    <>
      <HexBackground />
      <TopRule />
      <Header
        mark={<img src={gmsLogo} alt="Growth Marketing Studios" className={s.logo} />}
        brandName="Growth Marketing Studios"
        productName="AEO Console"
        cta={{ label: 'Run an audit', href: '/' }}
      />
      <main className={s.main}>
        {selectedId ? (
          <AuditDetail id={selectedId} onBack={back} />
        ) : (
          <AuditList onOpen={open} />
        )}
      </main>
    </>
  );
}
