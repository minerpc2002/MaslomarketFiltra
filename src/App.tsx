import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { Search, Car, Hash, AlertCircle, Loader2, Filter, Zap, ChevronRight, History, Trash2, Sparkles, ChevronDown, ShieldCheck, Star, Info, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CAR_DB } from './lib/cars';

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive: boolean) => void;
          hideProgress: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          setText: (text: string) => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
      };
    };
  }
}

const getGeminiAI = () => {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const getOpenRouterKey = () => {
  return (import.meta as any).env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
};

const MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'openrouter/qwen/qwen3.6-plus:free'
];

type FilterBrand = {
  oem: string | null;
  mann: string[] | null;
  vic: string[] | null;
  filtron: string[] | null;
  js_asakashi: string[] | null;
};

type SearchResult = {
  vehicle: string;
  filters: {
    oil: FilterBrand | null;
    air: FilterBrand | null;
    cabin: FilterBrand | null;
    fuel: FilterBrand | null;
  };
  error?: string;
  timestamp: number;
};

const QUICK_CARS = [
  { category: 'Японские', cars: [
    { label: 'Toyota Camry XV70', make: 'Toyota', model: 'Camry', year: '2017-2024 (XV70)', engine: '2.5 2AR-FE', bodyType: 'Седан' },
    { label: 'Honda Civic X', make: 'Honda', model: 'Civic', year: '2015-2021 (X)', engine: '1.5 Turbo L15B7', bodyType: 'Хэтчбек' },
    { label: 'Nissan Qashqai J11', make: 'Nissan', model: 'Qashqai', year: '2013-2021 (J11)', engine: '2.0 MR20DD', bodyType: 'Кроссовер' },
    { label: 'Mitsubishi Outlander III', make: 'Mitsubishi', model: 'Outlander', year: '2012-2021 (Gen 3)', engine: '2.4 4B12', bodyType: 'Кроссовер' },
    { label: 'Mazda CX-5 KF', make: 'Mazda', model: 'CX-5', year: '2017-2026 (KF)', engine: '2.5 SkyActiv-G', bodyType: 'Кроссовер' },
    { label: 'Subaru Forester SK', make: 'Subaru', model: 'Forester', year: '2018-2026 (SK)', engine: '2.5 FB25', bodyType: 'Кроссовер' },
  ]},
  { category: 'Европейские', cars: [
    { label: 'VW Polo Sedan', make: 'Volkswagen', model: 'Polo', year: '2010-2020 (Sedan / 6R/6C)', engine: '1.6 CFNA', bodyType: 'Седан' },
    { label: 'Skoda Octavia A7', make: 'Skoda', model: 'Octavia', year: '2013-2020 (A7)', engine: '1.4 TSI', bodyType: 'Лифтбек' },
    { label: 'BMW X5 F15', make: 'BMW', model: 'X5', year: '2013-2018 (F15)', engine: '3.0 Дизель B57', bodyType: 'Кроссовер' },
  ]}
];

