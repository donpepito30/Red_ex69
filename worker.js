import { onRequestGet as handleModelsGet } from './functions/api/models.js';
import { onRequestPost as handleGeminiChatPost } from './functions/api/gemini/chat.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Endpoint API /api/models
    if (url.pathname === '/api/models' || url.pathname === '/api/models/') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
      return handleModelsGet({ request, env, waitUntil: (p) => ctx.waitUntil && ctx.waitUntil(p) });
    }

    // Endpoint API /api/gemini/chat
    if (url.pathname === '/api/gemini/chat' || url.pathname === '/api/gemini/chat/') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
      return handleGeminiChatPost({ request, env, waitUntil: (p) => ctx.waitUntil && ctx.waitUntil(p) });
    }

    // Servir activos estáticos desde la carpeta ./dist
    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);
      if (response.status === 404 && !url.pathname.startsWith('/api/')) {
        // Fallback para SPA en Cloudflare Worker
        const indexRequest = new Request(new URL('/index.html', request.url), request);
        return env.ASSETS.fetch(indexRequest);
      }
      return response;
    }

    return new Response('Not found', { status: 404 });
  },
};
