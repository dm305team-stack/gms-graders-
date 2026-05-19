import { useEffect, useState, type FormEvent } from 'react';
import { FieldLabel, SubmitButton, TextInput } from '@gms/ui';
import s from './ReportPreview.module.css';

/** Contact captured by the inline unlock gate. */
export interface GateContact {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface ReportPreviewProps {
  /** The completed analysis whose report is rendered, blurred, behind the gate. */
  analysisId: string;
  brand: string;
  /** Submit handler for the unlock gate. */
  onSubmit: (contact: GateContact) => void;
  submitting: boolean;
  error: string | null;
}

/**
 * Blur every report section except the cover, from inside the iframe document.
 * The report markup tags the first page `.section.cover`; the rest stay blurred
 * until the visitor completes the gate.
 */
const BLUR_STYLE =
  '<style>.section:not(.cover){filter:blur(8px);-webkit-filter:blur(8px);' +
  'user-select:none;}</style>';

/**
 * Post-audit unlock screen. Fetches the real rendered report, shows the cover
 * sharp and the rest blurred, with the contact gate inline below.
 */
export function ReportPreview({
  analysisId,
  brand,
  onSubmit,
  submitting,
  error,
}: ReportPreviewProps) {
  const [doc, setDoc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  // Fetch the real report HTML and inject the blur stylesheet.
  useEffect(() => {
    let active = true;
    fetch(`/api/analyses/${analysisId}/report`)
      .then((res) => {
        if (!res.ok) throw new Error(`report not available (${res.status})`);
        return res.text();
      })
      .then((html) => {
        if (!active) return;
        const blurred = html.includes('</head>')
          ? html.replace('</head>', `${BLUR_STYLE}</head>`)
          : `${BLUR_STYLE}${html}`;
        setDoc(blurred);
      })
      .catch((err) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load the report');
        }
      });
    return () => {
      active = false;
    };
  }, [analysisId]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ email, firstName, lastName, phone });
  }

  return (
    <div className={s.wrap}>
      <div className={s.intro}>
        <div className={s.kicker}>Your audit is ready</div>
        <h3 className={s.introTitle}>This is your AEO Visibility Audit</h3>
        <p className={s.introText}>
          The full report for <strong>{brand || 'your brand'}</strong> is done.
          The cover is below. Enter your details to unlock every page and get the
          PDF by email.
        </p>
      </div>

      <div className={s.docFrame}>
        {doc && (
          <iframe
            className={s.doc}
            srcDoc={doc}
            title="AEO audit report preview"
            scrolling="no"
          />
        )}
        {!doc && !loadError && <div className={s.docNote}>Loading your report…</div>}
        {loadError && <div className={s.docNote}>{loadError}</div>}
        <div className={s.fade} aria-hidden="true" />
      </div>

      <form className={s.gate} onSubmit={handleSubmit}>
        <div className={s.gateHead}>
          <span className={s.lock} aria-hidden="true">
            &#128274;
          </span>
          <div>
            <strong className={s.gateTitle}>Unlock the full report</strong>
            <span className={s.gateSub}>
              Every page, every score. Sent to your inbox as a PDF.
            </span>
          </div>
        </div>

        <div className={s.gateField}>
          <FieldLabel htmlFor="g-email" required>
            Email
          </FieldLabel>
          <TextInput
            type="email"
            id="g-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className={s.gateRow}>
          <div className={s.gateFieldFlush}>
            <FieldLabel htmlFor="g-first" required>
              First name
            </FieldLabel>
            <TextInput
              type="text"
              id="g-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jonathan"
              required
            />
          </div>
          <div className={s.gateFieldFlush}>
            <FieldLabel htmlFor="g-last" required>
              Last name
            </FieldLabel>
            <TextInput
              type="text"
              id="g-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Schwitzer"
              required
            />
          </div>
        </div>

        <div className={s.gateField}>
          <FieldLabel htmlFor="g-phone" required>
            Phone
          </FieldLabel>
          <TextInput
            type="tel"
            id="g-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 305 555 0100"
            required
          />
        </div>

        <SubmitButton loading={submitting}>
          {submitting ? 'Sending your report…' : 'Unlock and email my report'}
        </SubmitButton>

        {error && (
          <div className={s.gateError} role="alert">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
