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

const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest'
];

/**
 * Evaluates student's written text (Producere de text / Essay)
 * using Google Gemini as an expert Romanian language teacher (ANTEM pedagogy).
 */
export async function evaluateEssayWithGemini(
  activityTitle: string,
  studentText: string,
  instructions?: string
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

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${response.status}`;
        console.warn(`Model ${model} returned error: ${errMsg}`);
        if (response.status === 404 || response.status === 503 || response.status === 400) {
          lastError = new Error(`Model ${model}: ${errMsg}`);
          continue;
        }
        throw new Error(`Eroare Gemini (${model}): ${errMsg}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Răspunsul primit de la Gemini este gol.');
      }

      const parsed: AIEvaluationResult = JSON.parse(rawText);
      return parsed;
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes('JSON')) {
        throw new Error('Eroare la parsarea evaluării AI: ' + err.message);
      }
    }
  }

  throw lastError || new Error('Nu s-a putut conecta la serviciul Gemini AI.');
}
