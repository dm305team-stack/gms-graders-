import { useEffect, useState, type FormEvent } from 'react';
import { FieldLabel, FormCard, SubmitButton, TextInput } from '@gms/ui';
import { ReportPreview, type GateContact } from './ReportPreview';
import s from './AuditForm.module.css';

/** Live status of a queued analysis, polled from GET /api/analyses/:id. */
interface AnalysisStatus {
  analysis_id: string;
  status: string;
  stage_label: string;
  error: string | null;
}

type Phase = 'form' | 'queries' | 'running' | 'unlock' | 'delivered';

/**
 * AEO funnel: scope form -> running (audit) -> unlock (blurred real report +
 * inline gate) -> delivered. The scope form triggers the audit; the gate
 * captures the lead and sends the two emails.
 */
export function AuditForm() {
  const [phase, setPhase] = useState<Phase>('form');

  // Scope inputs (step 1).
  const [domain, setDomain] = useState('');
  const [brand, setBrand] = useState('');
  const [location, setLocation] = useState('');
  const [sector, setSector] = useState('');
  const [product, setProduct] = useState('');

  const [starting, setStarting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus | null>(null);

  // Curated prompts (step 2): editable long-tail suggestions the client completes.
  const [customQueries, setCustomQueries] = useState<string[]>([]);
  const [launching, setLaunching] = useState(false);

  // Unlock gate (step 3).
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [deliveredEmail, setDeliveredEmail] = useState('');

  /** Step 1: scope form. Fetches 5 editable long-tail prompt suggestions. */
  async function handleScopeSubmit(e: FormEvent) {
    e.preventDefault();
    if (starting || analysisId) return;
    setRunError(null);
    setStarting(true);

    try {
      const res = await fetch('/api/suggest-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, brand, location, specialty: sector, product }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.details) ? data.details.join(', ') : data.error;
        throw new Error(detail || `Server returned ${res.status}`);
      }
      const qs: string[] = Array.isArray(data.queries) ? data.queries : [];
      // Always 5 editable slots; prefill with suggestions, blanks for the rest.
      setCustomQueries([0, 1, 2, 3, 4].map((i) => (typeof qs[i] === 'string' ? qs[i] : '')));
      setPhase('queries');
    } catch (err) {
      setRunError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setStarting(false);
    }
  }

  function updateQuery(i: number, value: string) {
    setCustomQueries((prev) => prev.map((q, idx) => (idx === i ? value : q)));
  }

  /** Step 2: curated prompts. Starts the audit with the client's prompts. */
  async function handleRunSubmit(e: FormEvent) {
    e.preventDefault();
    if (launching || analysisId) return;
    setRunError(null);
    setLaunching(true);

    try {
      const custom_queries = customQueries.map((q) => q.trim()).filter(Boolean);
      const res = await fetch('/api/run-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, brand, location, specialty: sector, product, custom_queries }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.details) ? data.details.join(', ') : data.error;
        throw new Error(detail || `Server returned ${res.status}`);
      }
      setAnalysisId(data.analysis_id as string);
      setPhase('running');
    } catch (err) {
      setRunError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setLaunching(false);
    }
  }

  // Poll analysis status until the pipeline reaches a terminal state.
  useEffect(() => {
    if (!analysisId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch(`/api/analyses/${analysisId}`);
        if (res.ok && active) {
          const data = (await res.json()) as AnalysisStatus;
          setStatus(data);
          if (data.status === 'done') {
            setPhase('unlock');
            return;
          }
          if (data.status === 'failed') return;
        }
      } catch {
        // Transient network error: keep polling.
      }
      if (active) timer = setTimeout(poll, 3000);
    };

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [analysisId]);

  /** Step 3: contact gate. Persists the lead and triggers both emails. */
  async function handleUnlock(contact: GateContact) {
    if (!analysisId || unlocking) return;
    setUnlockError(null);
    setUnlocking(true);

    try {
      const res = await fetch(`/api/analyses/${analysisId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.details) ? data.details.join(', ') : data.error;
        throw new Error(detail || `Server returned ${res.status}`);
      }
      setDeliveredEmail(contact.email);
      setPhase('delivered');
    } catch (err) {
      setUnlockError(
        err instanceof Error ? err.message : 'Could not send the report. Please try again.',
      );
    } finally {
      setUnlocking(false);
    }
  }

  // ---- Phase: failed ------------------------------------------------------
  if (status?.status === 'failed') {
    return (
      <FormCard id="audit" className={s.formCard}>
        <div className={`${s.statusPanel} ${s.statusPanelError}`}>
          <div className={s.statusEyebrow}>Analysis failed</div>
          <h3 className={s.statusTitle}>The pipeline hit an error</h3>
          <p className={s.statusText}>
            {status.error || 'Unknown error.'} Reload the page to try again.
          </p>
          <div className={s.statusId}>{status.analysis_id}</div>
        </div>
      </FormCard>
    );
  }

  // ---- Phase: running -----------------------------------------------------
  if (phase === 'running') {
    return (
      <FormCard id="audit" className={s.formCard}>
        <div className={s.statusPanel}>
          <div className={s.statusEyebrow}>Building your report</div>
          <h3 className={s.statusTitle}>Scanning the AI engines</h3>
          <p className={s.statusText}>
            This takes about three minutes. We are running {brand || 'your brand'}{' '}
            against the major AI engines and writing the report.
          </p>
          <div className={s.stageRow}>
            <span className={s.spinner} />
            {status?.stage_label || 'Queued'}
          </div>
          {analysisId && <div className={s.statusId}>{analysisId}</div>}
        </div>
      </FormCard>
    );
  }

  // ---- Phase: unlock (blurred real report + inline gate) ------------------
  if (phase === 'unlock' && analysisId) {
    return (
      <FormCard id="audit" className={s.formCard}>
        <ReportPreview
          analysisId={analysisId}
          brand={brand}
          onSubmit={handleUnlock}
          submitting={unlocking}
          error={unlockError}
        />
      </FormCard>
    );
  }

  // ---- Phase: delivered ---------------------------------------------------
  if (phase === 'delivered') {
    return (
      <FormCard id="audit" className={s.formCard}>
        <div className={s.statusPanel}>
          <div className={s.statusEyebrow}>Report sent</div>
          <h3 className={s.statusTitle}>Your audit is on its way</h3>
          <p className={s.statusText}>
            We emailed the full audit PDF for {brand || 'your brand'} to{' '}
            <strong>{deliveredEmail}</strong>. A GMS specialist will follow up to
            walk through the findings.
          </p>
          {analysisId && <div className={s.statusId}>{analysisId}</div>}
        </div>
      </FormCard>
    );
  }

  // ---- Phase: queries (review + edit the 5 prompts) ----------------------
  if (phase === 'queries') {
    return (
      <FormCard id="audit" className={s.formCard}>
        <form onSubmit={handleRunSubmit}>
          <div className={s.fieldGroup}>
            <div className={s.statusEyebrow}>Step 2 of 2</div>
            <h3 className={s.statusTitle}>Review the prompts we will test</h3>
            <div className={s.fieldHelp}>
              These are the customer-style searches we run against the AI engines.
              Edit them to match how your customers actually search. Do not include
              your brand name.
            </div>
          </div>

          {customQueries.map((q, i) => (
            <div className={s.fieldGroup} key={i}>
              <FieldLabel htmlFor={`query-${i}`}>Prompt {i + 1}</FieldLabel>
              <TextInput
                type="text"
                id={`query-${i}`}
                value={q}
                onChange={(e) => updateQuery(i, e.target.value)}
                placeholder="where can I find … near …"
              />
            </div>
          ))}

          <SubmitButton loading={launching}>
            {launching ? 'Starting…' : 'Run the audit'}
          </SubmitButton>

          {runError && (
            <div className={s.submitError} role="alert">
              Could not start the audit: {runError}
            </div>
          )}

          <div className={s.deliveryTag}>
            We add a few auto-generated prompts to round out the analysis.
          </div>
        </form>
      </FormCard>
    );
  }

  // ---- Phase: scope form (default) ---------------------------------------
  return (
    <FormCard id="audit" className={s.formCard}>
      <form onSubmit={handleScopeSubmit}>
        <div className={s.fieldGroup}>
          <FieldLabel htmlFor="domain" required>
            Domain
          </FieldLabel>
          <TextInput
            type="text"
            id="domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example-clinic.com"
            required
          />
        </div>

        <div className={s.fieldGroup}>
          <FieldLabel htmlFor="brand" required>
            Brand name
          </FieldLabel>
          <div className={s.fieldHelp}>
            How customers refer to your business. Used to track exact-name mentions.
          </div>
          <TextInput
            type="text"
            id="brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Dr. Jonathan Schwitzer Plastic Surgery"
            required
          />
        </div>

        <div className={s.fieldRow}>
          <div className={s.fieldGroupFlush}>
            <FieldLabel htmlFor="location" required>
              Location
            </FieldLabel>
            <TextInput
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Bay Harbor Islands, FL"
              required
            />
          </div>
          <div className={s.fieldGroupFlush}>
            <FieldLabel htmlFor="sector" required>
              Sector
            </FieldLabel>
            <TextInput
              type="text"
              id="sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Plastic surgery"
              required
            />
          </div>
        </div>

        <div className={s.fieldGroupSpaced}>
          <FieldLabel htmlFor="product" required>
            Product or service
          </FieldLabel>
          <TextInput
            type="text"
            id="product"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="Rhinoplasty, facelift, breast augmentation"
            required
          />
        </div>

        <SubmitButton loading={starting}>
          {starting ? 'Preparing prompts…' : 'Continue'}
        </SubmitButton>

        {runError && (
          <div className={s.submitError} role="alert">
            Could not start the audit: {runError}
          </div>
        )}

        <div className={s.deliveryTag}>Free. Four AI engines. No login.</div>
      </form>
    </FormCard>
  );
}
