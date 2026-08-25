import { GoogleGenAI } from '@google/genai';

const CACHE = new Map<string, { data: any[]; timestamp: number }>();

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    // 1. MANEJO DE RUTAS DE API (Reemplazo de Express)
    if (url.pathname.startsWith('/api/')) {
      try {
        // --- API: /api/models ---
        if (url.pathname === '/api/models' && request.method === 'GET') {
          const targetUrl = new URL('https://go.whitetrafsa.com/api/models');
          const allowedKeys = ['limit', 'gender', 'tags', 'search', 'status', 'isLovenseOnly', 'isHdOnly', 'language', 'profileEthnicity', 'profileHairColor', 'profileBodyType', 'sort'];
          
          for (const key of allowedKeys) {
            if (url.searchParams.has(key)) {
              const val = String(url.searchParams.get(key) || '').replace(/[^\w\s\-\.,ñáéíóúÁÉÍÓÚ]/gi, '').trim();
              if (val) targetUrl.searchParams.set(key, val);
            }
          }
          targetUrl.searchParams.set('status', 'public');
          let limitVal = parseInt(targetUrl.searchParams.get('limit') || '300', 10);
          if (isNaN(limitVal) || limitVal < 1 || limitVal > 500) limitVal = 300;
          targetUrl.searchParams.set('limit', limitVal.toString());

          const cacheKey = targetUrl.toString();
          const cached = CACHE.get(cacheKey);
          const now = Date.now();
          
          if (cached && now - cached.timestamp < 30000) {
            return new Response(JSON.stringify(cached.data), {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=30, stale-while-revalidate=120'
              }
            });
          }

          try {
            const controller = new AbortController();
            // Use setTimeout compatible with CF Workers (pass function)
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            
            const apiRes = await fetch(targetUrl.toString(), {
              method: 'GET',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
              },
              signal: controller.signal as any
            });
            clearTimeout(timeoutId);

            if (!apiRes.ok) {
              if (cached) {
                return new Response(JSON.stringify(cached.data), {
                  headers: { 'Content-Type': 'application/json', 'X-Cache-Fallback': 'true' }
                });
              }
              return new Response(JSON.stringify({ error: 'Error al consultar el servicio de transmisión.' }), {
                status: apiRes.status,
                headers: { 'Content-Type': 'application/json' }
              });
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

            return new Response(JSON.stringify(formattedModels), {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=30, stale-while-revalidate=120'
              }
            });
          } catch (error) {
            if (cached) {
              return new Response(JSON.stringify(cached.data), {
                headers: { 'Content-Type': 'application/json', 'X-Cache-Fallback': 'true' }
              });
            }
            return new Response(JSON.stringify({ error: 'Error interno al procesar el catálogo de transmisiones.' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        // --- API: /api/gemini/chat ---
        if (url.pathname === '/api/gemini/chat' && request.method === 'POST') {
          const body: any = await request.json().catch(() => ({}));
          const { prompt, modelUsername } = body;
          
          if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
            return new Response(JSON.stringify({ error: 'El mensaje ingresado no es válido.' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const sanitizedPrompt = prompt.replace(/[\0\x08\x09\x1a]/g, '').slice(0, 500).trim();
          const sanitizedUsername = String(modelUsername || '').replace(/[^\w\s\-]/gi, '').slice(0, 50).trim();

          const apiKey = env.GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
          if (!apiKey) {
            return new Response(JSON.stringify({ text: 'Respuesta generada (Simulación): ¡Hola! Gracias por tu mensaje en el chat.' }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const ai = new GoogleGenAI({ apiKey });
          let systemInstruction = `Eres un asistente amable para un sitio de transmisión en vivo.`;
          
          if (sanitizedUsername) {
            systemInstruction = `Estás interpretando a la modelo de transmisión en vivo con username "${sanitizedUsername}". Tu personalidad es muy coqueta, cariñosa y amigable. Responde de manera breve y entusiasta (máximo 2 frases) al mensaje del usuario en el chat live. Idioma: Español.`;
          }
          
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: sanitizedPrompt,
            config: {
              systemInstruction,
              temperature: 0.8,
              maxOutputTokens: 150,
            },
          });

          return new Response(JSON.stringify({ text: response.text || '¡Gracias por estar en la transmisión!' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ error: 'Not Found API' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 2. MANEJO DE ASSETS Y SPA FALLBACK
    if (env.ASSETS) {
      try {
        let response = await env.ASSETS.fetch(request);
        if (response.status === 404) {
          const indexUrl = new URL(request.url);
          indexUrl.pathname = '/index.html';
          return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
        }
        return response;
      } catch (e) {
        return new Response("Error sirviendo assets estáticos", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
