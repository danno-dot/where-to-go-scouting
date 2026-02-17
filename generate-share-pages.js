const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyAuWMOtbz5ZyoV4LNKLBMi9-HdKEYo_bsCykVpn639RE2Z6l4oHjpt_Qtf_EXaWtnDSA/exec';
const SITE_URL = 'https://www.wheretogoscouting.com';
const SHARE_BASE = 'https://danno-dot.github.io/where-to-go-scouting';
const OUTPUT_DIR = './share-output';
const IMAGES_DIR = path.join(OUTPUT_DIR, 'share-images');
const FALLBACK_IMAGE = 'https://images.squarespace-cdn.com/content/v1/6578c5765939630ec44e7bdc/1eacc902-bb2e-47d9-ad58-59e68ed8f7f6/where-to-go-scouting-logo-a+copy.png';

function getDirectImageUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  raw = raw.trim();
  if (!raw) return null;
  var m;
  m = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=s1200';
  m = raw.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=s1200';
  m = raw.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=s1200';
  if (raw.startsWith('http')) return raw;
  return null;
}

function getShareImageUrl(adventure) {
  var cols = ['Group Image Upload (Optional)','Image Upload (Optional)','Second Image Upload (Optional)','Third Image Upload (Optional)'];
  for (var i = 0; i < cols.length; i++) {
    var url = getDirectImageUrl(adventure[cols[i]]);
    if (url) return url;
  }
  return null;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 100);
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function trunc(str, n) {
  if (!str || str.length <= n) return str || '';
  return str.substring(0, n - 3) + '...';
}

function downloadImage(url, destPath, redir) {
  if (redir === undefined) redir = 5;
  return new Promise(function(resolve, reject) {
    if (redir <= 0) { reject(new Error('Too many redirects')); return; }
    var lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadImage(res.headers.location, destPath, redir - 1));
        return;
      }
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      var stream = fs.createWriteStream(destPath);
      res.pipe(stream);
      stream.on('finish', function() { stream.close(); resolve(true); });
      stream.on('error', function(err) { try { fs.unlinkSync(destPath); } catch(e) {} reject(err); });
    }).on('error', reject);
  });
}

function makeSharePage(adv, imgFile) {
  var title = adv['Experience Name'] || 'Scouting Adventure';
  var desc = adv['Description'] || 'Discover this amazing scouting adventure on Where To Go Scouting!';
  var cat = adv['Category'] || '';
  var city = adv['City'] || '';
  var state = adv['State'] || '';
  var loc = [city, state].filter(Boolean).join(', ');
  var slug = slugify(title);
  var canonical = SITE_URL + '/explore?adventure=' + encodeURIComponent(title);
  var shareUrl = SHARE_BASE + '/share/' + slug;
  var img = imgFile ? (SHARE_BASE + '/share-images/' + imgFile) : FALLBACK_IMAGE;

  return [
    '<!DOCTYPE html><html lang="en"><head>',
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">',
    '<title>' + esc(title) + ' - Where To Go Scouting</title>',
    '<meta property="og:type" content="article"/>',
    '<meta property="og:title" content="' + esc(title) + '"/>',
    '<meta property="og:description" content="' + esc(trunc(desc, 200)) + '"/>',
    '<meta property="og:image" content="' + esc(img) + '"/>',
    '<meta property="og:image:width" content="1200"/>',
    '<meta property="og:image:height" content="630"/>',
    '<meta property="og:url" content="' + esc(shareUrl) + '"/>',
    '<meta property="og:site_name" content="Where To Go Scouting"/>',
    '<meta name="twitter:card" content="summary_large_image"/>',
    '<meta name="twitter:title" content="' + esc(title) + '"/>',
    '<meta name="twitter:description" content="' + esc(trunc(desc, 200)) + '"/>',
    '<meta name="twitter:image" content="' + esc(img) + '"/>',
    '<link rel="canonical" href="' + esc(canonical) + '"/>',
    '<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#1a1a1a;color:#f6d13b;text-align:center;padding:20px}a{color:#f6d13b}.btn{display:inline-block;margin-top:20px;padding:12px 32px;background:#f6d13b;color:#1a1a1a;text-decoration:none;border-radius:50px;font-weight:600}</style>',
    '</head><body><div>',
    '<h1>' + esc(title) + '</h1>',
    cat ? '<p style="color:#ccc">' + esc(cat) + (loc ? ' &middot; ' + esc(loc) : '') + '</p>' : '',
    '<p style="color:#ccc">Redirecting to Where To Go Scouting...</p>',
    '<a href="' + esc(canonical) + '" class="btn">View Adventure &rarr;</a>',
    '</div><script>window.location.href=' + JSON.stringify(canonical) + ';</script></body></html>'
  ].join('\n');
}

