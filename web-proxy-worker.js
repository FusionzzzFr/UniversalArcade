const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 15000;

function isBlockedHostname(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '0.0.0.0' || h === '::' || h === '[::]') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  const m = h.match(/^172\.(\d{1,3})\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (/^\[?(fc|fd|fe8|fe9|fea|feb)[0-9a-f:]*\]?$/i.test(h)) return true;
  if (/^\[?::1\]?$/i.test(h)) return true;
  return false;
}

function validateTarget(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (!/^https?:$/.test(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported');
  if (url.username || url.password) throw new Error('Credentials in URLs are not supported');
  if (isBlockedHostname(url.hostname)) throw new Error('That destination is not allowed');
  return url;
}

function proxiedUrl(workerOrigin, target) {
  const u = new URL(workerOrigin);
  u.searchParams.set('url', target.href);
  return u.href;
}

function rewriteValue(value, base, workerOrigin) {
  if (!value || value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('javascript:') || value.startsWith('mailto:') || value.startsWith('tel:')) return value;
  try {
    const absolute = new URL(value, base);
    if (!/^https?:$/.test(absolute.protocol)) return value;
    return proxiedUrl(workerOrigin, absolute);
  } catch {
    return value;
  }
}

class AttributeRewriter {
  constructor(base, workerOrigin) { this.base = base; this.workerOrigin = workerOrigin; }
  element(element) {
    for (const attr of ['href','src','action','poster']) {
      const value = element.getAttribute(attr);
      if (value) element.setAttribute(attr, rewriteValue(value, this.base, this.workerOrigin));
    }
    const srcset = element.getAttribute('srcset');
    if (srcset) {
      const rewritten = srcset.split(',').map(part => {
        const bits = part.trim().split(/\s+/);
        if (!bits[0]) return part;
        bits[0] = rewriteValue(bits[0], this.base, this.workerOrigin);
        return bits.join(' ');
      }).join(', ');
      element.setAttribute('srcset', rewritten);
    }
    if (element.tagName === 'base') element.remove();
    if (element.tagName === 'meta' && (element.getAttribute('http-equiv') || '').toLowerCase() === 'refresh') element.remove();
  }
}

function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return errorResponse('Only GET and HEAD requests are supported', 405);
    if (requestUrl.pathname !== '/' && requestUrl.pathname !== '/proxy') return errorResponse('Not found', 404);

    const raw = requestUrl.searchParams.get('url');
    if (!raw) return errorResponse('Missing ?url=https://example.com');

    let target;
    try { target = validateTarget(raw); } catch (e) { return errorResponse(e.message); }

    let response;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        response = await fetch(target.href, {
          method: request.method,
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': 'UniversalArcade-WebProxy/1.0',
            'Accept': request.headers.get('Accept') || '*/*',
            'Accept-Language': request.headers.get('Accept-Language') || 'en-US,en;q=0.8'
          }
        });
      } catch (err) {
        clearTimeout(timer);
        return errorResponse('Upstream request failed or timed out', 502);
      }
      clearTimeout(timer);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (!location) return errorResponse('Upstream redirect had no destination', 502);
        try { target = validateTarget(new URL(location, target.href).href); }
        catch (e) { return errorResponse(e.message, 502); }
        continue;
      }
      break;
    }

    if (!response) return errorResponse('No upstream response', 502);
    if (response.status >= 300 && response.status < 400) return errorResponse('Too many redirects', 502);

    const length = Number(response.headers.get('Content-Length') || '0');
    if (length && length > MAX_BODY_BYTES) return errorResponse('Response is too large', 413);

    const headers = new Headers(response.headers);
    for (const name of ['set-cookie','www-authenticate','content-security-policy','content-security-policy-report-only','cross-origin-opener-policy','cross-origin-embedder-policy','cross-origin-resource-policy','permissions-policy','x-frame-options']) headers.delete(name);
    headers.set('cache-control', 'no-store');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('referrer-policy', 'no-referrer');
    headers.set('access-control-allow-origin', '*');

    const contentType = (headers.get('content-type') || '').toLowerCase();
    if (request.method === 'HEAD' || !contentType.includes('text/html')) return new Response(response.body, { status: response.status, headers });

    headers.delete('content-length');
    headers.set('content-type', 'text/html; charset=utf-8');

    const transformed = new HTMLRewriter()
      .on('a', new AttributeRewriter(target.href, request.url))
      .on('form', new AttributeRewriter(target.href, request.url))
      .on('img', new AttributeRewriter(target.href, request.url))
      .on('script', new AttributeRewriter(target.href, request.url))
      .on('link', new AttributeRewriter(target.href, request.url))
      .on('source', new AttributeRewriter(target.href, request.url))
      .on('video', new AttributeRewriter(target.href, request.url))
      .on('audio', new AttributeRewriter(target.href, request.url))
      .on('iframe', new AttributeRewriter(target.href, request.url))
      .on('object', new AttributeRewriter(target.href, request.url))
      .on('base', new AttributeRewriter(target.href, request.url))
      .on('meta', new AttributeRewriter(target.href, request.url))
      .transform(new Response(response.body, { status: response.status, headers }));

    return new Response(transformed.body, { status: response.status, headers });
  }
};
