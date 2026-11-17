/**
 * Gemini Live API WebSocket Client
 * Connects directly to Google's BidiGenerateContent endpoint using the user's API key.
 * This utilizes the UNLIMITED RPM / UNLIMITED RPD quota pool from Google AI Studio.
 */

export interface LiveMessageResult {
  text: string;
  audioChunks: string[]; // base64 encoded audio/pcm;rate=24000
  latencyMs: number;
}

export interface LiveModelConfig {
  key: string;
  name: string;
  wsModel: string;
  responseModalities: ('AUDIO' | 'TEXT')[];
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export const LIVE_UNLIMITED_MODELS: LiveModelConfig[] = [
  {
    key: 'gemini-2.5-flash-native-audio',
    name: 'Gemini 2.5 Flash Native Audio Dialog',
    wsModel: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
    responseModalities: ['AUDIO'],
    description: 'Официальный нативный аудио-диалог (Безлимит RPM / 1M TPM)'
  },
  {
    key: 'gemini-3-flash-live',
    name: 'Gemini 3 Flash Live',
    wsModel: 'models/gemini-3.1-flash-live-preview',
    responseModalities: ['AUDIO'],
    description: 'Сверхбыстрый живой диалог 3.x Flash (Безлимит RPM / 65K TPM)'
  },
  {
    key: 'gemini-3.8-live',
    name: 'Gemini 3.8 Live',
    wsModel: 'models/gemini-3.8-live',
    responseModalities: ['AUDIO'],
    description: 'Флагманский живой диалог Gemini 3.8 (Безлимит RPM / 65K TPM)'
  },
  {
    key: 'gemini-3.8-live-extended-thinking',
    name: 'Gemini 3.8 Live Extended Thinking',
    wsModel: 'models/gemini-3.8-live-extended-thinking',
    responseModalities: ['AUDIO'],
    thinkingLevel: 'HIGH',
    description: 'Глубокое рассуждение и грамматика (Безлимит RPM / 65K TPM)'
  },
  {
    key: 'gemini-3.5-live-translate',
    name: 'Gemini 3.5 Live Translate',
    wsModel: 'models/gemini-3.5-live-translate-preview',
    responseModalities: ['AUDIO'],
    description: 'Синхронный живой перевод (Безлимит RPM / 20K TPM)'
  },
  {
    key: 'gemini-3.5-transcribe-live',
    name: 'Gemini 3.5 Transcribe Live',
    wsModel: 'models/gemini-3.5-transcribe-live',
    responseModalities: ['TEXT'],
    description: 'Транскрибация и распознавание в реальном времени (Безлимит RPM / 20K TPM)'
  }
];

export async function sendLiveWebSocketMessage(
  apiKey: string,
  modelConfig: LiveModelConfig,
  history: { role: 'user' | 'model'; text: string }[],
  systemInstruction?: string,
  timeoutMs: number = 10000
): Promise<LiveMessageResult> {
  const startTime = Date.now();
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

  return new Promise<LiveMessageResult>((resolve, reject) => {
    let ws: WebSocket | null = null;
    let timer: any = null;
    let textAccumulator = '';
    const audioChunks: string[] = [];
    let isFinished = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (ws) {
        try {
          ws.onclose = null;
          ws.onerror = null;
          ws.onmessage = null;
          ws.close();
        } catch (e) {}
        ws = null;
      }
    };

    timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        cleanup();
        if (textAccumulator.trim()) {
          resolve({
            text: textAccumulator.trim(),
            audioChunks,
            latencyMs: Date.now() - startTime
          });
        } else {
          reject(new Error(`Таймаут соединения с Live API (${timeoutMs / 1000}s)`));
        }
      }
    }, timeoutMs);

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Step 1: Send setup message
        const setupPayload: any = {
          setup: {
            model: modelConfig.wsModel,
            generationConfig: {
              responseModalities: modelConfig.responseModalities
            }
          }
        };

        if (modelConfig.thinkingLevel) {
          setupPayload.setup.generationConfig.thinkingConfig = {
            thinkingLevel: modelConfig.thinkingLevel
          };
        }

        if (systemInstruction) {
          setupPayload.setup.systemInstruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        ws?.send(JSON.stringify(setupPayload));
      };

      ws.onmessage = async (event: MessageEvent) => {
        let rawData = '';
        if (typeof event.data === 'string') {
          rawData = event.data;
        } else if (event.data instanceof Blob) {
          rawData = await event.data.text();
        } else if (event.data instanceof ArrayBuffer) {
          rawData = new TextDecoder().decode(event.data);
        }

        if (!rawData) return;

        let parsed: any = null;
        try {
          parsed = JSON.parse(rawData);
        } catch (e) {
          return;
        }

        // Step 2: Once setup is complete, send conversation turns
        if (parsed.setupComplete) {
          const recentTurns = history.slice(-6).map(h => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.text }]
          }));

          ws?.send(
            JSON.stringify({
              clientContent: {
                turns: recentTurns,
                turnComplete: true
              }
            })
          );
          return;
        }

        // Step 3: Accumulate incoming server chunks
        if (parsed.serverContent?.modelTurn?.parts) {
          for (const part of parsed.serverContent.modelTurn.parts) {
            if (part.text) {
              // Ignore internal chain-of-thought headers if present
              const cleanPart = part.text
                .replace(/\*\*Crafting.*?\*\*/gi, '')
                .replace(/\*\*Refining.*?\*\*/gi, '')
                .trim();
              if (cleanPart) {
                textAccumulator = textAccumulator ? `${textAccumulator} ${cleanPart}` : cleanPart;
              }
            }
            if (part.inlineData?.data) {
              audioChunks.push(part.inlineData.data);
            }
          }
        }

        // Step 4: Turn is complete
        if (parsed.serverContent?.turnComplete) {
          if (!isFinished) {
            isFinished = true;
            cleanup();
            resolve({
              text: textAccumulator.trim(),
              audioChunks,
              latencyMs: Date.now() - startTime
            });
          }
        }
      };

      ws.onerror = (err) => {
        if (!isFinished) {
          isFinished = true;
          cleanup();
          reject(new Error('Ошибка WebSocket соединения с Gemini Live API'));
        }
      };

      ws.onclose = (event: CloseEvent) => {
        if (!isFinished) {
          isFinished = true;
          cleanup();
          if (textAccumulator.trim()) {
            resolve({
              text: textAccumulator.trim(),
              audioChunks,
              latencyMs: Date.now() - startTime
            });
          } else {
            reject(
              new Error(
                `Live API сокет закрыт сервером [Код: ${event.code}${event.reason ? ` - ${event.reason}` : ''}]`
              )
            );
          }
        }
      };
    } catch (err: any) {
      if (!isFinished) {
        isFinished = true;
        cleanup();
        reject(err);
      }
    }
  });
}

