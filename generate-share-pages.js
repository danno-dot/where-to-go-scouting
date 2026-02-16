/**
 * Generate Social Share Pages for Where To Go Scouting
 * 
 * This script fetches all adventures from the Google Sheet and creates
 * a small HTML page for each one with the correct Open Graph meta tags.
 * 
 * When someone shares a link like:
 *   https://danno-dot.github.io/where-to-go-scouting/share/Gettysburg-Historic-Trail
 * 
 * Social media crawlers (Facebook, Twitter, Discord, etc.) will see the
 * adventure's photo, title, and description in the preview.
 * 
 * Real visitors get instantly redirected to the Squarespace page.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// === CONFIGURATION ===
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyAuWMOtbz5ZyoV4LNKLBMi9-HdKEYo_bsCykVpn639RE2Z6l4oHjpt_Qtf_EXaWtnDSA/exec';
const SITE_URL = 'https://www.wheretogoscouting.com';
const SHARE_BASE = 'https://danno-dot.github.io/where-to-go-scouting';
const OUTPUT_DIR = './share-output';
const FALLBACK_IMAGE = 'https://images.squarespace-cdn.com/content/v1/6578c5765939630ec44e7bdc/1eacc902-bb2e-47d9-ad58-59e68ed8f7f6/where-to-go-scouting-logo-a+copy.png';

// === HELPERS ===

/**
 * Convert Google Drive URLs to direct viewable image URLs
 */
function getDirectImageUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  raw = raw.trim();
  if (!raw) return null;

  // Google Drive file link: drive.google.com/file/d/FILEID/...
  const driveMatch = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=s1200`;
  }

  // Google Drive open link: drive.google.com/open?id=FILEID
  const openMatch = raw.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (openMatch) {
    return `https://lh3.googleusercontent.com/d/${openMatch[1]}=s1200`;
  }

  // Google Drive uc link: drive.google.com/uc?id=FILEID
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

  return FALLBACK_IMAGE;
}

/**
 * Create a URL-safe slug from adventure name
 */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Truncate text to a maximum length
 */
function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Generate the HTML for a share page
 */
function generateSharePage(adventure) {
  const title = adventure['Experience Name'] || 'Scouting Adventure';
  const description = adventure['Description'] || 'Discover this amazing scouting adventure on Where To Go Scouting!';
  const image = getShareImage(adventure);
  const category = adventure['Category'] || '';
  const city = adventure['City'] || '';
  const state = adventure['State'] || '';
  const location = [city, state].filter(Boolean).join(', ');
  const slug = slugify(title);
  const canonicalUrl = `${SITE_URL}/explore?adventure=${encodeURIComponent(title)}`;
  const shareUrl = `${SHARE_BASE}/share/${slug}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Where To Go Scouting</title>

  <!-- Open Graph (Facebook, LinkedIn, Discord, etc.) -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(truncate(description, 200))}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${escapeHtml(shareUrl)}" />
  <meta property="og:site_name" content="Where To Go Scouting" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(truncate(description, 200))}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <!-- Redirect real visitors to the actual site -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; margin: 0;
      background: #1a1a1a; color: #f6d13b;
      text-align: center; padding: 20px;
    }
    a { color: #f6d13b; }
    .container { max-width: 500px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #ccc; font-size: 14px; }
    .redirect-link {
      display: inline-block; margin-top: 20px;
      padding: 12px 32px; background: #f6d13b; color: #1a1a1a;
      text-decoration: none; border-radius: 50px; font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(title)}</h1>
    ${category ? `<p>${escapeHtml(category)}${location ? ' · ' + escapeHtml(location) : ''}</p>` : ''}
    <p>Redirecting to Where To Go Scouting...</p>
    <a href="${escapeHtml(canonicalUrl)}" class="redirect-link">View Adventure →</a>
  </div>
  <script>window.location.href = ${JSON.stringify(canonicalUrl)};</script>
</body>
</html>`;
}

/**
 * Generate an index page listing all adventures
 */
