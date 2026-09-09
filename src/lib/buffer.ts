/**
 * Buffer API Integration for 9jaBeacon Social Media Automation
 * 
 * Posts curated news stories (up to 5 per workflow) to Facebook Page & Instagram
 * with AI-generated engaging captions, high-resolution imagery, and canonical site links.
 */

export interface BufferConfig {
  accessToken: string;
  facebookProfileId?: string;
  instagramProfileId?: string;
  autoPostEnabled: boolean;
  maxPostsPerWorkflow: number;
}

export interface BufferPostPayload {
  title: string;
  summary: string;
  content?: string;
  categoryName?: string;
  imageUrl?: string;
  canonicalUrl: string;
}

export interface BufferPostResult {
  success: boolean;
  postedCount: number;
  profileIds: string[];
  message?: string;
  error?: string;
  details?: any;
}

/**
 * Generates an engaging, platform-tailored social media caption for Nigerian audiences.
 */
export function generateSocialCaption(data: {
  title: string;
  summary: string;
  categoryName?: string;
  canonicalUrl: string;
}): string {
  const category = (data.categoryName || '').toLowerCase();
  
  let hookEmoji = '🇳🇬';
  let categoryTag = '#NaijaNews';
  
  if (category.includes('business') || category.includes('money') || category.includes('economy')) {
    hookEmoji = '📈';
    categoryTag = '#NigeriaEconomy #NaijaBusiness #Naira';
  } else if (category.includes('sport')) {
    hookEmoji = '🦅';
    categoryTag = '#SuperEagles #NaijaSports #Football';
  } else if (category.includes('world')) {
    hookEmoji = '🌍';
    categoryTag = '#GlobalNews #WorldUpdates';
  } else if (category.includes('metro') || category.includes('court') || category.includes('assault')) {
    hookEmoji = '🚨';
    categoryTag = '#MetroNews #NigeriaUpdates';
  } else {
    hookEmoji = '⚡';
    categoryTag = '#Nigeria #BreakingNews #9jaBeacon';
  }

  const cleanSummary = (data.summary || '')
    .replace(/<[^>]*>?/gm, '')
    .trim();

  // Truncate summary if too long for clean reading
  const punchySummary = cleanSummary.length > 280
    ? cleanSummary.slice(0, 277) + '...'
    : cleanSummary;

  const caption = `${hookEmoji} ${data.title.toUpperCase()}

${punchySummary}

👉 Read the full verified report & updates on 9jaBeacon:
${data.canonicalUrl}

${categoryTag} #9jaBeacon #NigeriaToday`;

  return caption;
}

/**
 * Posts an article to connected Buffer channels (Facebook Page and/or Instagram)
 */
export async function postToBuffer(
  config: BufferConfig,
  article: BufferPostPayload
): Promise<BufferPostResult> {
  if (!config.accessToken) {
    return {
      success: false,
      postedCount: 0,
      profileIds: [],
      error: 'Buffer Access Token is missing in Automation Settings.',
    };
  }

  const targetProfileIds: string[] = [];
  if (config.facebookProfileId && config.facebookProfileId.trim()) {
    targetProfileIds.push(config.facebookProfileId.trim());
  }
  if (config.instagramProfileId && config.instagramProfileId.trim()) {
    targetProfileIds.push(config.instagramProfileId.trim());
  }

  if (targetProfileIds.length === 0) {
    return {
      success: false,
      postedCount: 0,
      profileIds: [],
      error: 'No target profile IDs configured (Facebook or Instagram).',
    };
  }

  const text = generateSocialCaption({
    title: article.title,
    summary: article.summary,
    categoryName: article.categoryName,
    canonicalUrl: article.canonicalUrl,
  });

  const results: any[] = [];
  let successfulPosts = 0;
  let lastError = '';

  for (const profileId of targetProfileIds) {
    try {
      const formParams = new URLSearchParams();
      formParams.append('profile_ids[]', profileId);
      formParams.append('text', text);
      formParams.append('now', 'true'); // Post immediately to page/feed

      if (article.imageUrl && article.imageUrl.startsWith('http')) {
        formParams.append('media[photo]', article.imageUrl);
        formParams.append('media[thumbnail]', article.imageUrl);
      }

      formParams.append('media[link]', article.canonicalUrl);
      formParams.append('media[description]', article.title);

      const endpoint = `https://api.bufferapp.com/1/updates/create.json?access_token=${encodeURIComponent(config.accessToken)}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
      });

      const json: any = await response.json().catch(() => ({}));

      if (response.ok && (json.success || json.updates?.length)) {
        successfulPosts++;
        results.push({ profileId, success: true, data: json });
      } else {
        const errMsg = json.message || json.error || `HTTP ${response.status} from Buffer API`;
        lastError = errMsg;
        results.push({ profileId, success: false, error: errMsg });
      }
    } catch (err: any) {
      lastError = err.message || 'Network error communicating with Buffer API';
      results.push({ profileId, success: false, error: lastError });
    }
  }

  return {
    success: successfulPosts > 0,
    postedCount: successfulPosts,
    profileIds: targetProfileIds,
    message: successfulPosts > 0 
      ? `Successfully dispatched to ${successfulPosts} social channel(s).` 
      : `Failed to post to Buffer: ${lastError}`,
    error: successfulPosts === 0 ? lastError : undefined,
    details: results,
  };
}

/**
 * Verifies a Buffer Access Token and retrieves all available profiles (Facebook pages, Instagram accounts)
 */
export async function verifyBufferTokenAndFetchProfiles(accessToken: string): Promise<{
  success: boolean;
  profiles: Array<{
    id: string;
    service: string;
    formatted_service: string;
    service_username: string;
    service_type: string;
    avatar?: string;
  }>;
  error?: string;
}> {
  if (!accessToken) {
    return { success: false, profiles: [], error: 'Access token required.' };
  }

  try {
    const res = await fetch(`https://api.bufferapp.com/1/profiles.json?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) {
      const errJson: any = await res.json().catch(() => ({}));
      return {
        success: false,
        profiles: [],
        error: errJson.message || `Buffer returned status ${res.status}`,
      };
    }

    const profiles = await res.json();
    if (!Array.isArray(profiles)) {
      return { success: false, profiles: [], error: 'Unexpected response from Buffer API' };
    }

    return {
      success: true,
      profiles: profiles.map((p: any) => ({
        id: p.id,
        service: p.service,
        formatted_service: p.formatted_service || p.service,
        service_username: p.service_username || p.name || '',
        service_type: p.service_type || '',
        avatar: p.avatar,
      })),
    };
  } catch (err: any) {
    return {
      success: false,
      profiles: [],
      error: err.message || 'Unable to reach Buffer API',
    };
  }
}
