import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getGeminiApiKey,
  saveGeminiApiKey,
  isGeminiConfigured,
  fetchAvailableGeminiModels,
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
  HelpCircle,
  Key,
  Bot,
  User,
  ArrowRight
} from 'lucide-react';

interface ModelOption {
  id: string;
  label: string;
  group: 'lite' | 'flash' | 'pro' | 'experimental' | 'custom';
  description?: string;
}

const DEFAULT_PRESET_MODELS: ModelOption[] = [
  // Fast Lite
  { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite (Latest)', group: 'lite', description: 'Макс. скорость, стабильные квоты, без 503' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', group: 'lite', description: 'Оптимальный баланс качества и скорости' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', group: 'lite', description: 'Легковесная быстрая модель' },

  // Flash
  { id: 'gemini-flash-latest', label: 'Gemini Flash (Latest)', group: 'flash', description: 'Стандартная универсальная модель' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Live Translate)', group: 'flash', description: 'Продвинутый перевод и генерация' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Live)', group: 'flash', description: 'Новейшая быстрая модель' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview', group: 'flash', description: 'Предварительная версия' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', group: 'flash', description: 'Предыдущее поколение Flash' },

  // Pro & Extended Thinking
  { id: 'gemini-pro-latest', label: 'Gemini Pro (Latest)', group: 'pro', description: 'Глубокий анализ и рассуждения' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', group: 'pro', description: 'Флагманская модель рассуждений' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', group: 'pro', description: 'Предыдущее поколение Pro' },

  // Experimental / Audio / Speech / Transcribe
  { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash Native Audio / TTS', group: 'experimental', description: 'Синтез и аудио-диалог' },
  { id: 'gemini-3.5-transcribe', label: 'Gemini 3.5 Transcribe Live', group: 'experimental', description: 'Транскрибация и распознавание' },
  { id: 'gemini-3.8-flash-tts', label: 'Gemini 3.8 Flash TTS', group: 'experimental', description: 'Новое поколение TTS' },
  { id: 'gemini-omni-1.2-flash', label: 'Gemini Omni 1.2 Flash', group: 'experimental', description: 'Мультимодальная Omni модель' }
];

const SYSTEM_PROMPTS = [
  {
    id: 'tutor_antem',
    title: '🎓 Преподаватель ANTEM (A1-A2)',
    text: `Ești un profesor universitar și evaluator expert de limba română (metodologia ANTEM, nivel A1-A2).
Răspunde clar, prietenos și încurajator. Folosește limba română curată (cu diacritice: ă, â, î, ș, ț). Dacă utilizatorul întreabă în rusă sau are neclarități, explică regula gramaticală pe scurt în limba rusă și oferă exemple practice în română.`
  },
  {
    id: 'editor_proofreader',
    title: '✍️ Редактор и грамматический разбор',
    text: `Ești un lingvist și redactor riguros de limba română.
Analizează fiecare frază a utilizatorului:
1. Identifică greșelile de acord, conjugare, pronume clitice sau diacritice.
2. Oferă varianta corectată cu explicație scurtă a regulii.
3. Dacă textul este corect, confirmă și propune o variantă stilistic mai bogată.`
  },
  {
    id: 'free_conversation',
    title: '💬 Собеседник из Кишинёва',
    text: `Ești un prieten vorbitor nativ de limba română din Chișinău.
Porți un dialog cald, prietenos și natural în limba română de zi cu zi. Pune întrebări deschise, menține conversația vie și corectează subtil eventualele greșeli ale partenerului de dialog.`
  },
  {
    id: 'quiz_generator',
    title: '🧪 Генератор упражнений',
    text: `Ești un metodist specializat în crearea testelor de limba română pentru străini (nivel A1-A2).
Creează exerciții concise: completare de spații (gaps), întrebări Adevărat/Fals, sau potrivire de coloane cu cheia de răspunsuri la final.`
  }
];

const QUICK_PROMPTS = [
  'Verifică gramatica: „Eu merge la magazin ieri și cumpără pâine.”',
  'Explică pe scurt regula: când folosim prepoziția „la” și când „în”?',
  'Compune un dialog de 6 replici la cafenea (nivel A1)',
  'Care este diferența dintre verbele „a ști”, „a cunoaște” și „a afla”?'
];

export const AIChatView: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'teacher';

  const [selectedModel, setSelectedModel] = useState<string>('gemini-flash-lite-latest');
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [availableApiModels, setAvailableApiModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);

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

  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [keySavedNotice, setKeySavedNotice] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const activeModel = isCustomModel ? (customModelInput.trim() || 'gemini-flash-lite-latest') : selectedModel;

  const handleFetchAllModels = async () => {
    setIsFetchingModels(true);
    try {
      const models = await fetchAvailableGeminiModels();
      setAvailableApiModels(models);
    } catch (err: any) {
      alert(`Nu s-a putut încărca lista de modele: ${err.message}`);
    } finally {
      setIsFetchingModels(false);
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
        activeModel,
        newHistory.map(m => ({ role: m.role, text: m.text })),
        systemPrompt,
        temperature
      );

      const botMsg: ChatMessageItem = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'model',
        text: res.text,
        timestamp: Date.now(),
        modelUsed: res.modelUsed,
        latencyMs: res.latencyMs
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessageItem = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'model',
        text: `⚠️ Ошибка модели [${activeModel}]: ${err.message}`,
        timestamp: Date.now(),
        modelUsed: activeModel,
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
                  AI Lab • Диалоговая лаборатория
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  Тест
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Прямое тестирование моделей Google Gemini для методики ANTEM
              </p>
            </div>
          </div>

          {/* Model selector & Settings Controls */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
              <span className="text-[11px] font-bold text-slate-500 pl-1.5 hidden sm:inline">Модель:</span>
              <select
                value={isCustomModel ? '__custom__' : selectedModel}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    setIsCustomModel(true);
                  } else {
                    setIsCustomModel(false);
                    setSelectedModel(e.target.value);
                  }
                }}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer max-w-[220px] truncate"
              >
                <optgroup label="🚀 Быстрые Lite (Рекомендуемые)">
                  {DEFAULT_PRESET_MODELS.filter(m => m.group === 'lite').map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="⚡ Стандартные Flash">
                  {DEFAULT_PRESET_MODELS.filter(m => m.group === 'flash').map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="🧠 Pro / Extended Thinking">
                  {DEFAULT_PRESET_MODELS.filter(m => m.group === 'pro').map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="🎙️ Экспериментальные / Live / TTS / Transcribe">
                  {DEFAULT_PRESET_MODELS.filter(m => m.group === 'experimental').map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </optgroup>
                {availableApiModels.length > 0 && (
                  <optgroup label="🌐 Все модели из Google API">
                    {availableApiModels.map(name => (
                      <option key={`api-${name}`} value={name}>{name}</option>
                    ))}
                  </optgroup>
                )}
                <option value="__custom__">✏️ Ввести своё имя модели...</option>
              </select>

              <button
                type="button"
                onClick={handleFetchAllModels}
                disabled={isFetchingModels}
                title="Загрузить полный список всех доступных моделей из Google API"
                className="p-1 text-slate-500 hover:text-purple-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingModels ? 'animate-spin text-purple-600' : ''}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showSettings
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title="Настройки системного промпта и температуры"
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

        {/* Custom model name text input if custom selected */}
        {isCustomModel && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
            <span className="text-xs font-bold text-purple-900 shrink-0">Имя модели:</span>
            <input
              type="text"
              value={customModelInput}
              onChange={e => setCustomModelInput(e.target.value)}
              placeholder="например: gemini-3.5-flash или models/gemini-..."
              className="flex-1 px-3 py-1 text-xs border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
            />
          </div>
        )}

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
              <span className="text-[10px] text-slate-400">(0.0 = строгие факты, 1.0 = креативность)</span>
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
              Лаборатория диалога с моделями Gemini
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-5">
              Задайте вопрос на румынском или русском, попросите составить упражнение или протестируйте поведение выбранной модели.
            </p>

            <div className="w-full max-w-lg space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Быстрые примеры запросов:
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
                          {msg.modelUsed || activeModel}
                        </span>
                        {msg.latencyMs !== undefined && (
                          <span className="text-slate-400">⏱️ {msg.latencyMs} ms</span>
                        )}
                      </div>
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
                  )}

                  <div className="whitespace-pre-wrap leading-relaxed select-text font-sans">
                    {msg.text}
                  </div>

                  {isErr && (
                    <div className="mt-2 pt-2 border-t border-rose-200 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModel('gemini-flash-lite-latest');
                          setIsCustomModel(false);
                          handleSendMessage(messages.filter(m => m.role === 'user').slice(-1)[0]?.text);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Попробовать через Gemini Flash Lite
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
              <span>Модель {activeModel} формирует ответ...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm shrink-0">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
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
            placeholder="Напишите сообщение или вопрос по румынскому языку (Enter — отправить, Shift+Enter — перенос)..."
            className="flex-1 text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white resize-none"
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

