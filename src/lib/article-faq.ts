/**
 * Per-article FAQ (2–4 Q&As) generated with each rewrite run.
 * Stored as a marked HTML section at the end of article content for zero-schema migration.
 */

export interface ArticleFaqItem {
  question: string;
  answer: string;
}

const FAQ_SECTION_RE =
  /<section\b[^>]*\bdata-article-faq\s*=\s*["']1["'][^>]*>[\s\S]*?<\/section>/i;

export function normalizeFaqItems(raw: unknown): ArticleFaqItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ArticleFaqItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const q = String((item as any).question || (item as any).q || '')
      .replace(/<[^>]*>/g, '')
      .trim();
    const a = String((item as any).answer || (item as any).a || '')
      .replace(/<[^>]*>/g, '')
      .trim();
    if (q.length < 8 || a.length < 20) continue;
    out.push({ question: q, answer: a });
    if (out.length >= 4) break;
  }
  return out;
}

export function buildArticleFaqHtml(items: ArticleFaqItem[]): string {
  const faq = normalizeFaqItems(items);
  if (faq.length < 2) return '';

  const details = faq
    .map(
      (item, i) => `
<details class="group rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
  <summary class="flex items-center justify-between gap-3 p-3.5 cursor-pointer list-none select-none">
    <span class="flex items-center gap-2.5 text-left">
      <span class="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 font-mono">${i + 1}</span>
      <span class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">${escapeHtml(item.question)}</span>
    </span>
    <svg class="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
  </summary>
  <div class="px-4 pb-4 pt-1 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300 border-t border-slate-200/60 dark:border-slate-700/60">
    <p>${escapeHtml(item.answer)}</p>
  </div>
</details>`
    )
    .join('\n');

  return `
<section class="article-faq-block my-8 not-prose" data-article-faq="1" aria-label="Article FAQ">
  <div class="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">
    <div class="p-4 sm:p-5 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
      <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <div>
        <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">Reader FAQ</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Quick answers grounded in this report</p>
      </div>
    </div>
    <div class="p-4 sm:p-5 space-y-3">
      ${details}
    </div>
  </div>
</section>`.trim();
}

export function extractArticleFaq(content: string | null | undefined): ArticleFaqItem[] {
  if (!content) return [];
  const sectionMatch = content.match(FAQ_SECTION_RE);
  if (!sectionMatch) return [];
  const section = sectionMatch[0];
  const items: ArticleFaqItem[] = [];
  const detailRe =
    /<summary[\s\S]*?<span class="text-xs sm:text-sm[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/summary>[\s\S]*?<div class="px-4 pb-4[^"]*"[^>]*>\s*<p>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = detailRe.exec(section)) !== null) {
    const q = stripTags(m[1]).trim();
    const a = stripTags(m[2]).trim();
    if (q.length >= 8 && a.length >= 20) items.push({ question: q, answer: a });
  }
  return items.slice(0, 4);
}

/** Remove FAQ block so body partition / prose does not double-render it. */
export function stripArticleFaq(content: string | null | undefined): string {
  if (!content) return '';
  return content.replace(FAQ_SECTION_RE, '').trim();
}

export function appendArticleFaq(
  content: string,
  faq: unknown
): string {
  const html = buildArticleFaqHtml(normalizeFaqItems(faq));
  if (!html) return content || '';
  const base = stripArticleFaq(content);
  return `${base}\n\n${html}`;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
