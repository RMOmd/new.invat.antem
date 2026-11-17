import { AIEvaluationResult } from '../types/course';

const GEMINI_LOCAL_KEY = 'romanian_gemini_api_key';

declare const __GEMINI_API_KEY__: string | undefined;

export function getGeminiApiKey(): string {
  // 1. Check localStorage first (user manual input in browser)
  if (typeof window !== 'undefined' && window.localStorage) {
    const local = localStorage.getItem(GEMINI_LOCAL_KEY);
    if (local && local.trim().length > 10) return local.trim();
  }

  // 2. Check build-time replaced constant
  try {
    if (typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__ && __GEMINI_API_KEY__.trim().length > 10) {
      return __GEMINI_API_KEY__.trim();
    }
  } catch (e) {
    // ignore
  }

  // 3. Check Vite import.meta.env
  try {
    const metaEnv = (import.meta as any).env;
    const envKey =
      metaEnv?.VITE_GEMINI_API_KEY ||
      metaEnv?.GEMINI_API_KEY ||
      metaEnv?.API_KEY ||
      '';
    if (envKey && String(envKey).trim().length > 10) {
      return String(envKey).trim();
    }
  } catch (e) {
    // ignore
  }

  return '';
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

export function saveGeminiApiKey(key: string) {
  if (key && key.trim()) {
    localStorage.setItem(GEMINI_LOCAL_KEY, key.trim());
  } else {
    localStorage.removeItem(GEMINI_LOCAL_KEY);
  }
}

export function clearGeminiApiKey() {
  localStorage.removeItem(GEMINI_LOCAL_KEY);
}

export interface AIEvalStatus {
  type: 'connecting' | 'fallback' | 'generating';
  model: string;
  prevModel?: string;
}

export interface AIEvalOptions {
  onStatusChange?: (status: AIEvalStatus) => void;
}

const CANDIDATE_MODELS = [
  // Fast, high-capacity Lite models that avoid Google 503 queue spikes
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.8-flash'
];

/**
 * Evaluates student's written text (Producere de text / Essay)
 * using Google Gemini as an expert Romanian language teacher (ANTEM pedagogy).
 */
export async function evaluateEssayWithGemini(
  activityTitle: string,
  studentText: string,
  instructions?: string,
  options?: AIEvalOptions
): Promise<AIEvaluationResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Cheia API Gemini nu este configurată.');
  }

  const cleanText = studentText.trim();
  if (!cleanText) {
    throw new Error('Vă rugăm să introduceți textul înainte de evaluare.');
  }

  const systemPrompt = `Ești un profesor universitar și evaluator expert de limba română (pedagog acreditat ANTEM) pentru studenți de nivel A1-A2.
Rolul tău este să evaluezi cu atenție, blândețe și profesionalism textul scris de elev pentru activitatea de producere de text.

CRITERII DE EVALUARE (Nivel A1-A2):
1. Corectitudinea gramaticală (conjugări la prezent/perfect compus/conjunctiv, acordul în gen și număr, utilizarea pronumelor reflexive și a cliticelor: dă-mi, mă scol, etc.).
2. Utilizarea diacriticelor românești (ă, â, î, ș, ț).
3. Vocabular adecvat temei și registrul stilistic.
4. Structura frazei și naturalețea exprimării (expresii specifice limbii române).

NOTARE (1 la 10):
- 9.0 - 10: Excelent (idei clare, diacritice prezente, greșeli minore sau absente).
- 7.5 - 8.5: Bun (mesaj clar, vocabular bun, câteva ezitări de acord sau diacritice).
- 5.5 - 7.0: Satisfăcător (mesajul se înțelege, dar există greșeli vizibile de conjugare/articol).
- sub 5.5: Necesită îmbunătățire semnificativă.

FORMAT RĂSPUNS:
Răspunde STRICT în format JSON conform acestei scheme TypeScript (fără markdown în afara JSON-ului):
{
  "grade": number (între 1 și 10, de exemplu 8.5 sau 9),
  "summary": "un rezumat pedagogic cald, prietenos și încurajator în limba română",
  "strengths": ["aspect pozitiv 1", "aspect pozitiv 2"],
  "corrections": [
    {
      "original": "fragmentul exact din textul elevului care conține greșeala",
      "corrected": "cum trebuie scris corect",
      "explanation": "explicația clară și concisă a regulii gramaticale sau lexicale"
    }
  ],
  "improvedText": "textul complet rescris corect, cursiv și natural",
  "recommendation": "un sfat practic concret pentru progresul elevului"
}`;

  const userPrompt = `Titlul lecției: "${activityTitle}"
${instructions ? `Instrucțiuni exercițiu: "${instructions}"\n` : ''}
Textul scris de elev:
"""
${cleanText}
"""

Evaluează textul și returnează analiza conform schemei JSON specificate.`;

  let lastError: Error | null = null;

  for (let i = 0; i < CANDIDATE_MODELS.length; i++) {
    const model = CANDIDATE_MODELS[i];
    const nextModel = i < CANDIDATE_MODELS.length - 1 ? CANDIDATE_MODELS[i + 1] : undefined;

    options?.onStatusChange?.({
      type: 'connecting',
      model
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${response.status}`;
        console.warn(`Model ${model} failed (${response.status}): ${errMsg}. Falling back to next model...`);
        lastError = new Error(`Model ${model}: ${errMsg}`);

        if (nextModel) {
          options?.onStatusChange?.({
            type: 'fallback',
            model: nextModel,
            prevModel: model
          });
        }

        // brief pause before trying next candidate model to avoid rapid request collisions
        await new Promise(r => setTimeout(r, 400));
        continue;
      }

      options?.onStatusChange?.({
        type: 'generating',
        model
      });

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        console.warn(`Model ${model} returned empty response. Falling back to next model...`);
        lastError = new Error(`Model ${model} returned empty response.`);
        if (nextModel) {
          options?.onStatusChange?.({
            type: 'fallback',
            model: nextModel,
            prevModel: model
          });
        }
        continue;
      }

      // Clean markdown codeblocks if model returned ```json ... ```
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      try {
        const parsed: AIEvaluationResult = JSON.parse(cleaned);
        return parsed;
      } catch (parseErr: any) {
        console.warn(`Model ${model} returned invalid JSON: ${parseErr.message}. Falling back to next model...`);
        lastError = new Error(`Model ${model} JSON parse error: ${parseErr.message}`);
        if (nextModel) {
          options?.onStatusChange?.({
            type: 'fallback',
            model: nextModel,
            prevModel: model
          });
        }
        continue;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError';
      const msg = isTimeout ? 'Timed out after 12s' : err.message;
      console.warn(`Model ${model} error (${msg}). Falling back to next model...`);
      lastError = new Error(`Model ${model}: ${msg}`);
      if (nextModel) {
        options?.onStatusChange?.({
          type: 'fallback',
          model: nextModel,
          prevModel: model
        });
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  throw lastError || new Error('Nu s-a putut conecta la serviciul Gemini AI.');
}
