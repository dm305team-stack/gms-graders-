# @gms/ui

Shared design system and component library for the GMS graders.

## Design tokens

Components are styled entirely with the CSS custom properties declared in
`@gms/ui/styles/tokens.css`. The consuming app must import that file once,
globally, before anything renders. Without it the components have no colors,
fonts, or shadows.

```ts
// app entry, e.g. src/main.tsx
import '@gms/ui/styles/tokens.css';
```

The token set is the warm-paper system: Fraunces display, DM Sans body,
JetBrains Mono labels, navy/rust/orange accents.

## Conventions

- One component per file: `ComponentName.tsx` plus `ComponentName.module.css`.
- Named exports only.
- Every component accepts an optional `className` to append classes without
  losing the base styles.
- Props are strictly typed. Components that wrap a native element extend its
  HTML attributes (`InputHTMLAttributes`, `ButtonHTMLAttributes`, ...).

```ts
import { Header, FormCard, TextInput } from '@gms/ui';
```

## Components

### HexBackground

Fixed honeycomb pattern with a radial fade mask. Decorative.

```tsx
<HexBackground />
```

### TopRule

Thin accent strip for the top edge of the page.

```tsx
<TopRule />
```

### BrandMark

Square logo tile. Receives the logo glyph as a slot.

```tsx
<BrandMark>
  <svg viewBox="0 0 24 24">{/* logo paths */}</svg>
</BrandMark>
```

### Header

Page header shell: brand cluster, optional nav, optional CTA pill.

```tsx
<Header
  mark={<BrandMark>{logo}</BrandMark>}
  brandName="Growth Marketing Studios"
  productName="AEO Visibility Auditor"
  navItems={[{ label: 'How it works', href: '#how' }]}
  cta={{ label: 'Run an audit', href: '#audit' }}
/>
```

### Pill

Chip primitive. `variant="outline"` is a bordered chip; `variant="ghost"` is
an uppercase label toggle. `dotColor` renders a leading dot.

```tsx
<Pill variant="outline" dotColor="#10a37f">ChatGPT</Pill>
<Pill variant="ghost" active dotColor="var(--accent)" onClick={select}>Miami</Pill>
```

### PillGroup

Container for `Pill`s. `boxed` frames them in a rounded card; `wrap` lays them
out as a centered wrapping row; `separator` is placed between adjacent pills.

```tsx
<PillGroup boxed separator="·">{pills}</PillGroup>
<PillGroup wrap>{pills}</PillGroup>
```

### FormCard

Elevated card surface. Wrap a `<form>` as its child.

```tsx
<FormCard id="audit">
  <form onSubmit={handleSubmit}>{fields}</form>
</FormCard>
```

### FieldLabel

Uppercase field label with an optional required asterisk.

```tsx
<FieldLabel htmlFor="email" required>Email</FieldLabel>
```

### TextInput

Styled text input. Accepts any native input type.

```tsx
<TextInput type="email" id="email" value={email} onChange={onChange} required />
```

### Select

Styled select control.

```tsx
<Select id="specialty" value={value} onChange={onChange}>
  <option value="">Select…</option>
</Select>
```

### Checkbox

Checkbox with an inline label, laid out horizontally. `id` is required so the
label binds to the input.

```tsx
<Checkbox id="confirm" checked={confirmed} onChange={onChange} label="I confirm." />
```

### SubmitButton

Solid accent submit button with a trailing arrow. `loading` disables it and
signals an in-flight submit.

```tsx
<SubmitButton loading={submitting}>Run scan</SubmitButton>
```

### VectorsStrip

Footer strip with a lead phrase and an accent-colored highlight.

```tsx
<VectorsStrip lead="The 4 /" highlight="AI engines evaluated" />
```
