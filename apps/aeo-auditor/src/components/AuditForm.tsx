import { useEffect, useState, type FormEvent } from 'react';
import {
  Checkbox,
  FieldLabel,
  FormCard,
  Select,
  SubmitButton,
  TextInput,
} from '@gms/ui';
import s from './AuditForm.module.css';

type Specialty =
  | ''
  | 'plastic_surgery'
  | 'dental'
  | 'dermatology'
  | 'orthopedics'
  | 'ophthalmology'
  | 'obgyn'
  | 'cardiology'
  | 'other';

type OrgType =
  | 'clinic'
  | 'dental'
  | 'law_firm'
  | 'real_estate'
  | 'public_adjuster'
  | 'other';

/** Live status of a queued analysis, polled from GET /api/analyses/:id. */
interface AnalysisStatus {
  analysis_id: string;
  status: string;
  stage_label: string;
  error: string | null;
  overall_scores: Record<string, number> | null;
  report_url: string | null;
  pdf_url: string | null;
  email: { sent?: boolean; skipped?: boolean; error?: string } | null;
}

const TERMINAL_STATUS = new Set(['done', 'failed']);
const ENGINE_KEYS = ['chatgpt', 'perplexity', 'gemini', 'claude'] as const;

/** The AEO lead-capture form: scope inputs, contact, and submission. */
export function AuditForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus | null>(null);

  const [domain, setDomain] = useState('');
  const [brand, setBrand] = useState('');
  const [location, setLocation] = useState('');
  const [specialty, setSpecialty] = useState<Specialty>('');
  const [yt, setYt] = useState('');
  const [ig, setIg] = useState('');
  const [tt, setTt] = useState('');
  const [fb, setFb] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('clinic');
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);

    const payload = {
      domain,
      brand,
      location,
      specialty,
      social: { yt, ig, tt, fb },
      contact: { name, company, email, phone },
      org_type: orgType,
      confirm_authorized: confirmed,
    };

    try {
      const res = await fetch('/api/run-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.details) ? data.details.join(', ') : data.error;
        throw new Error(detail || `Server returned ${res.status}`);
      }
      setAnalysisId(data.analysis_id as string);
      setStatus({
        analysis_id: data.analysis_id as string,
        status: data.status ?? 'queued',
        stage_label: 'Queued',
        error: null,
        overall_scores: null,
        report_url: null,
        pdf_url: null,
        email: null,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
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
          if (TERMINAL_STATUS.has(data.status)) return;
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

  function renderStatus(st: AnalysisStatus) {
    if (st.status === 'failed') {
      return (
        <div className={`${s.statusPanel} ${s.statusPanelError}`}>
          <div className={s.statusEyebrow}>Analysis failed</div>
          <h3 className={s.statusTitle}>The pipeline hit an error</h3>
          <p className={s.statusText}>
            {st.error || 'Unknown error.'} Reload the page to try again.
          </p>
          <div className={s.statusId}>{st.analysis_id}</div>
        </div>
      );
    }

    if (st.status === 'done') {
      return (
        <div className={s.statusPanel}>
          <div className={s.statusEyebrow}>Report ready</div>
          <h3 className={s.statusTitle}>Your AEO audit is done</h3>
          <p className={s.statusText}>
            {st.email?.sent
              ? `We emailed the report to ${email}.`
              : 'Report generated. Email delivery is off in this environment — open it below.'}
          </p>
          {st.overall_scores && (
            <div className={s.scoreGrid}>
              {ENGINE_KEYS.map((k) => (
                <div key={k} className={s.scoreCell}>
                  <span>{k}</span>
                  <strong>{st.overall_scores?.[k] ?? 0}</strong>
                </div>
              ))}
            </div>
          )}
          {st.pdf_url && (
            <a className={s.reportLink} href={st.pdf_url} target="_blank" rel="noreferrer">
              Download the PDF report
            </a>
          )}
          {st.report_url && (
            <a className={s.reportLinkSecondary} href={st.report_url} target="_blank" rel="noreferrer">
              View in browser
            </a>
          )}
          <div className={s.statusId}>{st.analysis_id}</div>
        </div>
      );
    }

    return (
      <div className={s.statusPanel}>
        <div className={s.statusEyebrow}>Analysis running</div>
        <h3 className={s.statusTitle}>Scanning the 4 AI engines</h3>
        <p className={s.statusText}>
          This takes a few minutes. We'll email the report to {email} when it is
          ready. You can keep this page open to watch progress.
        </p>
        <div className={s.stageRow}>
          <span className={s.spinner} />
          {st.stage_label}
        </div>
        <div className={s.statusId}>{st.analysis_id}</div>
      </div>
    );
  }

  if (status) {
    return (
      <FormCard id="audit" className={s.formCard}>
        {renderStatus(status)}
      </FormCard>
    );
  }

  return (
    <FormCard id="audit" className={s.formCard}>
      <form onSubmit={handleSubmit}>
        <div className={s.fieldGroup}>
          <FieldLabel htmlFor="domain" required>
            Practice domain
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
            How patients refer to your practice. Used to track exact-name mentions.
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
              Service area
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
            <FieldLabel htmlFor="specialty" required>
              Primary specialty
            </FieldLabel>
            <Select
              id="specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value as Specialty)}
              required
            >
              <option value="">Select…</option>
              <option value="plastic_surgery">Plastic Surgery</option>
              <option value="dental">Dental</option>
              <option value="dermatology">Dermatology</option>
              <option value="orthopedics">Orthopedics</option>
              <option value="ophthalmology">Ophthalmology</option>
              <option value="obgyn">OB-GYN</option>
              <option value="cardiology">Cardiology</option>
              <option value="other">Other</option>
            </Select>
          </div>
        </div>

        <div className={s.fieldGroupSpaced}>
          <FieldLabel>Social media profiles</FieldLabel>
          <div className={s.fieldHelp}>
            Optional, <em>helps the analyzer cross-reference brand signal beyond the site.</em>
          </div>
          <div className={s.socialRow}>
            <div>
              <FieldLabel className={s.subLabel}>YouTube</FieldLabel>
              <TextInput
                type="url"
                value={yt}
                onChange={(e) => setYt(e.target.value)}
                placeholder="https://youtube.com/@clinic"
              />
            </div>
            <div>
              <FieldLabel className={s.subLabel}>Instagram</FieldLabel>
              <TextInput
                type="url"
                value={ig}
                onChange={(e) => setIg(e.target.value)}
                placeholder="https://instagram.com/clinic"
              />
            </div>
          </div>
          <div className={s.socialRowSpaced}>
            <div>
              <FieldLabel className={s.subLabel}>TikTok</FieldLabel>
              <TextInput
                type="url"
                value={tt}
                onChange={(e) => setTt(e.target.value)}
                placeholder="https://tiktok.com/@clinic"
              />
            </div>
            <div>
              <FieldLabel className={s.subLabel}>Facebook</FieldLabel>
              <TextInput
                type="url"
                value={fb}
                onChange={(e) => setFb(e.target.value)}
                placeholder="https://facebook.com/clinic"
              />
            </div>
          </div>
        </div>

        <hr className={s.sectionRule} />

        <div className={s.deliveryNote}>
          <strong>Delivery</strong>
          We'll email the multi-engine PDF report when the scan is ready.
        </div>

        <div className={s.fieldGroup}>
          <FieldLabel htmlFor="name" required>
            Full name
          </FieldLabel>
          <TextInput
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
          />
        </div>

        <div className={s.fieldGroup}>
          <FieldLabel htmlFor="company" required>
            Company
          </FieldLabel>
          <TextInput
            type="text"
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Practice or organization"
            required
          />
        </div>

        <div className={s.fieldRow}>
          <div className={s.fieldGroupFlush}>
            <FieldLabel htmlFor="email" required>
              Email
            </FieldLabel>
            <TextInput
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className={s.fieldGroupFlush}>
            <FieldLabel htmlFor="phone" required>
              Phone
            </FieldLabel>
            <TextInput
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 305 555 0100"
              required
            />
          </div>
        </div>

        <div className={s.fieldGroupSpaced}>
          <FieldLabel htmlFor="orgtype" required>
            Organization type
          </FieldLabel>
          <Select
            id="orgtype"
            value={orgType}
            onChange={(e) => setOrgType(e.target.value as OrgType)}
            required
          >
            <option value="clinic">Clinic / medical practice</option>
            <option value="dental">Dental practice</option>
            <option value="law_firm">Law firm</option>
            <option value="real_estate">Real estate brokerage</option>
            <option value="public_adjuster">Public adjuster</option>
            <option value="other">Other professional service</option>
          </Select>
        </div>

        <Checkbox
          id="confirm"
          className={s.checkboxRow}
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          required
          label="I confirm I am the owner or authorized representative of this brand and domain."
        />

        <SubmitButton loading={submitting}>
          {submitting ? 'Queuing…' : 'Run AEO visibility scan'}
        </SubmitButton>

        {submitError && (
          <div className={s.submitError} role="alert">
            Could not queue the scan: {submitError}
          </div>
        )}

        <div className={s.deliveryTag}>Delivery: typically 15–20 minutes by email</div>
      </form>
    </FormCard>
  );
}