function makeIndexPage(adventures) {
  var items = adventures
    .filter(function(a) { return a['Experience Name']; })
    .sort(function(a, b) { return (a['Experience Name']||'').localeCompare(b['Experience Name']||''); })
    .map(function(a) {
      var name = a['Experience Name'];
      var cat = a['Category'] || '';
      return '<li><a href="./share/' + slugify(name) + '">' + esc(name) + '</a>' + (cat ? ' <span style="color:#888;font-size:13px">&middot; ' + esc(cat) + '</span>' : '') + '</li>';
    }).join('\n');

  return [
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">',
    '<title>Share Adventures - Where To Go Scouting</title>',
    '<style>body{font-family:sans-serif;background:#f8f9fa;margin:0;padding:40px 20px}.c{max-width:800px;margin:0 auto}h1{color:#1a1a1a}.n{background:#1a1a1a;color:#f6d13b;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600}ul{list-style:none;padding:0}li{padding:10px 16px;border-bottom:1px solid #e2e8f0}li:hover{background:#edf2f7}a{color:#2b6cb0;text-decoration:none;font-weight:500}a:hover{text-decoration:underline}.info{background:#ebf8ff;border:1px solid #bee3f8;border-radius:8px;padding:16px;margin-bottom:24px;font-size:14px;color:#2c5282}</style>',
    '</head><body><div class="c">',
    '<h1>Where To Go Scouting <span class="n">' + adventures.filter(function(a){return a['Experience Name'];}).length + ' adventures</span></h1>',
    '<p style="color:#666">Shareable adventure links with social media previews</p>',
    '<div class="info">These links show adventure photos when shared on Facebook, Twitter, Discord, LinkedIn, and other platforms.</div>',
    '<ul>' + items + '</ul>',
    '</div></body></html>'
  ].join('\n');
}

function fetchJSON(url) {
  return new Promise(function(resolve, reject) {
    var doReq = function(reqUrl, n) {
      if (n > 5) { reject(new Error('Too many redirects')); return; }
      var u = new URL(reqUrl);
      https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'Accept': 'application/json' } }, function(res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { doReq(res.headers.location, n + 1); return; }
        if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
        var d = '';
        res.on('data', function(c) { d += c; });
        res.on('end', function() { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
      }).on('error', reject);
    };
    doReq(url, 0);
  });
}

async function main() {
  console.log('Fetching adventures from Google Sheet...');
  var raw = await fetchJSON(GOOGLE_SCRIPT_URL);
  var adventures = raw.rows || raw.data || (Array.isArray(raw) ? raw : null);

  if (!Array.isArray(adventures)) {
    console.error('Response keys:', Object.keys(raw || {}));
    throw new Error('Expected array, got: ' + typeof adventures);
  }

  console.log('Found ' + adventures.length + ' adventures');

  var shareDir = path.join(OUTPUT_DIR, 'share');
  fs.mkdirSync(shareDir, { recursive: true });
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  var generated = 0, skipped = 0, imgOk = 0, imgFail = 0;
  var slugs = new Set();

  for (var a of adventures) {
    var name = a['Experience Name'];
    if (!name) { skipped++; continue; }
    var slug = slugify(name);
    if (slugs.has(slug)) { console.warn('  Duplicate: ' + slug); skipped++; continue; }
    slugs.add(slug);

    // Download share image
    var imgFile = null;
    var imgUrl = getShareImageUrl(a);
    if (imgUrl) {
      imgFile = slug + '.jpg';
      var imgPath = path.join(IMAGES_DIR, imgFile);
      try {
        console.log('  Downloading image for ' + slug + ': ' + imgUrl.substring(0, 80) + '...');
        await downloadImage(imgUrl, imgPath);
        var sz = fs.statSync(imgPath).size;
        if (sz < 1000) { 
          console.warn('  Image too small (' + sz + ' bytes), skipping');
          fs.unlinkSync(imgPath); imgFile = null; imgFail++; 
        }
        else { 
          console.log('  OK: ' + sz + ' bytes');
          imgOk++; 
        }
      } catch(e) {
        console.warn('  Image fail: ' + slug + ' - ' + e.message);
        imgFile = null; imgFail++;
      }
    }

    // Write share page
    var html = makeSharePage(a, imgFile);
    var fp = path.join(shareDir, slug, 'index.html');
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, html);
    generated++;
  }

  // Index page - save as share-index so it won't overwrite existing index.html
  fs.writeFileSync(path.join(OUTPUT_DIR, 'share-index.html'), makeIndexPage(adventures));

  console.log('\nDone!');
  console.log('  Pages: ' + generated);
  console.log('  Images OK: ' + imgOk);
  console.log('  Images failed: ' + imgFail);
  console.log('  Skipped: ' + skipped);
}

main().catch(function(e) { console.error('Error:', e.message); process.exit(1); });
