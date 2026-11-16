'use strict';
// Netlify entry point. Netlify has no long-running Node server, so the whole Express app
// runs inside this one serverless function; netlify.toml routes every page request here.
// Static files (CSS, JS, favicon) are served directly by Netlify's CDN from /public.
const serverless = require('serverless-http');
const app = require('../../src/app');
const { initDatabase } = require('../../database/init');

// Create tables / seed admin once per container (cold start), not on every request.
let ready = null;
function ensureDb() {
  if (!ready) ready = initDatabase().catch((err) => { ready = null; throw err; });
  return ready;
}

const handler = serverless(app, {
  basePath: '/.netlify/functions/server',
  request(req) {
    // Netlify always terminates HTTPS in front of the function. Marking the socket as
    // encrypted lets Express/express-session know the request is secure (Secure cookies)
    // without trusting a client-controllable X-Forwarded-Proto header.
    if (req.connection) req.connection.encrypted = true;
  },
});

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false; // keep the MySQL pool open between requests
  event.headers = event.headers || {};
  // Use the client IP that Netlify itself sets (cannot be spoofed by the client),
  // so rate limiting, audit logs and new-device alerts see the real visitor IP.
  const clientIp = event.headers['x-nf-client-connection-ip'] || '0.0.0.0';
  event.requestContext = { ...(event.requestContext || {}), identity: { ...((event.requestContext || {}).identity || {}), sourceIp: clientIp } };

  try {
    await ensureDb();
  } catch (err) {
    console.error('[netlify] database unavailable:', err.message);
    return {
      statusCode: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      body: 'ShostaBazar is temporarily unavailable (database connection failed). Please try again shortly.',
    };
  }
  return handler(event, context);
};