function generateIndexPage(adventures) {
  const rows = adventures
    .filter(a => a['Experience Name'])
    .sort((a, b) => (a['Experience Name'] || '').localeCompare(b['Experience Name'] || ''))
    .map(a => {
      const name = a['Experience Name'];
      const slug = slugify(name);
      const category = a['Category'] || '';
      return `<li><a href="./share/${slug}">${escapeHtml(name)}</a>${category ? ` <span style="color:#888;font-size:13px">· ${escapeHtml(category)}</span>` : ''}</li>`;
    })
    .join('\n        ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Share Adventures - Where To Go Scouting</title>
  <meta property="og:title" content="Where To Go Scouting - Share Adventures" />
  <meta property="og:description" content="Share scouting adventures with your friends and family!" />
  <meta property="og:image" content="${FALLBACK_IMAGE}" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; margin: 0; padding: 40px 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #1a1a1a; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 30px; }
    .count { background: #1a1a1a; color: #f6d13b; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    ul { list-style: none; padding: 0; }
    li { padding: 10px 16px; border-bottom: 1px solid #e2e8f0; }
    li:hover { background: #edf2f7; }
    a { color: #2b6cb0; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    .info { background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 14px; color: #2c5282; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Where To Go Scouting <span class="count">${adventures.filter(a => a['Experience Name']).length} adventures</span></h1>
    <p class="subtitle">Shareable adventure links with social media previews</p>
    <div class="info">
      These links show adventure photos and details when shared on Facebook, Twitter, Discord, LinkedIn, and other platforms. Copy any link below to share!
    </div>
    <ul>
        ${rows}
    </ul>
  </div>
</body>
</html>`;
}

/**
 * Fetch data from Google Sheet via HTTPS
 */
function fetchData(url) {
  return new Promise((resolve, reject) => {
    const makeRequest = (reqUrl, redirectCount) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      const parsedUrl = new URL(reqUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      };

      https.get(options, (res) => {
        // Follow redirects (Google Apps Script redirects)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          makeRequest(res.headers.location, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse JSON: ' + e.message));
          }
        });
      }).on('error', reject);
    };

    makeRequest(url, 0);
  });
}

// === MAIN ===

async function main() {
  console.log('Fetching adventures from Google Sheet...');

  const raw = await fetchData(GOOGLE_SCRIPT_URL);
  
  // The Google Apps Script returns different structures depending on the endpoint
  // Try: raw.rows, raw.data, or raw itself
  const adventures = raw.rows || raw.data || (Array.isArray(raw) ? raw : null);

  if (!Array.isArray(adventures)) {
    console.error('Response keys:', Object.keys(raw || {}));
    throw new Error('Expected array of adventures, got: ' + typeof adventures);
  }

  console.log(`Found ${adventures.length} adventures`);

  // Create output directories
  const shareDir = path.join(OUTPUT_DIR, 'share');
  fs.mkdirSync(shareDir, { recursive: true });

  let generated = 0;
  let skipped = 0;
  const slugs = new Set();

  for (const adventure of adventures) {
    const name = adventure['Experience Name'];
    if (!name) {
      skipped++;
      continue;
    }

    const slug = slugify(name);

    // Handle duplicate slugs
    if (slugs.has(slug)) {
      console.warn(`  Duplicate slug: ${slug} (from "${name}") - skipping`);
      skipped++;
      continue;
    }
    slugs.add(slug);

    // Generate and write the share page
    const html = generateSharePage(adventure);
    const filePath = path.join(shareDir, slug, 'index.html');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, html);
    generated++;
  }

  // Generate index page
  const indexHtml = generateIndexPage(adventures);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexHtml);

  console.log(`\nDone!`);
  console.log(`  Generated: ${generated} share pages`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Output: ${OUTPUT_DIR}/`);
  console.log(`\nShare URLs will be:`);
  console.log(`  ${SHARE_BASE}/share/{adventure-slug}`);
  console.log(`  Example: ${SHARE_BASE}/share/gettysburg-historic-trail-and-battlefield`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
