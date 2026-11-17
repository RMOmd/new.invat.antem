import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getGeminiApiKey,
  saveGeminiApiKey,
  isGeminiConfigured,
  sendChatMessage,
  ChatMessageItem
} from '../lib/gemini';
import {
  Sparkles,
  Send,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  AlertCircle,
  Key,
  Bot,
  User,
  ArrowRight,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Zap,
  Phone,
  PhoneOff
} from 'lucide-react';

export interface UnlimitedModel {
  key: string;
  name: string;
  apiModel: string;
  candidateModels: string[];
  badge: string;
  description: string;
}

// STRICTLY the 6 unlimited models requested by the user
export const UNLIMITED_MODELS: UnlimitedModel[] = [
  {
    key: 'gemini-3-flash-live',
    name: 'Gemini 3 Flash Live',
    apiModel: 'gemini-3-flash-preview',
    candidateModels: ['gemini-3-flash-preview', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'],
    badge: 'Live',
    description: 'Высокоскоростной живой диалог без лимитов'
  },
  {
    key: 'gemini-3.5-transcribe-live',
    name: 'Gemini 3.5 Transcribe Live',
    apiModel: 'gemini-3.5-transcribe',
    candidateModels: ['gemini-3.5-transcribe', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'],
    badge: 'Transcribe Live',
    description: 'Голосовой ввод и распознавание речи в реальном времени'
  },
  {
    key: 'gemini-3.5-live-translate',
    name: 'Gemini 3.5 Live Translate',
    apiModel: 'gemini-3.5-flash',
    candidateModels: ['gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'],
    badge: 'Live Translate',
    description: 'Синхронный перевод и объяснение грамматических правил'
  },
  {
    key: 'gemini-3.8-live',
    name: 'Gemini 3.8 Live',
    apiModel: 'gemini-3.8-flash',
    candidateModels: ['gemini-3.8-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'],
    badge: 'Live 3.8',
    description: 'Флагманский речевой интеллект нового поколения'
  },
  {
    key: 'gemini-2.5-flash-native-audio',
    name: 'Gemini 2.5 Flash Native Audio Dialog',
    apiModel: 'gemini-2.5-flash-preview-tts',
    candidateModels: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-flash', 'gemini-flash-lite-latest'],
    badge: 'Native Audio',
    description: 'Нативный двусторонний аудио-диалог'
  },
  {
    key: 'gemini-3.8-live-extended-thinking',
    name: 'Gemini 3.8 Live Extended Thinking',
    apiModel: 'gemini-3.8-flash',
    candidateModels: ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-pro-latest'],
    badge: 'Extended Thinking',
    description: 'Глубокий анализ, рассуждения и методика преподавания'
  }
];

const SYSTEM_PROMPTS = [
  {
    id: 'tutor_antem',
    title: '🎓 Преподаватель ANTEM (A1-A2)',
    text: `Ești un profesor universitar și evaluator expert de limba română (metodologia ANTEM, nivel A1-A2).
Răspunde concis (1-3 fraze scurte), prietenos și cald, ideal pentru conversație vie vorbită. Folosește limba română curată (cu diacritice). Dacă utilizatorul întreabă în rusă, explică regula scurt și oferă exemplul în română.`
  },
  {
    id: 'free_conversation',
    title: '💬 Собеседник из Кишинёва',
    text: `Ești un prieten vorbitor nativ de limba română din Chișinău.
Porți un dialog vocal cald, prietenos și natural în limba română de zi cu zi. Răspunde cu replici scurte de conversație vie (1-2 fraze) și pune o întrebare de continuare.`
  },
  {
    id: 'editor_proofreader',
    title: '✍️ Редактор и грамматический разбор',
    text: `Ești un lingvist și redactor riguros de limba română.
Analizează fraza utilizatorului:
1. Identifică greșeala dacă există.
2. Oferă varianta corectată cu explicație de o frază.`
  },
  {
    id: 'quiz_generator',
    title: '🧪 Генератор упражнений',
    text: `Ești un metodist specializat în crearea testelor de limba română pentru străini (nivel A1-A2).
Creează exerciții concise: completare de spații (gaps), întrebări Adevărat/Fals, sau potrivire de coloane cu cheia de răspunsuri la final.`
  }
];

const QUICK_PROMPTS = [
  'Bună ziua! Cum mă pot prezenta la un interviu în limba română?',
  'Explică pe scurt regula: când folosim prepoziția „la” și când „în”?',
  'Hai să exersăm un dialog scurt la restaurant în Chișinău.',
  'Corectează fraza mea: „Eu ieri fost la piață și cumpărat mere.”'
];

export const AIChatView: React.FC = () => {
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'teacher';

  const [selectedModelKey, setSelectedModelKey] = useState<string>('gemini-3-flash-live');
  const [selectedPromptId, setSelectedPromptId] = useState<string>('tutor_antem');
  const [systemPrompt, setSystemPrompt] = useState<string>(SYSTEM_PROMPTS[0].text);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(0.7);

  const [messages, setMessages] = useState<ChatMessageItem[]>(() => {
    try {
      const saved = localStorage.getItem('romanian_ai_lab_chat');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Turn-based Voice
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognitionLang, setRecognitionLang] = useState<'ro-RO' | 'ru-RU'>('ro-RO');
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // LIVE CALL MODE (Continuous Hands-Free Voice Dialogue)
  const [isLiveCall, setIsLiveCall] = useState<boolean>(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'listening' | 'thinking' | 'speaking'>('connecting');
  const [callTranscriptUser, setCallTranscriptUser] = useState<string>('');
  const [callTranscriptAi, setCallTranscriptAi] = useState<string>('');
  const [isCallMuted, setIsCallMuted] = useState<boolean>(false);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number>(0);

  // Pause duration before assistant considers phrase complete (default 2200ms for natural learning pace)
  const [silenceDelayMs, setSilenceDelayMs] = useState<number>(2200);
  const silenceDelayRef = useRef<number>(2200);
  const callStatusRef = useRef<'connecting' | 'listening' | 'thinking' | 'speaking'>('connecting');
  const accumulatedTranscriptRef = useRef<string>('');
  const currentUtteranceRef = useRef<any>(null);

  const callRecognitionRef = useRef<any>(null);
  const callSilenceTimerRef = useRef<any>(null);
  const isCallActiveRef = useRef<boolean>(false);
  const isCallMutedRef = useRef<boolean>(false);
  const messagesRef = useRef<ChatMessageItem[]>(messages);

  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [keySavedNotice, setKeySavedNotice] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentModelConfig = UNLIMITED_MODELS.find(m => m.key === selectedModelKey) || UNLIMITED_MODELS[0];

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isCallActiveRef.current = isLiveCall;
  }, [isLiveCall]);

  useEffect(() => {
    isCallMutedRef.current = isCallMuted;
  }, [isCallMuted]);

  useEffect(() => {
    silenceDelayRef.current = silenceDelayMs;
  }, [silenceDelayMs]);

  // Keyboard shortcut in Live Call: Spacebar to interrupt AI or send speech immediately
  useEffect(() => {
    if (!isLiveCall) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (callStatusRef.current === 'speaking') {
          interruptAiAndListen();
        } else if (callStatusRef.current === 'listening' && accumulatedTranscriptRef.current.trim().length > 0) {
          commitUserSpeech(accumulatedTranscriptRef.current.trim());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLiveCall]);

  // Call duration counter
  useEffect(() => {
    let interval: any = null;
    if (isLiveCall) {
      interval = setInterval(() => {
        setCallDurationSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setCallDurationSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLiveCall]);

  // Auto-scroll in standard chat view
  useEffect(() => {
    if (!isLiveCall) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isLiveCall]);

  // Persist chat in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('romanian_ai_lab_chat', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (callRecognitionRef.current) {
        try {
          callRecognitionRef.current.stop();
        } catch (e) {}
      }
      if (callSilenceTimerRef.current) {
        clearTimeout(callSilenceTimerRef.current);
      }
    };
  }, []);

  // Standard Voice Synthesis
  const speakText = useCallback((text: string, msgId?: string, onEndCallback?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onEndCallback) onEndCallback();
      return;
    }

    window.speechSynthesis.cancel();
    if (currentlySpeakingId === msgId && !isLiveCall) {
      setCurrentlySpeakingId(null);
      return;
    }

    const clean = text
      .replace(/[*#_`>~]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!clean) {
      if (onEndCallback) onEndCallback();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    currentUtteranceRef.current = utterance;
    utterance.lang = recognitionLang === 'ru-RU' ? 'ru-RU' : 'ro-RO';
    utterance.rate = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const roVoice = voices.find(v => v.lang.startsWith('ro') || v.lang.includes('RON') || v.name.toLowerCase().includes('romanian'));
    const ruVoice = voices.find(v => v.lang.startsWith('ru') || v.name.toLowerCase().includes('russian'));

    if (recognitionLang === 'ro-RO' && roVoice) {
      utterance.voice = roVoice;
    } else if (recognitionLang === 'ru-RU' && ruVoice) {
      utterance.voice = ruVoice;
    }

    if (msgId) setCurrentlySpeakingId(msgId);

    utterance.onend = () => {
      currentUtteranceRef.current = null;
      setCurrentlySpeakingId(null);
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = () => {
      currentUtteranceRef.current = null;
      setCurrentlySpeakingId(null);
      if (onEndCallback) onEndCallback();
    };

    window.speechSynthesis.speak(utterance);
  }, [currentlySpeakingId, isLiveCall, recognitionLang]);

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setCurrentlySpeakingId(null);
  };

  // Merge progressive hypotheses or consecutive speech chunks without duplicating repeated phrases
  const mergeSpeechChunks = (existing: string, incoming: string): string => {
    const a = existing.trim();
    const b = incoming.trim();
    if (!a) return b;
    if (!b) return a;
    if (a.toLowerCase() === b.toLowerCase()) return a;

    // 1. If incoming starts with existing (progressive hypothesis replacement on Android)
    if (b.toLowerCase().startsWith(a.toLowerCase())) return b;

    // 2. If existing starts with incoming (earlier hypothesis was longer/duplicate)
    if (a.toLowerCase().startsWith(b.toLowerCase())) return a;

    // 3. Word-level overlap resolution (e.g. "Eu sunt Alexandra" + "Alexandra unde locuiești")
    const aWords = a.split(/\s+/);
    const bWords = b.split(/\s+/);
    const maxOverlap = Math.min(aWords.length, bWords.length);

    for (let len = maxOverlap; len > 0; len--) {
      const aTail = aWords.slice(aWords.length - len).join(' ').toLowerCase();
      const bHead = bWords.slice(0, len).join(' ').toLowerCase();
      if (aTail === bHead) {
        const remainder = bWords.slice(len).join(' ');
        return remainder ? `${a} ${remainder}` : a;
      }
    }

    // 4. Distinct sentences/clauses
    return `${a} ${b}`;
  };

  // Helper to extract clean, deduplicated speech transcript across all browsers (especially mobile Android Chrome)
  const extractCleanTranscript = (event: any): string => {
    if (!event || !event.results) return '';

    let merged = '';

    for (let i = 0; i < event.results.length; ++i) {
      const res = event.results[i];
      if (!res || !res[0]) continue;
      const chunk = (res[0].transcript || '').trim();
      if (!chunk) continue;

      merged = mergeSpeechChunks(merged, chunk);
    }

    return merged.replace(/\s+/g, ' ').trim();
  };

  // Turn-based mic button toggle
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Recunoașterea vocală nu este suportată în acest browser. Folosiți Google Chrome sau Microsoft Edge.');
      return;
    }

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    stopSpeaking();

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = recognitionLang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const text = extractCleanTranscript(event);
        if (text) {
          setInputText(text);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  // Standard message submit
  const handleSendMessage = async (textToSend?: string) => {
    const raw = textToSend || inputText;
    const clean = raw.trim();
    if (!clean || isLoading) return;

    if (!isGeminiConfigured()) {
      setShowKeyModal(true);
      return;
    }

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }

    const userMsg: ChatMessageItem = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      text: clean,
      timestamp: Date.now()
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await sendChatMessage(
        currentModelConfig.apiModel,
        newHistory.map(m => ({ role: m.role, text: m.text })),
        systemPrompt,
        temperature,
        currentModelConfig.candidateModels
      );

      const botMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const botMsg: ChatMessageItem = {
        id: botMsgId,
        role: 'model',
        text: res.text,
        timestamp: Date.now(),
        modelUsed: currentModelConfig.name,
        latencyMs: res.latencyMs
      };

      setMessages(prev => [...prev, botMsg]);

      if (autoSpeak) {
        speakText(res.text, botMsgId);
      }
    } catch (err: any) {
      const errorMsg: ChatMessageItem = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'model',
        text: `⚠️ Ошибка модели [${currentModelConfig.name}]: ${err.message}`,
        timestamp: Date.now(),
        modelUsed: currentModelConfig.name,
        error: err.message
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // CONTINUOUS HANDS-FREE LIVE CALL IMPLEMENTATION
  // -------------------------------------------------------------
  const commitUserSpeech = (phrase: string) => {
    if (callSilenceTimerRef.current) {
      clearTimeout(callSilenceTimerRef.current);
      callSilenceTimerRef.current = null;
    }
    if (!isCallActiveRef.current || callStatusRef.current !== 'listening') return;

    const clean = phrase.trim();
    if (!clean) return;

    callStatusRef.current = 'thinking';
    setCallStatus('thinking');

    // Cleanly detach and abort voice recognition so Android/Chrome does not fire onend/restart
    if (callRecognitionRef.current) {
      try {
        callRecognitionRef.current.onend = null;
        callRecognitionRef.current.onerror = null;
        callRecognitionRef.current.onresult = null;
        callRecognitionRef.current.abort();
      } catch (e) {}
      callRecognitionRef.current = null;
    }

    processLiveCallTurn(clean);
  };

  const interruptAiAndListen = () => {
    stopSpeaking();
    if (callSilenceTimerRef.current) {
      clearTimeout(callSilenceTimerRef.current);
      callSilenceTimerRef.current = null;
    }
    if (isCallActiveRef.current) {
      callStatusRef.current = 'listening';
      setCallStatus('listening');
      setCallTranscriptUser('');
      accumulatedTranscriptRef.current = '';
      restartLiveRecognition();
    }
  };

  const processLiveCallTurn = async (userSpokenText: string) => {
    if (!isCallActiveRef.current) return;
    const clean = userSpokenText.trim();
    if (!clean) return;

    callStatusRef.current = 'thinking';
    setCallStatus('thinking');

    const userMsg: ChatMessageItem = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      text: clean,
      timestamp: Date.now()
    };

    const currentHistory = [...messagesRef.current, userMsg];
    setMessages(currentHistory);
    messagesRef.current = currentHistory;

    try {
      const res = await sendChatMessage(
        currentModelConfig.apiModel,
        currentHistory.map(m => ({ role: m.role, text: m.text })),
        systemPrompt,
        temperature,
        currentModelConfig.candidateModels
      );

      if (!isCallActiveRef.current) return;

      const botMsgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const botMsg: ChatMessageItem = {
        id: botMsgId,
        role: 'model',
        text: res.text,
        timestamp: Date.now(),
        modelUsed: currentModelConfig.name,
        latencyMs: res.latencyMs
      };

      const updatedHistory = [...currentHistory, botMsg];
      setMessages(updatedHistory);
      messagesRef.current = updatedHistory;
      setCallTranscriptAi(res.text);

      // Now speak the answer out loud
      callStatusRef.current = 'speaking';
      setCallStatus('speaking');
      speakText(res.text, botMsgId, () => {
        // When AI finishes speaking, immediately start listening to user again
        if (isCallActiveRef.current) {
          callStatusRef.current = 'listening';
          setCallStatus('listening');
          setCallTranscriptUser('');
          accumulatedTranscriptRef.current = '';
          restartLiveRecognition();
        }
      });
    } catch (err: any) {
      if (!isCallActiveRef.current) return;
      const errorText = `Nu am putut procesa răspunsul: ${err.message}`;
      setCallTranscriptAi(errorText);
      callStatusRef.current = 'speaking';
      setCallStatus('speaking');
      speakText('Scuze, a apărut o mică eroare de conexiune.', undefined, () => {
        if (isCallActiveRef.current) {
          callStatusRef.current = 'listening';
          setCallStatus('listening');
          setCallTranscriptUser('');
          accumulatedTranscriptRef.current = '';
          restartLiveRecognition();
        }
      });
    }
  };

  const restartLiveRecognition = () => {
    if (!isCallActiveRef.current || isCallMutedRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (callRecognitionRef.current) {
      try {
        callRecognitionRef.current.onend = null;
        callRecognitionRef.current.onerror = null;
        callRecognitionRef.current.onresult = null;
        callRecognitionRef.current.abort();
      } catch (e) {}
      callRecognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = recognitionLang;
      // CONTINUOUS is true so browser does NOT cut off speech on slight pauses!
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      callStatusRef.current = 'listening';
      setCallStatus('listening');

      recognition.onstart = () => {
        callStatusRef.current = 'listening';
        setCallStatus('listening');
      };

      recognition.onresult = (event: any) => {
        if (!isCallActiveRef.current || callStatusRef.current !== 'listening') return;

        const text = extractCleanTranscript(event);
        if (!text) return;

        accumulatedTranscriptRef.current = text;
        setCallTranscriptUser(text);

        // Reset silence timer on every spoken syllable/word
        if (callSilenceTimerRef.current) {
          clearTimeout(callSilenceTimerRef.current);
        }

        // Only after user pauses for silenceDelay (default 2.2s), commit speech to Gemini
        callSilenceTimerRef.current = setTimeout(() => {
          if (callStatusRef.current === 'listening' && accumulatedTranscriptRef.current.trim().length > 0) {
            commitUserSpeech(accumulatedTranscriptRef.current.trim());
          }
        }, silenceDelayRef.current);
      };

      recognition.onerror = (e: any) => {
        if (!isCallActiveRef.current || e.error === 'aborted') return;

        // If Android times out with no-speech but user already spoke something, commit it!
        if (e.error === 'no-speech') {
          const spoken = accumulatedTranscriptRef.current.trim();
          if (spoken.length > 0) {
            commitUserSpeech(spoken);
            return;
          }
        }

        // Never restart in a fast loop (prevents Android chimes/beeps). Wait 1.5s
        setTimeout(() => {
          if (isCallActiveRef.current && callStatusRef.current === 'listening') {
            restartLiveRecognition();
          }
        }, 1500);
      };

      recognition.onend = () => {
        if (!isCallActiveRef.current || callStatusRef.current !== 'listening' || isCallMutedRef.current) return;

        // If recognition closed automatically by Android/Chrome but user spoke, commit immediately!
        const spoken = accumulatedTranscriptRef.current.trim();
        if (spoken.length > 0) {
          commitUserSpeech(spoken);
          return;
        }

        // If completely empty, pause before restarting to avoid repetitive Android system dings
        setTimeout(() => {
          if (isCallActiveRef.current && callStatusRef.current === 'listening') {
            restartLiveRecognition();
          }
        }, 1500);
      };

      callRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('Call recognition start notice:', err);
    }
  };

  const startLiveCall = () => {
    if (!isGeminiConfigured()) {
      setShowKeyModal(true);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Recunoașterea vocală nu este suportată în acest browser. Folosiți Google Chrome sau Microsoft Edge.');
      return;
    }

    stopSpeaking();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
      setIsListening(false);
    }

    setIsLiveCall(true);
    isCallActiveRef.current = true;
    callStatusRef.current = 'connecting';
    setCallStatus('connecting');
    setCallTranscriptUser('');
    accumulatedTranscriptRef.current = '';

    const greeting = 'Bună ziua! Sunt profesorul tău de limba română. Te ascult cu drag — despre ce vrei să discutăm astăzi?';
    setCallTranscriptAi(greeting);

    // Speak welcome greeting
    callStatusRef.current = 'speaking';
    setCallStatus('speaking');
    setTimeout(() => {
      speakText(greeting, undefined, () => {
        if (isCallActiveRef.current) {
          callStatusRef.current = 'listening';
          setCallStatus('listening');
          setCallTranscriptUser('');
          accumulatedTranscriptRef.current = '';
          restartLiveRecognition();
        }
      });
    }, 400);
  };

  const endLiveCall = () => {
    isCallActiveRef.current = false;
    callStatusRef.current = 'connecting';
    setCallStatus('connecting');
    setIsLiveCall(false);
    stopSpeaking();

    if (callSilenceTimerRef.current) {
      clearTimeout(callSilenceTimerRef.current);
      callSilenceTimerRef.current = null;
    }

    if (callRecognitionRef.current) {
      try {
        callRecognitionRef.current.onend = null;
        callRecognitionRef.current.onerror = null;
        callRecognitionRef.current.onresult = null;
        callRecognitionRef.current.abort();
      } catch (e) {}
      callRecognitionRef.current = null;
    }
  };

  const toggleCallMute = () => {
    const next = !isCallMuted;
    setIsCallMuted(next);
    isCallMutedRef.current = next;

    if (next && callRecognitionRef.current) {
      try {
        callRecognitionRef.current.stop();
      } catch (e) {}
    } else if (!next && isLiveCall && callStatus === 'listening') {
      restartLiveRecognition();
    }
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;
    if (window.confirm('Sigur doriți să ștergeți întregul istoric al conversației?')) {
      stopSpeaking();
      setMessages([]);
      localStorage.removeItem('romanian_ai_lab_chat');
    }
  };

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKeyInput.trim()) {
      saveGeminiApiKey(apiKeyInput.trim());
      setKeySavedNotice(true);
      setTimeout(() => {
        setKeySavedNotice(false);
        setShowKeyModal(false);
        setApiKeyInput('');
      }, 1000);
    }
  };

  const formatCallTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isStaff) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-3xl text-center shadow-xs">
        <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Acces restricționat</h2>
        <p className="text-sm text-slate-600">
          Laboratorul de testare AI este disponibil exclusiv pentru cadre didactice și administratori.
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULL-SCREEN LIVE CALL INTERFACE (Hands-Free Conversation)
  // -------------------------------------------------------------
  if (isLiveCall) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col items-center justify-between min-h-[600px] h-[calc(100vh-8.5rem)] bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 rounded-3xl text-white shadow-2xl relative overflow-hidden border border-indigo-900/60">
        {/* Background glow orbs */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header in Call */}
        <div className="w-full flex items-center justify-between z-10 pt-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold tracking-wider font-mono">
              {formatCallTime(callDurationSeconds)}
            </span>
          </div>

          {/* Silence pause duration selector */}
          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/10 text-[11px] font-bold">
            <span className="text-slate-300 pl-2 pr-1 text-[10px] uppercase tracking-wider hidden sm:inline">Пауза:</span>
            <button
              type="button"
              onClick={() => setSilenceDelayMs(1400)}
              className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                silenceDelayMs === 1400 ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
              title="Быстрый темп (1.4с тишины)"
            >
              1.4с
            </button>
            <button
              type="button"
              onClick={() => setSilenceDelayMs(2200)}
              className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                silenceDelayMs === 2200 ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
              title="Стандартный комфортный темп (2.2с тишины)"
            >
              2.2с
            </button>
            <button
              type="button"
              onClick={() => setSilenceDelayMs(3500)}
              className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                silenceDelayMs === 3500 ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
              title="Спокойный темп для новичков (3.5с тишины)"
            >
              3.5с
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-center hidden sm:block">
              <span className="text-[11px] font-bold text-indigo-200 bg-indigo-950/80 border border-indigo-700/50 px-2.5 py-1 rounded-full uppercase tracking-wider block">
                {currentModelConfig.name}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-xs font-bold">
              <span>{recognitionLang === 'ro-RO' ? '🇷🇴 RO' : '🇷🇺 RU'}</span>
            </div>
          </div>
        </div>

        {/* Center: Teacher Avatar with Animated Soundwave Rings */}
        <div className="flex flex-col items-center justify-center my-auto z-10 text-center">
          <div className="relative flex items-center justify-center mb-6">
            {/* Animated Sound Wave Rings */}
            {callStatus === 'speaking' && (
              <>
                <div className="absolute w-48 h-48 rounded-full border-2 border-purple-400/40 animate-ping" />
                <div className="absolute w-40 h-40 rounded-full bg-purple-500/20 animate-pulse" />
              </>
            )}
            {callStatus === 'listening' && (
              <>
                <div className="absolute w-44 h-44 rounded-full border border-emerald-400/50 animate-ping" />
                <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 animate-pulse" />
              </>
            )}
            {callStatus === 'thinking' && (
              <div className="absolute w-36 h-36 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            )}

            {/* Avatar Circle */}
            <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 relative z-10 ${
              callStatus === 'speaking'
                ? 'bg-gradient-to-tr from-purple-500 to-indigo-500 ring-4 ring-purple-300 shadow-purple-500/50'
                : callStatus === 'listening'
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 ring-4 ring-emerald-300 shadow-emerald-500/50'
                : callStatus === 'thinking'
                ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 ring-4 ring-indigo-300'
                : 'bg-slate-700 ring-4 ring-slate-600'
            }`}>
              <Bot className="w-14 h-14 text-white" />
            </div>
          </div>

          <h3 className="text-xl font-extrabold tracking-tight mb-1 text-white">
            Profesor ANTEM (Chișinău)
          </h3>

          <div className="flex items-center gap-2 mb-4">
            {callStatus === 'listening' && (
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/40 animate-pulse">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                Слушаю вас... Говорите свободно!
              </span>
            )}
            {callStatus === 'speaking' && (
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5 bg-purple-950/60 px-3 py-1 rounded-full border border-purple-500/40">
                <Volume2 className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                Репетитор говорит...
              </span>
            )}
            {callStatus === 'thinking' && (
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-500/40">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                Думает над ответом...
              </span>
            )}
            {callStatus === 'connecting' && (
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-full">
                Подключение к линии...
              </span>
            )}
          </div>

          {/* Subtitles / Live Transcript Box */}
          <div className="w-full max-w-lg min-h-[90px] bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center flex flex-col justify-center shadow-lg">
            {callStatus === 'listening' && callTranscriptUser ? (
              <p className="text-sm font-medium text-emerald-200 italic">
                „{callTranscriptUser}”
              </p>
            ) : callTranscriptAi ? (
              <p className="text-sm font-medium text-slate-100 leading-relaxed">
                {callTranscriptAi}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Начните говорить на румынском, репетитор внимательно выслушает и ответит...
              </p>
            )}
          </div>

          {/* Action triggers: Send now without waiting for pause OR Interrupt AI */}
          {callStatus === 'listening' && callTranscriptUser.trim().length > 0 && (
            <div className="flex flex-col items-center gap-1.5 mt-3">
              <button
                type="button"
                onClick={() => commitUserSpeech(callTranscriptUser)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer animate-pulse"
                title="Отправить распознанную фразу не дожидаясь паузы (или нажмите Пробел)"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ответить сейчас (Пробел)</span>
              </button>
              <span className="text-[11px] text-emerald-300/80 font-medium">
                ⏳ Жду тишину {(silenceDelayMs / 1000).toFixed(1)}с перед отправкой... Говорите дальше!
              </span>
            </div>
          )}

          {callStatus === 'speaking' && (
            <div className="flex flex-col items-center gap-1 mt-3">
              <button
                type="button"
                onClick={interruptAiAndListen}
                className="px-4 py-2 bg-purple-600/90 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border border-purple-400/40"
                title="Остановить голос репетитора и начать говорить (или нажмите Пробел)"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>✋ Прервать ответ и говорить (Пробел)</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Call Controls */}
        <div className="w-full flex items-center justify-center gap-6 z-10 pb-4">
          {/* Mute button */}
          <button
            type="button"
            onClick={toggleCallMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-lg ${
              isCallMuted
                ? 'bg-amber-500 text-white'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
            }`}
            title={isCallMuted ? 'Включить микрофон' : 'Отключить микрофон'}
          >
            {isCallMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Hang Up (End Call) Button */}
          <button
            type="button"
            onClick={endLiveCall}
            className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-xl shadow-rose-600/50 transition-all active:scale-90 cursor-pointer"
            title="Завершить звонок"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => setRecognitionLang(recognitionLang === 'ro-RO' ? 'ru-RU' : 'ro-RO')}
            className="w-14 h-14 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/20 flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer text-xs font-bold"
            title="Переключить язык"
          >
            <span>{recognitionLang === 'ro-RO' ? 'RO' : 'RU'}</span>
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STANDARD CHAT & SETTINGS INTERFACE
  // -------------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-8 flex flex-col h-[calc(100vh-8.5rem)] min-h-[550px]">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 mb-3 shadow-xs shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                  AI Lab • Голосовой диалог
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-emerald-600 fill-emerald-600" />
                  Безлимит
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Двусторонний диалог: вы говорите в микрофон 🎙️ $\leftrightarrow$ нейросеть отвечает голосом 🔊
              </p>
            </div>
          </div>

          {/* Model selector & Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            {/* BIG LIVE CALL BUTTON */}
            <button
              type="button"
              onClick={startLiveCall}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ring-2 ring-emerald-300 animate-pulse"
              title="Начать непрерывный живой телефонный звонок с репетитором без нажатия кнопок"
            >
              <Phone className="w-3.5 h-3.5 fill-white" />
              <span>Позвонить репетитору</span>
            </button>

            {/* Auto-speech toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !autoSpeak;
                setAutoSpeak(next);
                if (!next) stopSpeaking();
              }}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                autoSpeak
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              title="Автоматически озвучивать ответы модели голосом"
            >
              {autoSpeak ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span className="hidden sm:inline">Голос вкл</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Голос выкл</span>
                </>
              )}
            </button>

            {/* Exclusive selector of the 6 unlimited models */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
              <span className="text-[11px] font-bold text-slate-500 pl-1.5 hidden sm:inline">Модель:</span>
              <select
                value={selectedModelKey}
                onChange={e => setSelectedModelKey(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer max-w-[240px] truncate"
              >
                {UNLIMITED_MODELS.map(m => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showSettings
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title="Настройки системного промпта и параметров"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Промпт</span>
            </button>

            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Настроить API Key Gemini"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">API Key</span>
            </button>
          </div>
        </div>

        {/* Selected model description badge */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md">
              {currentModelConfig.name}
            </span>
            <span className="text-slate-500 truncate">
              {currentModelConfig.description}
            </span>
          </div>

          <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full hidden sm:inline">
            ⚡ Живой звонок без ожидания
          </span>
        </div>

        {/* Collapsible System Prompt Settings */}
        {showSettings && (
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2.5 bg-slate-50/70 p-3 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">Готовые роли (Presets):</span>
              <div className="flex flex-wrap gap-1">
                {SYSTEM_PROMPTS.map(sp => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      setSelectedPromptId(sp.id);
                      setSystemPrompt(sp.text);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      selectedPromptId === sp.id
                        ? 'bg-purple-600 border-purple-600 text-white shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {sp.title}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Системная инструкция (System Instruction):
              </label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={e => {
                  setSystemPrompt(e.target.value);
                  setSelectedPromptId('custom');
                }}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono text-slate-800"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-600">
                Temperature: <span className="font-mono text-purple-700">{temperature.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-32 accent-purple-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">(0.0 = строго, 1.0 = креативность)</span>
            </div>
          </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3.5 mb-3 shadow-inner">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 mb-3 shadow-xs">
              <Bot className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
              Голосовой собеседник по румынскому языку
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-4">
              Нажмите кнопку <strong>«📞 Позвонить репетитору»</strong> сверху, чтобы начать живой разговор без нажатия клавиш, или отправьте сообщение ниже:
            </p>

            <button
              type="button"
              onClick={startLiveCall}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2 mb-6"
            >
              <Phone className="w-4 h-4 fill-white" />
              <span>Начать живой разговор с репетитором</span>
            </button>

            <div className="w-full max-w-lg space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Или нажмите на готовый вопрос:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(qp)}
                    className="p-2.5 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-xl text-xs text-slate-700 font-medium transition-all text-left shadow-2xs hover:shadow-xs flex items-center justify-between gap-2 group cursor-pointer"
                  >
                    <span className="line-clamp-2">{qp}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const isUser = msg.role === 'user';
            const isErr = !!msg.error;
            const isSpeakingThis = currentlySpeakingId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5 ${
                    isErr ? 'bg-rose-500' : 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                  }`}>
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3 sm:p-4 text-xs sm:text-sm shadow-2xs ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : isErr
                    ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-tl-xs'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                }`}>
                  {!isUser && (
                    <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-slate-100 text-[10px] text-slate-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                          {msg.modelUsed || currentModelConfig.name}
                        </span>
                        {msg.latencyMs !== undefined && (
                          <span className="text-slate-400">⏱️ {msg.latencyMs} ms</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isErr && (
                          <button
                            type="button"
                            onClick={() => speakText(msg.text, msg.id)}
                            className={`p-1 transition-colors cursor-pointer flex items-center gap-1 font-bold ${
                              isSpeakingThis ? 'text-purple-600 animate-pulse' : 'text-slate-500 hover:text-purple-600'
                            }`}
                            title={isSpeakingThis ? 'Остановить воспроизведение' : 'Прослушать ответ голосом'}
                          >
                            {isSpeakingThis ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5 text-purple-600" />
                                <span className="text-purple-600">Стоп</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Слушать</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.text, msg.id)}
                          className="p-1 hover:text-slate-700 transition-colors cursor-pointer flex items-center gap-0.5"
                          title="Скопировать ответ"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Скопировано</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Копировать</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap leading-relaxed select-text font-sans">
                    {msg.text}
                  </div>

                  {isErr && (
                    <div className="mt-2 pt-2 border-t border-rose-200 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModelKey('gemini-3-flash-live');
                          handleSendMessage(messages.filter(m => m.role === 'user').slice(-1)[0]?.text);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Попробовать через Gemini 3 Flash Live
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading typing indicator */}
        {isLoading && (
          <div className="flex gap-2.5 justify-start items-center">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs flex items-center gap-2 text-xs text-purple-700 font-semibold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
              <span>Модель {currentModelConfig.name} слушает и формирует ответ...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice active indicator banner */}
      {isListening && (
        <div className="mb-2 p-2.5 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-center justify-between text-xs text-rose-900 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
            <span className="font-bold">Идёт запись с микрофона... Говорите в микрофон!</span>
          </div>
          <button
            type="button"
            onClick={toggleListening}
            className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Готово (Отправить)
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm shrink-0">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          {/* Microphone button for Voice In */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-xl font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                isListening
                  ? 'bg-rose-600 text-white ring-4 ring-rose-200 animate-pulse'
                  : 'bg-purple-100 hover:bg-purple-200 text-purple-800'
              }`}
              title={isListening ? 'Остановить запись' : 'Говорить голосом в микрофон'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setRecognitionLang(recognitionLang === 'ro-RO' ? 'ru-RU' : 'ro-RO')}
              className="text-[10px] font-bold text-slate-500 hover:text-purple-700 uppercase"
              title="Переключить язык распознавания речи"
            >
              {recognitionLang === 'ro-RO' ? '🇷🇴 RO' : '🇷🇺 RU'}
            </button>
          </div>

          <textarea
            rows={2}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              isListening
                ? 'Слушаю вас... Говорите в микрофон...'
                : 'Напишите или надиктуйте голосом вопрос (Enter — отправить)...'
            }
            className={`flex-1 text-xs sm:text-sm p-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none transition-all ${
              isListening
                ? 'bg-rose-50/40 border-rose-300 text-rose-950 font-medium'
                : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white'
            }`}
            disabled={isLoading}
          />

          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              title="Отправить сообщение"
            >
              <Send className="w-4 h-4" />
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer self-center"
                title="Очистить диалог"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                Настройка ключа Google Gemini API
              </h3>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Ключ необходим для прямых запросов к моделям Gemini. Получить бесплатный персональный ключ можно в{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline font-semibold hover:text-blue-800"
              >
                Google AI Studio
              </a>.
            </p>

            <form onSubmit={handleSaveApiKey} className="space-y-3">
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full text-xs font-mono p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400"
                required
              />

              {keySavedNotice && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Ключ успешно сохранен в браузере!
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
