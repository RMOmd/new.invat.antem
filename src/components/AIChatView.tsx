import React, { useState, useEffect, useRef } from 'react';
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
  Zap
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
Răspunde concis (2-4 fraze), prietenos și încurajator, potrivit pentru dialog oral. Folosește limba română curată (cu diacritice: ă, â, î, ș, ț). Dacă utilizatorul întreabă în rusă, explică regula scurt și oferă exemplul în română.`
  },
  {
    id: 'free_conversation',
    title: '💬 Собеседник из Кишинёва',
    text: `Ești un prieten vorbitor nativ de limba română din Chișinău.
Porți un dialog vocal cald, prietenos și natural în limba română de zi cu zi. Răspunde cu replici scurte de conversație vie (1-3 fraze) și pune o întrebare de continuare.`
  },
  {
    id: 'editor_proofreader',
    title: '✍️ Редактор и грамматический разбор',
    text: `Ești un lingvist și redactor riguros de limba română.
Analizează fiecare frază a utilizatorului:
1. Identifică greșelile de acord, conjugare, pronume clitice sau diacritice.
2. Oferă varianta corectată cu explicație scurtă a regulii.`
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

  // Default to Gemini 3 Flash Live (verified 200 OK responsive)
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

  // VOICE IN & VOICE OUT (Full-Duplex Audio Dialogue)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognitionLang, setRecognitionLang] = useState<'ro-RO' | 'ru-RU'>('ro-RO');
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [keySavedNotice, setKeySavedNotice] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentModelConfig = UNLIMITED_MODELS.find(m => m.key === selectedModelKey) || UNLIMITED_MODELS[0];

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Persist chat in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('romanian_ai_lab_chat', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  // Cleanup speech synthesis on unmount
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
    };
  }, []);

  // Speak text using Web Speech API with clean Romanian pronunciation
  const speakText = (text: string, msgId?: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    if (currentlySpeakingId === msgId) {
      setCurrentlySpeakingId(null);
      return;
    }

    const clean = text
      .replace(/[*#_`>~]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = recognitionLang === 'ru-RU' ? 'ru-RU' : 'ro-RO';
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const roVoice = voices.find(v => v.lang.startsWith('ro') || v.lang.includes('RON') || v.name.toLowerCase().includes('romanian'));
    const ruVoice = voices.find(v => v.lang.startsWith('ru') || v.name.toLowerCase().includes('russian'));

    if (recognitionLang === 'ro-RO' && roVoice) {
      utterance.voice = roVoice;
    } else if (recognitionLang === 'ru-RU' && ruVoice) {
      utterance.voice = ruVoice;
    }

    if (msgId) setCurrentlySpeakingId(msgId);

    utterance.onend = () => setCurrentlySpeakingId(null);
    utterance.onerror = () => setCurrentlySpeakingId(null);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setCurrentlySpeakingId(null);
  };

  // Toggle Voice Recording with SpeechRecognition
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Recunoașterea vocală nu este suportată în acest browser. Vă rugăm să folosiți Google Chrome sau Microsoft Edge.');
      return;
    }

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
      return;
    }

    stopSpeaking();

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = recognitionLang;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((res: any) => res[0]?.transcript || '')
          .join('');
        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition notice:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

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

          {/* Model selector (strictly the 6 unlimited models) & controls */}
          <div className="flex items-center flex-wrap gap-2">
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
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer max-w-[270px] truncate"
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
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2 text-xs">
          <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md">
            {currentModelConfig.name}
          </span>
          <span className="text-slate-500 truncate">
            {currentModelConfig.description}
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
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-5">
              Нажмите на 🎙️ микрофон снизу, чтобы сказать фразу голосом. ИИ поймёт вашу речь и ответит голосом в реальном времени!
            </p>

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
