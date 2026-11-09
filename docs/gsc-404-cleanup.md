# GSC 404 cleanup (2026-11-09)

## What Google reported
- **299** URLs under **Not found (404)**
- Almost all are `/news/{slug}-{random5}` **duplicate tail** variants from older spam inserts
- Chart shows the count jumped to **299** on **2026-10-24** and stayed there

## What we verified
- Random-tail 404 examples are **not** in D1 (e.g. `...-pfmx6`, `...-iwemz`)
- Canonical short/long slugs that still exist **do** remain in D1 and sitemap where intended
- We **cannot rewrite** those dead URLs into content — correct response is **404**

## What “clean” means here
1. **Do not** put tail-spam URLs back into sitemap or RSS
2. Keep serving **404** for those paths (already true)
3. In Google Search Console → Pages → **Not found (404)** → **Validate fix**
4. Google will drop them from the index over time after re-crawl

## Not done in this pass
- No bulk D1 deletes of valid published articles
- No mass 301 redirects (would re-attach junk equity to wrong stories)

## Next SEO steps (optional)
- Export remaining “Crawled – not indexed” list and review quality
- Keep sitemap limited to real published URLs only