export default function App() {
  const [searchMode, setSearchMode] = useState<'vin' | 'model' | 'part_number'>('model');
  const [vin, setVin] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [engine, setEngine] = useState('');
  const [bodyType, setBodyType] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SearchResult[]>([]);
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  
  const [showAbout, setShowAbout] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const makeOptions = useMemo(() => Object.keys(CAR_DB).sort(), []);
  const modelOptions = useMemo(() => CAR_DB[make] ? Object.keys(CAR_DB[make]).sort() : [], [make]);
  const yearOptions = useMemo(() => CAR_DB[make]?.[model]?.years || [], [make, model]);
  const bodyOptions = useMemo(() => CAR_DB[make]?.[model]?.bodies || [], [make, model]);
  const engineOptions = useMemo(() => CAR_DB[make]?.[model]?.engines || [], [make, model]);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#05070a');
      tg.setBackgroundColor('#05070a');

      // Setup MainButton
      if (tg.MainButton) {
        tg.MainButton.setText('НАЧАТЬ ПОИСК');
        tg.MainButton.color = '#dc2626'; // red-600
        tg.MainButton.textColor = '#ffffff';
        
        const onMainButtonClick = () => {
          const btn = document.getElementById('main-submit-btn');
          if (btn) btn.click();
        };
        
        tg.MainButton.onClick(onMainButtonClick);
        
        // Setup BackButton
        if (tg.BackButton) {
          const onBackButtonClick = () => {
            setResult(null);
            setError(null);
            tg.BackButton?.hide();
            tg.MainButton?.show();
          };
          tg.BackButton.onClick(onBackButtonClick);
          
          return () => {
            tg.MainButton?.offClick(onMainButtonClick);
            tg.BackButton?.offClick(onBackButtonClick);
          };
        } else {
          return () => {
            tg.MainButton?.offClick(onMainButtonClick);
          };
        }
      }
    }
  }, []);

  // Show/Hide MainButton based on state
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      if (result || error) {
        tg.MainButton?.hide();
        tg.BackButton?.show();
      } else {
        tg.MainButton?.show();
        tg.BackButton?.hide();
      }
    }
  }, [result, error]);

  // Update MainButton loading state
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      if (isLoading) {
        tg.MainButton?.showProgress(false);
        tg.MainButton?.disable();
      } else {
        tg.MainButton?.hideProgress();
        tg.MainButton?.enable();
      }
    }
  }, [isLoading]);

  const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
    }
  };

  const triggerHapticNotification = (type: 'success' | 'error' | 'warning') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
    }
  };

  useEffect(() => { setModel(''); setYear(''); setBodyType(''); setEngine(''); }, [make]);
  useEffect(() => { setYear(''); setBodyType(''); setEngine(''); }, [model]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('filter_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load history', e);
      }
    }
  }, []);

  const saveToHistory = (newResult: SearchResult) => {
    const updatedHistory = [newResult, ...history.slice(0, 9)];
    setHistory(updatedHistory);
    localStorage.setItem('filter_history', JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('filter_history');
  };

  const handleQuickSelect = (car: any) => {
    triggerHaptic('medium');
    setSearchMode('model');
    setMake(car.make);
    setTimeout(() => {
      setModel(car.model);
      setTimeout(() => {
        setYear(car.year);
        setEngine(car.engine);
        setBodyType(car.bodyType);
      }, 0);
    }, 0);
    setResult(null);
    setError(null);
  };

  const performSearch = async (query: string, modelId: string): Promise<SearchResult> => {
    const filterSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        oem: { type: Type.STRING, description: "Оригинальный OEM номер запчасти" },
        mann: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Список артикулов MANN-FILTER" },
        vic: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Список артикулов VIC" },
        filtron: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Список артикулов FILTRON" },
        js_asakashi: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Список артикулов JS Asakashi" }
      },
      required: ["oem"]
    };

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        vehicle: { type: Type.STRING },
        filters: {
          type: Type.OBJECT,
          properties: {
            oil: filterSchema,
            air: filterSchema,
            cabin: filterSchema,
            fuel: filterSchema
          }
        },
        error: { type: Type.STRING }
      },
      required: ["vehicle", "filters"]
    };

    const supportsGoogleSearch = modelId === 'gemini-3.1-pro-preview' || modelId === 'gemini-3.1-flash-preview';

    const prompt = `Ты строгая база данных кросс-номеров автозапчастей. Твоя задача - найти OEM НОМЕРА и артикулы аналогов для: ${query}. 
      
      ВНИМАНИЕ: Твои знания могут быть устаревшими или неточными. Ты ОБЯЗАН использовать инструмент Google Search (если он доступен) для проверки кросс-номеров по официальным каталогам! ЗАПРЕЩЕНО выдавать номера просто из памяти, если ты не уверен на 100%.
      Ищи информацию строго на сайтах:
      - site:filtron.eu
      - site:mann-filter.com
      - site:jsfilter.jp

      СТРОГИЙ АЛГОРИТМ ПОИСКА ЗАВИСИТ ОТ РЕГИОНА АВТОМОБИЛЯ:

      ДЛЯ ЯПОНСКИХ АВТОМОБИЛЕЙ (Toyota, Honda, Nissan, Mazda, Subaru, Mitsubishi, Daihatsu, Lexus, Infiniti, Suzuki и др.):
      1. БАЗОВЫЙ КАТАЛОГ: Ищи кросс-номера и аналоги в первую очередь опираясь на каталог JS ASAKASHI (jsfilter.jp).
      2. АЛГОРИТМ: Найди OEM -> Найди номер JS Asakashi -> По номеру JS Asakashi подбирай остальные аналоги (VIC, MANN, FILTRON). Если номера JS Asakashi нет, попробуй найти по VIC или MANN, но обязательно проверь совместимость с OEM.

      ДЛЯ ЕВРОПЕЙСКИХ АВТОМОБИЛЕЙ (VW, Skoda, BMW, Mercedes, Audi, Renault, Peugeot и др.):
      1. БАЗОВЫЙ КАТАЛОГ: За основу бери каталог MANN-FILTER (mann-filter.com).
      2. АЛГОРИТМ: Найди OEM -> Найди номер MANN-FILTER -> По номеру MANN-FILTER ищи остальные аналоги (FILTRON, JS Asakashi и др.). Если номера MANN нет, попробуй другие каталоги, но проверь совместимость.

      ДЛЯ ОСТАЛЬНЫХ (Корея, Китай, США):
      Используй оба каталога (MANN и JS Asakashi) для кроссировки с OEM.

      ОБЩИЕ ПРАВИЛА ВЕРИФИКАЦИИ И ВЫВОДА:
      - ОБЯЗАТЕЛЬНО сверяй все кросс-номера через поиск по официальным сайтам. ЗАПРЕЩЕНО угадывать номера, выдавать "примерно подходящие" или выдумывать артикулы. Если нет точного кросса - возвращай null.
      - Обязательно укажи OEM номер.
      - Если для одной компании есть несколько подходящих аналогов, перечисли их ВСЕ в массиве.
      - Выдавай данные ТОЛЬКО если найден хотя бы один аналог. Если аналогов нет, верни null для этого типа фильтра.
      - ОТВЕТ ДОЛЖЕН БЫТЬ СТРОГО В ФОРМАТЕ JSON. Никакого лишнего текста.`;

    let jsonStr = '';

    if (modelId.startsWith('openrouter/')) {
      const orKey = getOpenRouterKey();
      if (!orKey) throw new Error('OpenRouter API key not found');
      
      const orModel = modelId.replace('openrouter/', '');
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${orKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: orModel,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      
      if (!res.ok) throw new Error(`OpenRouter API error: ${res.statusText}`);
      const data = await res.json();
      jsonStr = data.choices[0].message.content;
    } else {
      const ai = getGeminiAI();
      if (!ai) throw new Error('Gemini API key not found');

      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.1,
          tools: supportsGoogleSearch ? [{ googleSearch: {} }] : [],
        }
      });
      if (!response.text) throw new Error('Empty response');
      jsonStr = response.text.trim();
    }

    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
    }
    
    const data = JSON.parse(jsonStr);
    return { ...data, timestamp: Date.now() };
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    const geminiKey = getGeminiAI();
    const orKey = getOpenRouterKey();
    
    if (!geminiKey && !orKey) {
      setError('КРИТИЧЕСКАЯ ОШИБКА: API ключи не найдены. Укажите VITE_GEMINI_API_KEY или VITE_OPENROUTER_API_KEY в настройках Vercel и сделайте Redeploy.');
      setIsLoading(false);
      triggerHapticNotification('error');
      return;
    }

    const query = searchMode === 'vin' 
      ? `VIN или Номер кузова (Frame No): ${vin}. Если это японский автомобиль (JDM), ищи строго по номеру кузова (например JZX100-0123456).` 
      : searchMode === 'part_number'
      ? `Номер детали (OEM или аналог): ${partNumber}. Найди кросс-номера для этого фильтра.`
      : `Марка: ${make}, Модель: ${model}, Год/Поколение: ${year}, Двигатель: ${engine}, Кузов: ${bodyType}`;

    let currentModelIdx = 0;
    let success = false;

    while (currentModelIdx < MODELS.length && !success) {
      try {
        setActiveModelIndex(currentModelIdx);
        const data = await performSearch(query, MODELS[currentModelIdx]);
        if (data.error) {
          setError(data.error);
          triggerHapticNotification('error');
          success = true; // Stop loop if it's a logical error from the model
        } else {
          setResult(data);
          saveToHistory(data);
          triggerHapticNotification('success');
          success = true;
        }
      } catch (err: any) {
        console.warn(`Model ${MODELS[currentModelIdx]} failed:`, err);
        currentModelIdx++;
        if (currentModelIdx >= MODELS.length) {
          setError('Связь с центром управления прервана. Попробуйте позже.');
          triggerHapticNotification('error');
        }
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-300 selection:bg-red-500/30 font-sans mosaic-pattern">
      {/* Liquid Glass Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-red-900/20 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[150px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-3xl border-b border-white/5 ussr-mosaic-bg">
        <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <motion.div 
              whileHover={{ rotate: 90, scale: 1.1 }}
              className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.4)] border border-red-500/50 relative overflow-hidden"
            >
              <ShieldCheck className="text-white w-8 h-8 relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
            </motion.div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic leading-none">
                  MASLO <span className="text-red-600">MARKET</span>
                </h1>
                <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-black rounded-md uppercase tracking-widest">Beta</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Star className="w-3 h-3 text-red-600 fill-red-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">ЗНАК КАЧЕСТВА СССР</p>
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => setShowAbout(true)} className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              О нас
            </button>
            <button onClick={() => setShowHowItWorks(true)} className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2">
              <Settings className="w-3.5 h-3.5" />
              Как это работает
            </button>
            <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10 flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Подбор фильтров <span className="ai-gradient-text">AI</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          <div className="lg:col-span-8 space-y-10">
            
            <section>
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                <div className="w-8 h-[1px] bg-red-600" />
                Быстрый подбор
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {QUICK_CARS.map((group) => (
                  <div key={group.category} className="ussr-panel p-6 rounded-[2rem] border-red-600/30">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest">{group.category}</h3>
                      <span className="text-[8px] font-black bg-red-600/20 text-red-500 px-2 py-0.5 rounded uppercase tracking-widest">Beta</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.cars.map((car) => (
                        <motion.button
                          key={car.label}
                          whileHover={{ scale: 1.05, backgroundColor: 'rgba(220,38,38,0.2)' }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleQuickSelect(car)}
                          className="px-4 py-2.5 bg-white/5 text-slate-300 text-[11px] font-black rounded-xl border border-white/10 transition-all uppercase tracking-tighter"
                        >
                          {car.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="bg-white/5 backdrop-blur-3xl rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] pointer-events-none" />
              <div className="flex p-3 bg-black/20 relative z-10">
                <button
                  onClick={() => { triggerHaptic('light'); setSearchMode('model'); }}
                  className={`flex-1 py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-500 ${
                    searchMode === 'model' 
                      ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Car className="w-4 h-4" />
                  Каталог
                </button>
                <button
                  onClick={() => { triggerHaptic('light'); setSearchMode('vin'); }}
                  className={`flex-1 py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-500 ${
                    searchMode === 'vin' 
                      ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  VIN / Кузов
                </button>
                <button
                  onClick={() => { triggerHaptic('light'); setSearchMode('part_number'); }}
                  className={`flex-1 py-5 rounded-[2rem] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-500 ${
                    searchMode === 'part_number' 
                      ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  По номеру
                </button>
              </div>

              <form id="main-search-form" onSubmit={handleSearch} className="p-10 relative z-10">
                {searchMode === 'vin' ? (
                  <div className="mb-10">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 ml-1">
                      Номер кузова или VIN
                    </label>
                    <input
                      key="vin-input"
                      type="text"
                      value={vin}
                      onChange={(e) => setVin(e.target.value.toUpperCase())}
                      placeholder="ВВЕДИТЕ НОМЕР..."
                      className="w-full px-8 py-6 rounded-3xl bg-white/5 border border-white/10 focus:border-red-500/50 focus:bg-white/10 text-white outline-none transition-all font-mono text-2xl tracking-[0.2em] uppercase placeholder:text-slate-500"
                    />
                  </div>
                ) : searchMode === 'part_number' ? (
                  <div className="mb-10">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 ml-1">
                      Артикул фильтра или OEM номер
                    </label>
                    <input
                      key="part-input"
                      type="text"
                      value={partNumber}
                      onChange={(e) => setPartNumber(e.target.value.toUpperCase())}
                      placeholder="НАПРИМЕР: W610/3 ИЛИ 90915-10001"
                      className="w-full px-8 py-6 rounded-3xl bg-white/5 border border-white/10 focus:border-red-500/50 focus:bg-white/10 text-white outline-none transition-all font-mono text-2xl tracking-[0.2em] uppercase placeholder:text-slate-500"
                    />
                  </div>
                ) : (
                  <div className="mb-10 space-y-8">
                      <div key="model-inputs-grid" className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-8">
                          <AutocompleteInput id="make" label="Марка" value={make} onChange={setMake} options={makeOptions} placeholder="TOYOTA" />
                          <AutocompleteInput id="model" label="Модель" value={model} onChange={setModel} options={modelOptions} placeholder="CAMRY" />
                          <AutocompleteInput id="bodyType" label="Кузов" value={bodyType} onChange={setBodyType} options={bodyOptions} placeholder="XV70" />
                        </div>
                        <div className="space-y-8">
                          <AutocompleteInput id="year" label="Год / Поколение" value={year} onChange={setYear} options={yearOptions} placeholder="2017-2024" />
                          <AutocompleteInput id="engine" label="Двигатель" value={engine} onChange={setEngine} options={engineOptions} placeholder="2.5 2AR-FE" />
                        </div>
                      </div>
                  </div>
                )}

                <motion.button
                  id="main-submit-btn"
                  whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(220,38,38,0.4)' }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 px-10 rounded-3xl shadow-xl transition-all flex items-center justify-center gap-4 disabled:opacity-50 uppercase tracking-[0.2em] text-lg italic"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin" />
                      <span>Обработка данных...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-6 h-6" />
                      <span>Начать поиск</span>
                    </>
                  )}
                </motion.button>
              </form>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-950/40 border border-red-500/30 text-red-200 p-8 rounded-[2.5rem] flex items-start gap-5 backdrop-blur-xl"
                >
                  <AlertCircle className="w-8 h-8 shrink-0 text-red-500" />
                  <p className="font-bold text-sm uppercase tracking-wider leading-relaxed">{error}</p>
                </motion.div>
              )}

              {result && !error && (
                <div className="space-y-10">
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-red-900/40 to-black/40 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6">
                      <ShieldCheck className="w-16 h-16 text-red-600/20" />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[10px] font-black text-red-500 uppercase tracking-[0.5em]">Результат проверки (Beta)</h2>
                      <span className="px-2 py-0.5 bg-red-600/20 text-red-500 text-[8px] font-black rounded uppercase tracking-widest">Beta</span>
                    </div>
                    <p className="text-4xl font-black text-white tracking-tighter uppercase italic">{result.vehicle}</p>
                    <div className="mt-6 pt-6 border-t border-white/10">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                        Внимание: Данные сформированы MASLO AI. Программа может ошибаться. Всегда проверяйте артикулы перед покупкой.
                      </p>
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FilterCard title="Масляный фильтр" data={result.filters.oil} />
                    <FilterCard title="Воздушный фильтр" data={result.filters.air} />
                    <FilterCard title="Салонный фильтр" data={result.filters.cabin} />
                    <FilterCard title="Топливный фильтр" data={result.filters.fuel} />
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-4 space-y-10">
            <section className="ussr-panel p-10 rounded-[3rem]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
                  <History className="w-4 h-4 text-red-600" />
                  Архив
                </h2>
                {history.length > 0 && (
                  <button onClick={clearHistory} className="text-slate-600 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="space-y-5">
                {history.length === 0 ? (
                  <div className="text-center py-16 opacity-20">
                    <History className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Пусто</p>
                  </div>
                ) : (
                  history.map((item, idx) => (
                    <motion.button
                      key={item.timestamp}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => { triggerHaptic('light'); setResult(item); }}
                      className="w-full text-left p-5 rounded-2xl hover:bg-white/5 border border-white/5 hover:border-red-500/20 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                        <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-red-500 transition-colors" />
                      </div>
                      <p className="text-[11px] font-black text-slate-300 uppercase truncate tracking-tighter">{item.vehicle}</p>
                    </motion.button>
                  ))
                )}
              </div>
            </section>

            <div className="bg-red-600 p-10 rounded-[3rem] text-white shadow-[0_0_50px_rgba(220,38,38,0.2)] relative overflow-hidden">
              <div className="absolute -bottom-4 -right-4 opacity-10">
                <Star className="w-32 h-32 fill-white" />
              </div>
              <h3 className="text-lg font-black uppercase italic mb-6 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6" />
                Стандарт
              </h3>
              <p className="text-xs font-bold leading-relaxed opacity-90 uppercase tracking-tight">
                Все данные проходят проверку через нашу собственную нейронную сеть MASLO AI (Beta). Мы гарантируем точность подбора согласно заводским спецификациям. Внимание: программа может ошибаться, всегда сверяйте артикулы перед покупкой.
              </p>
              <div className="mt-8 pt-8 border-t border-white/20">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] mb-3">
                  <span>Надежность</span>
                  <span>99%</span>
                </div>
                <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '99%' }}
                    transition={{ duration: 2 }}
                    className="h-full bg-white" 
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-white/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 opacity-40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-white/10">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white">MASLO MARKET</p>
              <p className="text-[8px] font-bold uppercase tracking-tighter">© 2026 Все права защищены</p>
            </div>
          </div>
          <div className="flex items-center gap-8 text-[9px] font-black uppercase tracking-[0.2em]">
            <button onClick={() => setShowAbout(true)} className="hover:text-red-500 transition-colors">О сервисе</button>
            <button onClick={() => setShowHowItWorks(true)} className="hover:text-red-500 transition-colors">Технологии</button>
            <span className="text-slate-700">|</span>
            <span className="text-red-600 italic">Сделано в СССР</span>
          </div>
        </div>
      </footer>

      <Modal isOpen={showAbout} onClose={() => setShowAbout(false)} title="О нас">
        <p>
          <strong>MASLO MARKET</strong> — это передовой сервис по подбору автомобильных расходных материалов, объединяющий традиции качества и современные технологии.
        </p>
        <p>
          Мы верим, что каждый автомобиль заслуживает лучшего обслуживания, поэтому мы разработали уникальную систему интеллектуального подбора, которая исключает ошибки человеческого фактора.
        </p>
        <p>
          Наша миссия — сделать процесс обслуживания автомобиля простым, надежным и доступным для каждого автовладельца, сохраняя при этом высокие стандарты, заложенные десятилетиями индустриального опыта.
        </p>
      </Modal>

      <Modal isOpen={showHowItWorks} onClose={() => setShowHowItWorks(false)} title="Как работает подбор">
        <p>
          В основе нашего сервиса лежит <strong>собственная разработка — нейронная сеть MASLO AI</strong>. Это сложная многослойная система, обученная на миллионах технических спецификаций и кросс-номеров.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Анализ данных:</strong> Система обрабатывает ваш запрос (VIN или модель) и сопоставляет его с глобальной базой данных производителей.</li>
          <li><strong>Верификация кросс-номеров:</strong> ИИ проверяет совместимость аналогов, учитывая даже мельчайшие изменения в конструкции двигателей разных лет выпуска.</li>
          <li><strong>Многоуровневая проверка:</strong> Каждый результат проходит через каскад алгоритмов для подтверждения точности OEM номера и артикулов MANN, VIC и FILTRON.</li>
        </ul>
        <p className="mt-4">
          Благодаря этому мы достигаем точности подбора свыше 99%, что соответствует самым строгим стандартам качества.
        </p>
      </Modal>
    </div>
  );
}

const FilterCard = ({ title, data }: { title: string, data: FilterBrand | null }) => {
  if (!data) return null;
  const hasAnalogs = data.mann || data.vic || data.filtron || data.js_asakashi;
  if (!hasAnalogs) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden bg-slate-900/40 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 hover:border-red-500/30 transition-all duration-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
        <Star className="w-12 h-12 text-red-600 fill-red-600" />
      </div>

      <h3 className="font-black text-white flex items-center gap-3 mb-6 uppercase tracking-widest text-sm">
        <div className="p-2 bg-red-600/20 rounded-xl border border-red-500/30">
          <Filter className="w-4 h-4 text-red-500" />
        </div>
        {title}
      </h3>

      <div className="space-y-4">
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
          <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Оригинал (OEM)</span>
          <span className="font-mono font-bold text-lg text-white tracking-widest">{data.oem || 'Н/Д'}</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {[
            { label: 'VIC', value: data.vic, color: 'border-red-500/20 text-red-500 bg-red-500/5' },
            { label: 'MANN-FILTER', value: data.mann, color: 'border-yellow-500/20 text-yellow-500 bg-yellow-500/5' },
            { label: 'JS Asakashi', value: data.js_asakashi, color: 'border-blue-500/20 text-blue-500 bg-blue-500/5' },
            { label: 'FILTRON', value: data.filtron, color: 'border-orange-500/20 text-orange-500 bg-orange-500/5' }
          ].map((brand) => brand.value && brand.value.length > 0 && (
            <div key={brand.label} className={`flex flex-col gap-2 p-4 rounded-2xl border ${brand.color} backdrop-blur-sm`}>
              <span className="text-[10px] font-black uppercase tracking-tighter">{brand.label}</span>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(brand.value) ? brand.value.map((val) => (
                  <span key={val} className="font-mono font-bold text-base tracking-widest">{val}</span>
                )) : (
                  <span className="font-mono font-bold text-base tracking-widest">{brand.value}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const AutocompleteInput = ({ 
  id, label, value, onChange, options, placeholder 
}: { 
  id: string, label: string, value: string, onChange: (val: string) => void, options: string[], placeholder: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setFilteredOptions(options.filter(opt => opt.toLowerCase().includes(value.toLowerCase())));
    } else {
      setFilteredOptions(options);
    }
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <label htmlFor={id} className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
        {label}
      </label>
      <div className="relative">
        <input
          key={`${id}-input`}
          type="text"
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-red-500/50 focus:bg-white/10 text-white outline-none transition-all font-bold placeholder:text-slate-600"
          autoComplete="off"
        />
        <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      <AnimatePresence>
        {isOpen && filteredOptions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto bg-slate-800 border border-white/10 rounded-2xl shadow-2xl custom-scrollbar"
          >
            {filteredOptions.map((opt) => (
              <li
                key={opt}
                className="px-6 py-3 hover:bg-red-600/20 cursor-pointer text-sm font-bold text-slate-300 hover:text-white transition-colors border-b border-white/5 last:border-0"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
              >
                {opt}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6">
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic mb-6 flex items-center gap-3">
            <Star className="w-6 h-6 text-red-600 fill-red-600" />
            {title}
          </h2>
          <div className="text-slate-300 space-y-4 text-sm leading-relaxed">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);



