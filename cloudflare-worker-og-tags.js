/**
 * Cloudflare Worker: Dynamic OG Meta Tags for Where To Go Scouting
 * 
 * PURPOSE:
 * When someone shares an adventure link on Facebook, Twitter, LinkedIn, etc.,
 * the social platform's crawler fetches the URL to read OG meta tags.
 * This worker intercepts those requests and injects adventure-specific
 * og:image, og:title, and og:description tags so the social preview
 * shows the adventure's photo instead of the generic site logo.
 * 
 * HOW TO DEPLOY:
 * 1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
 * 2. Paste this code
 * 3. Set up a route: wheretogoscouting.com/explore* → this worker
 *    (In your Cloudflare DNS dashboard for the domain)
 * 
 * HOW IT WORKS:
 * - Detects social media crawlers by User-Agent
 * - If crawler + ?adventure= parameter exists, fetches adventure data from your Google Sheet
 * - Injects og:image (Group Image priority), og:title, og:description into the HTML
 * - Regular visitors get the normal page (passes through to Squarespace)
 */

// Your Google Apps Script URL (same one used by the HTML files)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyAuWMOtbz5ZyoV4LNKLBMi9-HdKEYo_bsCykVpn639RE2Z6l4oHjpt_Qtf_EXaWtnDSA/exec';

// Social media crawler User-Agent patterns
const CRAWLER_PATTERNS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Pinterest',
  'Slackbot',
  'WhatsApp',
  'Discordbot',
  'TelegramBot',
  'Googlebot',     // Google rich results
  'bingbot',
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some(p => ua.includes(p.toLowerCase()));
}

/**
 * Convert Google Drive URLs to direct image URLs
 */
function getDirectImageUrl(raw) {
  if (!raw) return null;
  raw = raw.trim();
  
  // Google Drive file link
  const driveMatch = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=s1200`;
  }
  
  // Google Drive open link
  const openMatch = raw.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (openMatch) {
    return `https://lh3.googleusercontent.com/d/${openMatch[1]}=s1200`;
  }
  
  // Google Drive uc link
  const ucMatch = raw.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (ucMatch) {
    return `https://lh3.googleusercontent.com/d/${ucMatch[1]}=s1200`;
  }
  
  // Already a direct URL
  if (raw.startsWith('http')) return raw;
  
  return null;
}

/**
 * Find the best sharing image for an adventure
 * Priority: Group Image → Image → Second Image → Third Image
 */
function getShareImage(adventure) {
  const columns = [
    'Group Image Upload (Optional)',
    'Image Upload (Optional)',
    'Second Image Upload (Optional)',
    'Third Image Upload (Optional)'
  ];
  
  for (const col of columns) {
    const url = getDirectImageUrl(adventure[col]);
    if (url) return url;
  }
  
  return null;
}

/**
 * Fetch adventure data from Google Sheet
 */
async function fetchAdventure(adventureName) {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const adventures = data.data || data;
    
    if (!Array.isArray(adventures)) return null;
    
    // Find matching adventure (case-insensitive)
    const searchName = adventureName.toLowerCase().trim();
    return adventures.find(a => 
      (a['Experience Name'] || '').toLowerCase().trim() === searchName
    ) || null;
    
  } catch (e) {
    console.error('Failed to fetch adventure data:', e);
    return null;
  }
}

/**
 * Inject OG meta tags into HTML
 */
function injectOGTags(html, adventure) {
  const title = adventure['Experience Name'] || 'Scouting Adventure';
  const description = adventure['Description'] || 'Discover this amazing scouting adventure on Where To Go Scouting!';
  const image = getShareImage(adventure);
  const category = adventure['Category'] || '';
  const city = adventure['City'] || '';
  const state = adventure['State'] || '';
  const location = [city, state].filter(Boolean).join(', ');
  
  // Build OG tags
  let ogTags = `
    <!-- Dynamic OG Tags injected by Cloudflare Worker -->
    <meta property="og:title" content="${escapeAttr(title)} - Where To Go Scouting" />
    <meta property="og:description" content="${escapeAttr(truncate(description, 200))}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Where To Go Scouting" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(truncate(description, 200))}" />
  `;
  
  if (image) {
    ogTags += `
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
    `;
  }
  
  if (location) {
    ogTags += `<meta property="og:locale" content="en_US" />\n`;
  }
  
  // Remove any existing OG tags to avoid duplicates
  html = html.replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/?>/gi, '');
  html = html.replace(/<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/?>/gi, '');
  
  // Inject before </head>
  html = html.replace('</head>', ogTags + '\n</head>');
  
  return html;
}

function escapeAttr(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Main handler
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';
    const adventureName = url.searchParams.get('adventure');
    
    // Only intercept if: crawler + adventure parameter present
    if (!isCrawler(userAgent) || !adventureName) {
      // Pass through to origin (Squarespace)
      return fetch(request);
    }
    
    console.log(`Crawler detected: ${userAgent.substring(0, 50)} - Adventure: ${adventureName}`);
    
    // Fetch adventure data
    const adventure = await fetchAdventure(decodeURIComponent(adventureName));
    
    if (!adventure) {
      // Adventure not found, pass through
      return fetch(request);
    }
    
    // Fetch original page from Squarespace
    const originResponse = await fetch(request);
    
    if (!originResponse.ok || !originResponse.headers.get('content-type')?.includes('text/html')) {
      return originResponse;
    }
    
    // Get HTML and inject OG tags
    let html = await originResponse.text();
    html = injectOGTags(html, adventure);
    
    // Return modified response
    return new Response(html, {
      status: originResponse.status,
      headers: {
        ...Object.fromEntries(originResponse.headers),
        'content-type': 'text/html;charset=UTF-8',
      }
    });
  }
};
