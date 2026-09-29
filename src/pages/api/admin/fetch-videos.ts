import type { APIRoute } from 'astro';
import { getD1, createVideoArticle, getVideoArticles } from '../../../lib/runtime-db';
import { decideCategories } from '../../../lib/category-mapper';


// Top verified Nigerian Broadcast Channels with their public YouTube channel IDs
const VERIFIED_CHANNELS = [
  {
    name: 'Channels Television',
    channelId: 'UCv4b_JvY_3vE4Nl4hB_h8sw',
    url: 'https://www.youtube.com/@ChannelsTelevision'
  },
  {
    name: 'Arise News',
    channelId: 'UC0PjI9tE0i-2m1K9wVp8Wmg',
    url: 'https://www.youtube.com/@ARISEONLINE'
  },
  {
    name: 'TVC News Nigeria',
    channelId: 'UCgB3eYvO15yv1Yk_7Zf6-7g',
    url: 'https://www.youtube.com/@TVCNewsNigeria'
  }
];

// Helper to parse XML Atom Feed from YouTube
function parseYouTubeAtom(xmlText: string): Array<{
  id: string;
  title: string;
  summary: string;
  videoUrl: string;
  thumbnailUrl: string;
  publishedAt: string;
}> {
  const entries: Array<any> = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = entryRegex.exec(xmlText)) !== null) {
    const entryBlock = match[1];

    const videoIdMatch = entryBlock.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i);
    const titleMatch = entryBlock.match(/<title>([^<]+)<\/title>/i);
    const descMatch = entryBlock.match(/<media:description>([\s\S]*?)<\/media:description>/i);
    const thumbMatch = entryBlock.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    const pubMatch = entryBlock.match(/<published>([^<]+)<\/published>/i);

    if (videoIdMatch && titleMatch) {
      const videoId = videoIdMatch[1].trim();
      const rawTitle = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const rawDesc = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      const thumb = thumbMatch ? thumbMatch[1] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const published = pubMatch ? pubMatch[1] : new Date().toISOString();

      entries.push({
        id: videoId,
        title: rawTitle,
        summary: rawDesc.slice(0, 300) || rawTitle,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: thumb,
        publishedAt: published
      });
    }
  }

  return entries;
}

export const POST: APIRoute = async ({ locals }) => {
  const db = getD1(locals);
  const results: any[] = [];
  let totalNewInserted = 0;

  try {
    for (const channel of VERIFIED_CHANNELS) {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;
      
      try {
        const res = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/atom+xml,application/xml,text/xml'
          }
        });

        if (!res.ok) {
          results.push({ channel: channel.name, status: 'error', error: `HTTP ${res.status}` });
          continue;
        }

        const xml = await res.text();
        const items = parseYouTubeAtom(xml);
        let channelInserted = 0;

        for (const item of items.slice(0, 4)) {
          // Check if video already exists
          const existing = await getVideoArticles(db, { search: item.id, limit: 1 });
          const alreadyExists = existing.videos.some(v => v.video_url.includes(item.id));

          if (!alreadyExists) {
            // Classify into high-accuracy topic category
            const decision = decideCategories(item.title, item.summary);
            const categoryId = decision.primary || 'cat_naija_news';


            const slug = (item.title || 'broadcast')
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-')
              .substring(0, 75);

            await createVideoArticle(db, {
              id: `vid_yt_${item.id}`,
              slug: `${slug}-${item.id.slice(0, 6)}`,
              title: item.title,
              summary: item.summary || item.title,
              video_url: item.videoUrl,
              video_type: 'youtube',
              thumbnail_url: item.thumbnailUrl,
              duration_seconds: 300, // standard default estimate
              category_id: categoryId,
              is_featured: channelInserted === 0 && totalNewInserted === 0 ? 1 : 0,
              status: 'published',
              source_name: channel.name,
              source_channel_url: channel.url,
              published_at: item.publishedAt,
            });

            channelInserted++;
            totalNewInserted++;
          }
        }

        results.push({
          channel: channel.name,
          status: 'success',
          itemsFound: items.length,
          newInserted: channelInserted
        });
      } catch (channelErr: any) {
        results.push({
          channel: channel.name,
          status: 'failed',
          error: channelErr?.message || String(channelErr)
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalNewInserted,
      details: results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('fetch-videos API error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err?.message || String(err)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
