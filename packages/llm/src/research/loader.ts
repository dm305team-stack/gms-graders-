import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESEARCH_DIR = path.resolve(__dirname, '../../../../aeo-research');

const MODULE_FILES = [
  '00-master-framework.md',
  '01-rag-mechanics.md',
  '02-evidence-graphs.md',
  '03-authority-signals.md',
  '04-effect-sizes.md',
  '05-engine-specific.md',
  '06-kpis-and-metrics.md',
  '07-citation-formats.md',
];

let cachedResearch: string | null = null;

export function loadResearchBase(): string {
  if (cachedResearch) return cachedResearch;

  const modules = MODULE_FILES.map((filename) => {
    const filePath = path.join(RESEARCH_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Research module missing: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  });

  cachedResearch = modules.join('\n\n---\n\n');
  return cachedResearch;
}
