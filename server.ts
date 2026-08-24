import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// SEGURIDAD: Deshabilitar cabecera de fingerprinting Express
app.disable('x-powered-by');

// SEGURIDAD: Middleware de Cabeceras HTTP Profesionales (Security Headers)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// SEGURIDAD: Middleware de Rate Limiting en Express (Previene DoS / Brute force)
const expressRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 120; // 120 peticiones
const RATE_LIMIT_WINDOW_MS = 60000; // por minuto (60.000 ms)

// Mantenimiento preventivo: Limpiar entradas expiradas del mapa cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of expressRateLimitMap.entries()) {
    if (now > record.resetTime) {
      expressRateLimitMap.delete(ip);
    }
  }
}, 300000);

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  
  const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  let record = expressRateLimitMap.get(ip);
  
  if (record && now > record.resetTime) {
    expressRateLimitMap.delete(ip);
    record = undefined;
  }
  
  const resetTime = record ? record.resetTime : now + RATE_LIMIT_WINDOW_MS;
  const currentCount = (record?.count || 0) + 1;
  const remaining = Math.max(0, RATE_LIMIT_MAX - currentCount);
  const resetSeconds = Math.ceil((resetTime - now) / 1000);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', resetSeconds.toString());
  
  if (currentCount > RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', resetSeconds.toString());
    return res.status(429).json({ 
      error: 'Demasiadas solicitudes.', 
      message: 'Has superado el límite de peticiones permitido. Por favor, reintenta en un momento.',
      retryAfterSeconds: resetSeconds
    });
  }
  
  expressRateLimitMap.set(ip, {
    count: currentCount,
    resetTime: resetTime
  });
  next();
});

app.use(cors());
app.use(express.json({ limit: '100kb' }));

const CACHE = new Map<string, { data: any[]; timestamp: number }>();

// API: /api/models
app.get('/api/models', async (req, res) => {
  const targetUrl = new URL('https://go.whitetrafsa.com/api/models');
  
  const allowedKeys = ['limit', 'gender', 'tags', 'search', 'status', 'isLovenseOnly', 'isHdOnly', 'language', 'profileEthnicity', 'profileHairColor', 'profileBodyType', 'sort'];
  for (const key in req.query) {
    if (allowedKeys.includes(key)) {
      const val = String(req.query[key] || '').replace(/[^\w\s\-\.,ñáéíóúÁÉÍÓÚ]/gi, '').trim();
      if (val) {
        targetUrl.searchParams.set(key, val);
      }
    }
  }
  
  targetUrl.searchParams.set('status', 'public');
  
  let limitVal = parseInt(targetUrl.searchParams.get('limit') || '300', 10);
  if (isNaN(limitVal) || limitVal < 1 || limitVal > 500) limitVal = 300;
  targetUrl.searchParams.set('limit', limitVal.toString());

  const cacheKey = targetUrl.toString();
  const cached = CACHE.get(cacheKey);
  const now = Date.now();
  
  // Si la caché tiene menos de 30 segundos, responder al instante en 0ms
  if (cached && now - cached.timestamp < 30000) {
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return res.json(cached.data);
  }

  try {
    // Timeout de seguridad de 6 segundos para no congelar la carga
    const apiRes = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!apiRes.ok) {
      // Fallback a caché obsoleta si la API externa responde error
      if (cached) {
        console.warn('API externa respondió error. Sirviendo datos en caché.');
        res.setHeader('X-Cache-Fallback', 'true');
        return res.json(cached.data);
      }
      return res.status(apiRes.status).json({ error: 'Error al consultar el servicio de transmisión.' });
    }

    const rawData: any = await apiRes.json();
    const modelsList = Array.isArray(rawData) ? rawData : (rawData.models || rawData.data || []);

    const formattedModels = modelsList.map((m: any) => ({
      ...m,
      id: m.id || m.username,
      username: m.username || '',
      displayName: m.display_name || m.displayName || m.username || '',
      age: m.age || 18,
      country: m.country || '',
      countryCode: m.country_code || m.countryCode || '',
      gender: m.gender || 'female',
      status: m.status || 'online',
      isLive: m.status === 'public' || m.isLive || true,
      avatarUrl: m.avatarUrl || m.avatar_url || `https://img.strpst.com/images/avatars/${m.username}.jpg`,
      snapshotUrl: m.snapshotUrl || m.snapshot_url || m.popularSnapshotUrl || `https://img.strpst.com/images/vthumbs/${m.username}.jpg`,
      iframeEmbedUrl: m.iframeEmbedUrl || m.iframe_embed_url || `https://stripchat.com/embed/${m.username}`,
      viewersCount: m.viewersCount || m.viewers_count || m.viewers || 0,
      rating: m.rating || 0,
      favoriteCount: m.favoriteCount || m.favorite_count || 0,
      rank: m.rank || 9999,
      topic: m.topic || '',
      tags: m.tags || [],
      languages: m.languages || [],
      ethnicity: m.ethnicity || m.profileEthnicity || '',
      bodyType: m.bodyType || m.profileBodyType || '',
      hairColor: m.hairColor || m.profileHairColor || '',
      tokensPerMin: m.tokensPerMin || m.tokens_per_min || 0,
      isHd: !!(m.isHd || m.is_hd),
      isVr: !!(m.isVr || m.is_vr),
      isLovense: !!(m.isLovense || m.is_lovense),
      broadcastMobile: !!m.broadcastMobile,
      streamWidth: m.stream?.width || 0,
      streamHeight: m.stream?.height || 0,
      avatar: m.avatarUrl || m.avatar_url || `https://img.strpst.com/images/avatars/${m.username}.jpg`,
      thumbnail: m.snapshotUrl || m.snapshot_url || m.popularSnapshotUrl || `https://img.strpst.com/images/vthumbs/${m.username}.jpg`,
      embedUrl: m.iframeEmbedUrl || m.iframe_embed_url || `https://stripchat.com/embed/${m.username}`,
      affiliateUrl: m.affiliateUrl || m.affiliate_url || `https://stripcash.com/live/${m.username}?aff=aff_velvet_101`
    })).filter((m: any) => m.status === 'public' || m.status === 'online' || m.isLive);

    CACHE.set(cacheKey, { data: formattedModels, timestamp: Date.now() });

    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return res.json(formattedModels);
  } catch (error) {
    console.error('Error/Timeout al procesar la API:', error);
    if (cached) {
      console.warn('Servicio timeout/error. Sirviendo caché previa.');
      res.setHeader('X-Cache-Fallback', 'true');
      return res.json(cached.data);
    }
    return res.status(500).json({ 
      error: 'Error interno al procesar el catálogo de transmisiones.' 
    });
  }
});

