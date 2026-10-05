const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net https://*.googlesyndication.com",
    "style-src 'self'",
    "img-src 'self' data: https://*.googlesyndication.com https://*.doubleclick.net https://*.gstatic.com",
    "font-src 'self'",
    "connect-src 'self' https://formspree.io https://*.googlesyndication.com https://*.doubleclick.net",
    "frame-src https://*.googlesyndication.com https://*.doubleclick.net",
    "base-uri 'self'",
    "form-action 'self' https://formspree.io",
    "frame-ancestors 'none'",
  ].join("; "),
};

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }
    // Pages must always be re-checked so visitors get updates right away.
    // CSS/JS links carry a ?v= version, so a new version is a new URL.
    if ((headers.get("Content-Type") || "").includes("text/html")) {
      headers.set("Cache-Control", "no-cache");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
