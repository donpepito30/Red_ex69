export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const { prompt, modelUsername } = body || {};
    
    // SEGURIDAD: Validación de entrada
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return new Response(JSON.stringify({ error: 'El mensaje no es válido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sanitización y recorte anti Prompt Injection & DoS
    const sanitizedPrompt = prompt.replace(/[\0\x08\x09\x1a]/g, '').slice(0, 500).trim();
    const sanitizedUsername = String(modelUsername || '').replace(/[^\w\s\-]/gi, '').slice(0, 50).trim();

    // Leer del environment de Cloudflare
    const apiKey = context.env?.GEMINI_API_KEY || process.env?.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('⚠️ GEMINI_API_KEY no configurada');
      return new Response(JSON.stringify({
        text: `¡Hola amor! Gracias por tu mensaje. ¡Disfruta el show en vivo de ${sanitizedUsername || 'la modelo'}! ❤️`,
        warning: 'API key not configured'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ 
              text: sanitizedPrompt 
            }] 
          }],
          systemInstruction: {
            parts: [{ 
              text: `Estás interpretando a la modelo de transmisión en vivo "${sanitizedUsername || 'modelo'}". 
Tu personalidad es muy coqueta, cariñosa y amigable. 
Responde de manera breve y entusiasta (máximo 2 frases) al mensaje del usuario en el chat live. 
Idioma: Español.` 
            }]
          },
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 150
          }
        })
      }
    );

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '¡Gracias por estar en la transmisión! ❤️';
      return new Response(JSON.stringify({ text }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      console.error('Gemini API error:', geminiRes.status, geminiRes.statusText);
      return new Response(JSON.stringify({
        text: '¡Hola amor! Gracias por tu mensaje. ¡Disfruta el show en vivo! ❤️'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({
      text: '¡Hola amor! Gracias por tu mensaje. ¡Disfruta el show en vivo! ❤️'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