// API: /api/gemini/chat
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { prompt, modelUsername } = req.body || {};
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: 'El mensaje ingresado no es válido.' });
    }
    
    const sanitizedPrompt = prompt.replace(/[\0\x08\x09\x1a]/g, '').slice(0, 500).trim();
    const sanitizedUsername = String(modelUsername || '').replace(/[^\w\s\-]/gi, '').slice(0, 50).trim();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ text: 'Respuesta generada (Simulación): ¡Hola! Gracias por tu mensaje en el chat.' });
    }
    const ai = new GoogleGenAI({ apiKey });
    
    let systemInstruction = `Eres un asistente amable para un sitio de transmisión en vivo.`;
    
    if (sanitizedUsername) {
      systemInstruction = `Estás interpretando a la modelo de transmisión en vivo con username "${sanitizedUsername}". Tu personalidad es muy coqueta, cariñosa y amigable. Responde de manera breve y entusiasta (máximo 2 frases) al mensaje del usuario en el chat live. Idioma: Español.`;
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: sanitizedPrompt,
      config: {
        systemInstruction,
        temperature: 0.8,
        maxOutputTokens: 150,
      },
    });
    res.json({ text: response.text || '¡Gracias por estar en la transmisión!' });
  } catch (error) {
    console.error('Error in Gemini Chat API:', error);
    res.json({ text: '¡Hola amor! Gracias por tu mensaje. ¡Disfruta el show en vivo!' });
  }
});

// Manejador 404 para rutas de la API que no existen
app.all('/api/{*path}', (_req, res) => {
  res.status(404).json({ error: 'Ruta de API no encontrada o no válida.' });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('{*path}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Express Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled Express Error:', err);
    res.status(err.status || 500).json({
      error: 'Ocurrió un error interno en el servidor.',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Error inesperado.'
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: any): Promise<Response> {
    if (typeof (app as any).fetch === 'function') {
      return (app as any).fetch(request, env, ctx);
    }
    return new Response('Not found', { status: 404 });
  }
};
