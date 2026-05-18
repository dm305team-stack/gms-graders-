# GMS Graders

Monorepo de herramientas de diagnóstico (graders) de Growth Marketing Studios.

## Quick start

```bash
pnpm install
pnpm dev:aeo    # arranca el AEO Visibility Auditor
pnpm dev:hipaa  # arranca el HIPAA Privacy Express Auditor
```

## Estructura

- `apps/` — graders desplegables, uno por dominio
- `packages/` — código compartido entre graders
- `supabase/` — schemas y migraciones de base de datos

Ver [`CLAUDE.md`](./CLAUDE.md) para reglas operativas, stack, y filosofía del proyecto.

## Graders activos

| Slug | App | Dominio | Estado |
|---|---|---|---|
| `hipaa` | `apps/hipaa-auditor` | TBD | en migración |
| `aeo` | `apps/aeo-auditor` | TBD | en desarrollo |

---

Growth Marketing Studios · Miami