// Web Audio PCM Player for 24kHz Native Audio Chunks
let sharedAudioCtx: AudioContext | null = null;
let currentAudioSources: AudioBufferSourceNode[] = [];

export function stopNativeAudio() {
  for (const src of currentAudioSources) {
    try {
      src.stop();
      src.disconnect();
    } catch (e) {}
  }
  currentAudioSources = [];
}

export async function playNativePcmAudio(
  audioChunks: string[],
  onEnded?: () => void
): Promise<void> {
  if (!audioChunks || audioChunks.length === 0) {
    if (onEnded) onEnded();
    return;
  }

  stopNativeAudio();

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    if (onEnded) onEnded();
    return;
  }

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContextClass({ sampleRate: 24000 });
  }

  if (sharedAudioCtx.state === 'suspended') {
    try {
      await sharedAudioCtx.resume();
    } catch (e) {}
  }

  const sampleRate = 24000;
  let nextStartTime = sharedAudioCtx.currentTime;

  let totalDuration = 0;
  for (let cIdx = 0; cIdx < audioChunks.length; cIdx++) {
    const base64 = audioChunks[cIdx];
    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const buffer = sharedAudioCtx.createBuffer(1, float32.length, sampleRate);
      buffer.copyToChannel(float32, 0);

      const source = sharedAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(sharedAudioCtx.destination);

      const startTime = Math.max(sharedAudioCtx.currentTime, nextStartTime);
      source.start(startTime);
      nextStartTime = startTime + buffer.duration;
      totalDuration += buffer.duration;

      currentAudioSources.push(source);
    } catch (err) {
      console.warn('Failed to decode PCM audio chunk:', err);
    }
  }

  const remainingMs = Math.max(50, Math.round((nextStartTime - sharedAudioCtx.currentTime) * 1000));
  setTimeout(() => {
    stopNativeAudio();
    if (onEnded) onEnded();
  }, remainingMs);
}
