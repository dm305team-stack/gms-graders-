# AEO Visibility Auditor

Herramienta de diagnóstico que mide cómo aparece una marca en los 4 motores principales de IA: **ChatGPT (GPT-5.2), Perplexity Sonar Pro, Gemini 3 Pro, y Claude Sonnet 4.6**.

Hermana del HIPAA Privacy Express Auditor. Mismo patrón mecánico:
**Form gate → orchestration (4 motores en paralelo) → PDF report → captura de lead → embudo a retainer GMS AEO.**

---

## Diferencia clave con el AEO Grader de HubSpot

HubSpot solo evalúa 3 motores (ChatGPT, Perplexity, Gemini). Nosotros evaluamos 4 incluyendo **Claude**, que es relevante por:

1. Cuota de mercado real en B2B y profesional
2. Sesgo distinto vs los otros 3 (delta = señal)
3. Diferenciación competitiva inmediata vs el grader de HubSpot
4. Costo marginal trivial con prompt caching (~$0.65 extra por análisis)

Además vamos **vertical en healthcare Florida**, no horizontal. Las queries que se ejecutan son específicas del comportamiento de paciente, no de buyer B2B SaaS.

---

## Inputs del formulario

| Campo | Tipo | Required | Uso |
|---|---|---|---|
| `domain` | URL | Sí | Sitio principal de la práctica |
| `brand` | string | Sí | Nombre exacto como lo refieren los pacientes |
| `location` | string | Sí | Ciudad + estado (ej. "Bay Harbor Islands, FL") |
| `specialty` | enum | Sí | Plastic/Dental/Derm/Ortho/Ophthal/OBGYN/Cardio/Other |
| `social.{yt,ig,tt,fb}` | URL | No | Enriquece signal cross-platform |
| `contact.{name,company,email,phone}` | string | Sí | Captura de lead |
| `org_type` | enum | Sí | Clinic / Dental / Law firm / Real estate / Public adjuster / Other |
| `confirm_authorized` | bool | Sí | Anti-abuse, confirma autoridad sobre la marca |

---

## Flujo end-to-end

```
1. User completa form en /
2. POST → /api/run-analysis (Supabase edge function)
3. Edge function:
   a. Inserta lead en shared.leads
   b. Inserta analysis pendiente en aeo.analyses
   c. Encola job en aeo.job_queue
   d. Devuelve {analysis_id, estimated_seconds: 900}
4. Worker procesa job (background):
   a. Etapa A: genera 25-30 queries (Claude Haiku)
   b. Etapa B: lanza queries en paralelo a los 4 motores
   c. Etapa C: parsea cada respuesta (Claude Haiku con prompt caching)
   d. Etapa D: sintetiza reporte (Claude Sonnet 4.6)
   e. Genera PDF
   f. Resend → email con PDF al lead
5. User recibe email "Tu reporte está listo"
```

---

## Componentes del app

Por ahora todo vive en `src/App.tsx`. Cuando empecemos a duplicar entre HIPAA y AEO, subimos a `packages/ui/`:

**Candidatos a subir cuando se dupliquen:**
- `Header` con logo + nav + CTA
- `GeoPills` (los pills de ubicación arriba)
- `ScopePills` (los pills de tags abajo)
- `FormCard` (la card blanca del formulario)
- `FieldLabel` con asterisco rojo
- `SubmitButton` con gradient + shimmer
- `HexBackground`
- `TopRule`

**Por ahora NO subir:**
- El hero (cada grader tiene su propio título y palabras-clave coloreadas)
- Los campos específicos del form (varían por grader)

---

## Endpoint que consume el form

```typescript
POST /api/run-analysis
Content-Type: application/json

{
  "domain": "drjschwitzer.com",
  "brand": "Dr. Jonathan Schwitzer Plastic Surgery",
  "location": "Bay Harbor Islands, FL",
  "specialty": "plastic_surgery",
  "social": { "ig": "https://...", "yt": null, ... },
  "contact": {
    "name": "Jonathan Schwitzer",
    "company": "JS Plastic Surgery",
    "email": "drjs@example.com",
    "phone": "+1-305-..."
  },
  "org_type": "clinic",
  "confirm_authorized": true
}

Response 202:
{
  "analysis_id": "uuid",
  "lead_id": "uuid",
  "estimated_seconds": 900,
  "delivery_email": "drjs@example.com"
}
```

---

## Idioma

- **Producto:** inglés (audiencia objetivo USA + Florida)
- **Mensajes de error visibles:** inglés
- **Comentarios en código:** inglés
- **Comunicación con Claude:** español

---

## Reglas locales (override del root CLAUDE.md cuando aplique)

- Ninguna por ahora. Hereda todas las del root.
