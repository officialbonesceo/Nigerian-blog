import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ params }) => {
  const { id } = params;
  const cleanId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');

  const html = `<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body>Verification: ${cleanId}</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
