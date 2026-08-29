import type { APIRoute } from 'astro';
import { getD1, getArticles, getCategories } from '../lib/runtime-db';
export const prerender=false;
export const GET: APIRoute = async ({ url, locals }) => {
  const db=getD1(locals);
  const [articles,categories]=await Promise.all([getArticles(db,{limit:200}),getCategories(db)]);
  const esc=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const urls=[`<url><loc>${esc(url.origin)}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,...categories.map(c=>`<url><loc>${esc(url.origin)}/category/${esc(c.slug)}</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`),...articles.map(a=>`<url><loc>${esc(url.origin)}/news/${esc(a.slug)}</loc><lastmod>${new Date(a.updated_at||a.published_at).toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`)].join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'}});
};
