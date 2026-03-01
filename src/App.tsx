import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';
import { Sparkles, Upload, Image as ImageIcon, X, ArrowRight, Check, Copy, AlertCircle, Loader2, History, MessageSquare, RefreshCw, ChevronLeft, Plus, Minus } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type ModelOption = {
  id: string;
  name: string;
  description: string;
};

const MODELS: ModelOption[] = [
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image', description: 'Latest fast model. Supports 1K-4K, extreme aspect ratios, and search grounding.' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3.0 Pro Image', description: 'Highest quality & complex reasoning. Supports 1K-4K and web search grounding.' },
  { id: 'imagen-4.0-generate-001', name: 'Imagen 4', description: 'Google\'s flagship text-to-image model. Excellent photorealism and text rendering.' },
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', description: 'Standard fast generation model. Good for general purpose.' },
];

type UploadedImage = {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
  annotation?: string;
};

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "9:21"];
const RESOLUTIONS = ["1024x1024", "1920x1080", "1080x1920", "2048x2048", "4096x4096"];

type Question = {
  id: string;
  question: string;
  type: 'text' | 'choice';
  options?: string[];
};

type Answer = {
  questionId: string;
  question: string;
  answer: string;
};

type FinalResult = {
  id: string;
  prompt: string;
  tips: string[];
  modelId: string;
  timestamp: number;
};

const Logo = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="relative">
      <div className="bg-coffee p-2 rounded-xl shadow-2xl shadow-coffee/30 border border-antique-brass/20">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
          <path 
            d="M7 4C7 4 9 2 13 2C17 2 20 5 20 9C20 13 17 16 13 16C9 16 7 14 7 14V22" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            className="text-antique-brass"
          />
          <path 
            d="M7 4V14C7 14 4 14 4 9C4 4 7 4 7 4Z" 
            fill="currentColor" 
            className="text-white"
          />
          <circle cx="13" cy="9" r="2" fill="currentColor" className="text-chinese-black" />
        </svg>
      </div>
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute -top-1 -right-1 w-3 h-3 bg-antique-brass rounded-full blur-[2px]" 
      />
    </div>
    <div className="flex flex-col">
      <span className="font-black text-xl tracking-[0.25em] uppercase text-white leading-none">BANANATOR</span>
      <span className="text-[9px] font-bold tracking-[0.4em] text-antique-brass/50 uppercase mt-1">Silent Engine v3.1</span>
    </div>
  </div>
);

export default function App() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 State
  const [initialPrompt, setInitialPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1024x1024');
  const [rulesAndNotes, setRulesAndNotes] = useState('');
  const [imageSlots, setImageSlots] = useState<(UploadedImage | null)[]>([null]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step 2 State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Step 3 State
  const [result, setResult] = useState<FinalResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isTweaking, setIsTweaking] = useState(false);
  const [tweakInput, setTweakInput] = useState('');

  // History State
  const [history, setHistory] = useState<FinalResult[]>(() => {
    const saved = localStorage.getItem('prompt_history');
    return saved ? JSON.parse(saved) : [];
  });

  const saveToHistory = (newResult: FinalResult) => {
    setHistory(prev => {
      const updated = [newResult, ...prev].slice(0, 20); // Keep last 20
      localStorage.setItem('prompt_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      
    setImageSlots((prev) => {
      const next = [...prev];
      if (next[index]) {
        URL.revokeObjectURL(next[index]!.previewUrl);
      }
      next[index] = {
        file,
        previewUrl: URL.createObjectURL(file),
        base64: base64Data,
        mimeType: file.type,
      };
      return next;
    });
    };
    reader.readAsDataURL(file);
    
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index]!.value = '';
    }
  };

  const removeSlot = (index: number) => {
    if (imageSlots.length <= 1) return;
    setImageSlots((prev) => {
      const next = [...prev];
      if (next[index]) {
        URL.revokeObjectURL(next[index]!.previewUrl);
      }
      next.splice(index, 1);
      return next;
    });
  };

  const addImageSlot = () => {
    setImageSlots(prev => [...prev, null]);
  };

  const generateQuestions = async () => {
    if (!initialPrompt.trim()) {
      setError('Please describe your vision.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const modelName = MODELS.find(m => m.id === selectedModel)?.name || selectedModel;
      
      // Create a more structured prompt that labels each image and includes metadata
      const contents = [
        {
          parts: [
            { text: `You are an expert prompt engineer for Google AI image models. The user wants to generate an image using the model: "${modelName}".` },
            { text: `Target Aspect Ratio: ${aspectRatio}` },
            { text: `Target Resolution: ${resolution}` },
            { text: `Initial Idea: "${initialPrompt}"` },
            { text: `Rules & Constraints: "${rulesAndNotes || 'None specified'}"` },
            ...imageSlots.flatMap((img, idx) => {
              if (!img) return [];
              return [
                { text: `Reference image labeled "img${idx + 1}"${img.annotation ? ` (User Annotation: ${img.annotation})` : ''}:` },
                { inlineData: { data: img.base64, mimeType: img.mimeType } }
              ];
            }),
            { text: `Analyze their request, the metadata, and the labeled reference images. Use Google Search if needed to check for specific artistic styles, technical terms, or up-to-date knowledge about this model's preferences.
If the request is already incredibly detailed and perfect, return an empty array [].
Otherwise, what 1 to 3 essential questions should we ask them to clarify their vision, add missing details, and create the ultimate, perfect prompt for this specific model?
Return a JSON array of up to 3 questions. Keep questions concise and focused on visual details (style, lighting, composition, mood, specific elements).` }
          ]
        }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                question: { type: Type.STRING },
                type: { type: Type.STRING, description: "Either 'text' or 'choice'" },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "If type is choice, provide 3-4 distinct options" }
              },
              required: ["id", "question", "type"]
            }
          }
        }
      });

      const generatedQuestions = JSON.parse(response.text || '[]');
      if (generatedQuestions.length === 0) {
        await generateFinalPrompt([]);
      } else {
        setQuestions(generatedQuestions);
        setStep(2);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const generateFinalPrompt = async (currentQuestions = questions) => {
    setIsLoading(true);
    setError(null);

    try {
      const modelName = MODELS.find(m => m.id === selectedModel)?.name || selectedModel;
      
      const formattedAnswers = currentQuestions.map(q => ({
        question: q.question,
        answer: answers[q.id] || 'Not specified'
      }));

      const answersText = formattedAnswers.length > 0 
        ? `They answered the following clarifying questions:\n${formattedAnswers.map(a => `- ${a.question}: ${a.answer}`).join('\n')}`
        : 'No additional clarifying questions were asked.';

      const contents = [
        {
          parts: [
            { text: `You are an expert prompt engineer for Google AI image models. The user wants to generate an image using the model: "${modelName}".` },
            { text: `Target Aspect Ratio: ${aspectRatio}` },
            { text: `Target Resolution: ${resolution}` },
            { text: `Initial Idea: "${initialPrompt}"` },
            { text: `Rules & Constraints: "${rulesAndNotes || 'None specified'}"` },
            ...imageSlots.flatMap((img, idx) => {
              if (!img) return [];
              return [
                { text: `Reference image labeled "img${idx + 1}"${img.annotation ? ` (User Annotation: ${img.annotation})` : ''}:` },
                { inlineData: { data: img.base64, mimeType: img.mimeType } }
              ];
            }),
            { text: `${answersText}

Based on this information, the metadata, and the labeled reference images, write the ultimate, highly detailed, and perfectly structured text prompt curated specifically for ${modelName}. 
Ensure the prompt reflects the requested aspect ratio (${aspectRatio}) and resolution (${resolution}) if the model supports such parameters in the prompt text.
Use Google Search to ensure you are using the most up-to-date best practices for this specific model.
Also provide 2-3 expert tips or secrets for getting the best results with this specific model.` }
          ]
        }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING, description: "The final, highly detailed text prompt ready to be pasted into the image generator." },
              tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Expert tips and secrets for getting the best results with this specific model." }
            },
            required: ["prompt", "tips"]
          }
        }
      });

      const finalData = JSON.parse(response.text || '{}');
      const newResult: FinalResult = {
        ...finalData,
        id: Math.random().toString(36).substring(7),
        modelId: selectedModel,
        timestamp: Date.now()
      };
      setResult(newResult);
      saveToHistory(newResult);
      setStep(3);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate the final prompt. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTweak = async () => {
    if (!tweakInput.trim() || !result) return;
    setIsLoading(true);
    setError(null);

    try {
      const modelName = MODELS.find(m => m.id === selectedModel)?.name || selectedModel;
      
      const contents = [
        {
          parts: [
            { text: `You are refining an existing image prompt for ${modelName}.` },
            { text: `Current Prompt: "${result.prompt}"` },
            { text: `User's requested adjustment: "${tweakInput}"` },
            ...imageSlots.flatMap((img, idx) => {
              if (!img) return [];
              return [
                { text: `Reference image labeled "img${idx + 1}"${img.annotation ? ` (User Annotation: ${img.annotation})` : ''}:` },
                { inlineData: { data: img.base64, mimeType: img.mimeType } }
              ];
            }),
            { text: `Rewrite the prompt to incorporate the adjustment while maintaining the high quality and structure. Use the labeled reference images if the user refers to them (e.g., "img1", "img2"). Also update the tips if necessary. Return the result as JSON.` }
          ]
        }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING },
              tips: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["prompt", "tips"]
          }
        }
      });

      const finalData = JSON.parse(response.text || '{}');
      const newResult: FinalResult = {
        ...finalData,
        id: Math.random().toString(36).substring(7),
        modelId: selectedModel,
        timestamp: Date.now()
      };
      setResult(newResult);
      saveToHistory(newResult);
      setTweakInput('');
      setIsTweaking(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to tweak the prompt.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setStep(1);
    setInitialPrompt('');
    setImageSlots([null]);
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setError(null);
  };

  const loadFromHistory = (item: FinalResult) => {
    setResult(item);
    setSelectedModel(item.modelId);
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-chinese-black text-antique-brass font-sans selection:bg-coffee/30 selection:text-white flex overflow-hidden">
      {/* History Sidebar - Toggleable */}
      <AnimatePresence>
        {isHistoryOpen && (
          <motion.aside 
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-80 bg-dark-jungle border-r border-white/5 flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-antique-brass">
                <History className="w-4 h-4 text-antique-brass/50" />
                <span>History</span>
              </div>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-antique-brass/50" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                  <History className="w-8 h-8 text-white/10" />
                  <p className="text-sm text-antique-brass/40">No prompts yet.</p>
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      loadFromHistory(item);
                      setIsHistoryOpen(false);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all group ${
                      result?.id === item.id 
                        ? 'border-antique-brass bg-antique-brass/10 ring-1 ring-antique-brass' 
                        : 'border-white/5 hover:border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <p className="text-[10px] font-bold text-antique-brass/50 mb-1 uppercase tracking-wider">
                      {new Date(item.timestamp).toLocaleDateString()} • {MODELS.find(m => m.id === item.modelId)?.name}
                    </p>
                    <p className="text-sm text-antique-brass/80 line-clamp-2 leading-relaxed">
                      {item.prompt}
                    </p>
                  </button>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-screen relative">
        <header className="bg-chinese-black/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsHistoryOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-antique-brass/50 hover:text-antique-brass"
                title="View History"
              >
                <History className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="bg-coffee p-1.5 rounded-lg shadow-lg shadow-coffee/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-antique-brass rounded-full animate-pulse" />
                </div>
                <div>
                  <h1 className="font-black text-lg tracking-[0.3em] uppercase text-white leading-none">BANANATOR</h1>
                  <p className="text-[8px] font-bold tracking-[0.4em] text-antique-brass/40 uppercase mt-1">Silent Engine v3.1</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {step > 1 && (
                <button 
                  onClick={reset}
                  className="text-xs font-bold uppercase tracking-widest text-antique-brass/50 hover:text-white transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-16">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-12"
              >
                <div className="space-y-4">
                  <Logo className="scale-125 origin-left mb-4" />
                  <p className="text-antique-brass/60 text-sm font-medium tracking-wide max-w-md">
                    THE ULTIMATE PROMPT ENGINE. PRECISION ENGINEERED FOR THE SILENT KILLER.
                  </p>
                </div>

                <div className="space-y-10">
                  {/* Model & Config Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Model Selection */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-antique-brass/50">
                        Target Model
                      </label>
                      <div className="relative group">
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full bg-dark-jungle border border-white/10 rounded-xl px-4 py-3 text-sm text-antique-brass outline-none focus:border-antique-brass transition-all appearance-none cursor-pointer"
                        >
                          {MODELS.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-antique-brass/50">
                          <ChevronLeft className="w-4 h-4 -rotate-90" />
                        </div>
                      </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-antique-brass/50">
                        Aspect Ratio
                      </label>
                      <div className="relative group">
                        <select
                          value={aspectRatio}
                          onChange={(e) => setAspectRatio(e.target.value)}
                          className="w-full bg-dark-jungle border border-white/10 rounded-xl px-4 py-3 text-sm text-antique-brass outline-none focus:border-antique-brass transition-all appearance-none cursor-pointer"
                        >
                          {ASPECT_RATIOS.map((ratio) => (
                            <option key={ratio} value={ratio}>
                              {ratio}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-antique-brass/50">
                          <ChevronLeft className="w-4 h-4 -rotate-90" />
                        </div>
                      </div>
                    </div>

                    {/* Resolution */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-antique-brass/50">
                        Resolution
                      </label>
                      <div className="relative group">
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          className="w-full bg-dark-jungle border border-white/10 rounded-xl px-4 py-3 text-sm text-antique-brass outline-none focus:border-antique-brass transition-all appearance-none cursor-pointer"
                        >
                          {RESOLUTIONS.map((res) => (
                            <option key={res} value={res}>
                              {res}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-antique-brass/50">
                          <ChevronLeft className="w-4 h-4 -rotate-90" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Initial Prompt */}
                  <div className="space-y-3">
                    <label htmlFor="prompt" className="text-[10px] font-bold uppercase tracking-[0.2em] text-antique-brass/50">
                      Describe it
                    </label>
                    <textarea
                      id="prompt"
                      value={initialPrompt}
                      onChange={(e) => setInitialPrompt(e.target.value)}
                      placeholder="What are we creating?"
                      className="w-full h-40 p-4 rounded-xl border border-white/10 bg-dark-jungle focus:border-antique-brass outline-none transition-all resize-none text-antique-brass placeholder:text-antique-brass/20 text-base font-medium"
                    />
                  </div>

                  {/* Image Slots */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-antique-brass/50">
                      Visual Context
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {imageSlots.map((img, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold text-antique-brass/40 uppercase tracking-widest">img{idx + 1}</div>
                            {imageSlots.length > 1 && (
                              <button 
                                onClick={() => removeSlot(idx)}
                                className="p-1 hover:bg-red-500/10 rounded text-red-500/50 hover:text-red-500 transition-colors"
                                title="Remove slot"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="relative aspect-square rounded-xl border border-white/10 bg-dark-jungle overflow-hidden group">
                            {img ? (
                              <>
                                <img src={img.previewUrl} alt={`img${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <button
                                  onClick={() => removeSlot(idx)}
                                  className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-5 h-5 text-white" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => fileInputRefs.current[idx]?.click()}
                                className="w-full h-full flex flex-col items-center justify-center gap-2 text-antique-brass/30 hover:text-antique-brass/60 hover:bg-white/5 transition-all"
                              >
                                <Upload className="w-5 h-5" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Upload</span>
                              </button>
                            )}
                            <input
                              type="file"
                              ref={el => fileInputRefs.current[idx] = el}
                              onChange={(e) => handleImageUpload(e, idx)}
                              accept="image/*"
                              className="hidden"
                            />
                          </div>
                          {img && (
                            <input
                              type="text"
                              value={img.annotation || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setImageSlots(prev => {
                                  const next = [...prev];
                                  if (next[idx]) {
                                    next[idx] = { ...next[idx]!, annotation: val };
                                  }
                                  return next;
                                });
                              }}
                              placeholder="Describe vision for this image..."
                              className="w-full bg-dark-jungle/50 border border-white/5 rounded-lg px-3 py-2 text-[10px] text-antique-brass/70 outline-none focus:border-antique-brass/30 transition-all"
                            />
                          )}
                        </div>
                      ))}
                      
                      {/* Add Slot Button */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-transparent select-none">Add</div>
                        <button
                          onClick={addImageSlot}
                          className="aspect-square rounded-xl border border-dashed border-white/10 flex items-center justify-center text-antique-brass/30 hover:border-antique-brass hover:text-antique-brass transition-all group"
                        >
                          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-antique-brass/10 transition-colors">
                            <Plus className="w-5 h-5" />
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Rules & Notes */}
                  <div className="space-y-3">
                    <label htmlFor="rules" className="text-[10px] font-bold uppercase tracking-[0.2em] text-antique-brass/50">
                      Rules & Constraints
                    </label>
                    <textarea
                      id="rules"
                      value={rulesAndNotes}
                      onChange={(e) => setRulesAndNotes(e.target.value)}
                      placeholder="e.g., Don't change facial features, keep the background minimal, ensure high contrast..."
                      className="w-full h-24 p-4 rounded-xl border border-white/10 bg-dark-jungle focus:border-antique-brass outline-none transition-all resize-none text-antique-brass placeholder:text-antique-brass/20 text-sm font-medium"
                    />
                  </div>

                  {/* Submit */}
                  <div className="pt-8">
                    <button
                      onClick={generateQuestions}
                      disabled={isLoading || !initialPrompt.trim()}
                      className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-antique-brass text-chinese-black rounded-xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-antique-brass/80 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-xl shadow-antique-brass/5"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-12"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter text-white">
                    CALIBRATION.
                  </h2>
                  <p className="text-antique-brass/60 text-sm font-medium tracking-wide">
                    REFINING THE PARAMETERS.
                  </p>
                </div>

                <div className="space-y-10">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="space-y-4">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-antique-brass/50 flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center text-[8px] text-antique-brass/50">{idx + 1}</span>
                        {q.question}
                      </label>
                      
                      {q.type === 'choice' && q.options ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {q.options.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => handleAnswerChange(q.id, opt)}
                              className={`text-left p-4 rounded-xl border text-sm transition-all ${
                                answers[q.id] === opt
                                  ? 'border-antique-brass bg-antique-brass/10 text-white font-bold'
                                  : 'border-white/5 hover:border-white/10 bg-dark-jungle text-antique-brass/60'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                          <div className="col-span-full">
                            <input
                              type="text"
                              placeholder="Custom input..."
                              value={!q.options.includes(answers[q.id] || '') ? (answers[q.id] || '') : ''}
                              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                              className="w-full p-4 rounded-xl border border-white/5 bg-dark-jungle focus:border-antique-brass outline-none transition-all text-sm text-antique-brass"
                            />
                          </div>
                        </div>
                      ) : (
                        <textarea
                          value={answers[q.id] || ''}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          placeholder="Your answer..."
                          className="w-full h-24 p-4 rounded-xl border border-white/5 bg-dark-jungle focus:border-antique-brass outline-none transition-all resize-none text-antique-brass text-sm"
                        />
                      )}
                    </div>
                  ))}

                  <div className="flex flex-col sm:flex-row gap-4 pt-8">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 px-8 py-4 border border-white/5 text-antique-brass/50 rounded-xl font-bold uppercase tracking-[0.2em] text-xs hover:text-white hover:bg-white/5 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => generateFinalPrompt([])}
                      disabled={isLoading}
                      className="flex-1 px-8 py-4 border border-white/5 text-antique-brass/50 rounded-xl font-bold uppercase tracking-[0.2em] text-xs hover:text-white hover:bg-white/5 transition-all"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => generateFinalPrompt()}
                      disabled={isLoading}
                      className="flex-[2] flex items-center justify-center gap-3 px-8 py-4 bg-antique-brass text-chinese-black rounded-xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-antique-brass/80 disabled:opacity-20 transition-all"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Crafting
                        </>
                      ) : (
                        <>
                          Generate
                          <Sparkles className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && result && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-12"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter text-white">
                    MISSION COMPLETE.
                  </h2>
                  <p className="text-antique-brass/60 text-sm font-medium tracking-wide uppercase">
                    OPTIMIZED FOR {MODELS.find(m => m.id === selectedModel)?.name}.
                  </p>
                </div>

                <div className="space-y-8">
                  <div className="bg-dark-jungle rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-8 relative group">
                      <button
                        onClick={() => copyToClipboard(result.prompt)}
                        className="absolute top-6 right-6 p-2 rounded-lg bg-white/5 text-antique-brass/50 hover:text-antique-brass hover:bg-white/10 transition-all flex items-center gap-2"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span className="text-[10px] font-bold uppercase tracking-widest">{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                      <p className="font-mono text-antique-brass/90 text-sm leading-relaxed whitespace-pre-wrap pr-20 selection:bg-coffee selection:text-white">
                        {result.prompt}
                      </p>
                    </div>
                    
                    <div className="p-8 bg-white/[0.02] border-t border-white/5">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-antique-brass/50 mb-6 flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-antique-brass" />
                        Expert Knowledge
                      </h3>
                      <ul className="space-y-4">
                        {result.tips.map((tip, idx) => (
                          <li key={idx} className="flex items-start gap-4 text-sm text-antique-brass/70">
                            <span className="flex-shrink-0 w-5 h-5 rounded-md bg-white/5 text-antique-brass/40 flex items-center justify-center text-[10px] font-bold mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Tweak Section */}
                    <div className="p-8 bg-white/[0.04] border-t border-white/5">
                      {!isTweaking ? (
                        <button
                          onClick={() => setIsTweaking(true)}
                          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-antique-brass hover:text-antique-brass/80 transition-colors"
                        >
                          <MessageSquare className="w-3 h-3" />
                          REFINE MISSION
                        </button>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-antique-brass/50">Mission Adjustments</h4>
                            <button 
                              onClick={() => setIsTweaking(false)}
                              className="text-[10px] font-bold uppercase tracking-widest text-antique-brass/30 hover:text-antique-brass/50"
                            >
                              Cancel
                            </button>
                          </div>
                          
                          {/* Tweak Image Slots */}
                          <div className="grid grid-cols-3 gap-4">
                            {imageSlots.map((img, idx) => (
                              <div key={idx} className="space-y-2">
                                <div className="relative aspect-square rounded-lg border border-white/5 bg-chinese-black overflow-hidden group">
                                  {img ? (
                                    <>
                                      <img src={img.previewUrl} alt={`img${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      <button
                                        onClick={() => removeSlot(idx)}
                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="w-4 h-4 text-white" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => fileInputRefs.current[idx]?.click()}
                                      className="w-full h-full flex flex-col items-center justify-center gap-1 text-antique-brass/20 hover:text-antique-brass/40 transition-all"
                                    >
                                      <Upload className="w-4 h-4" />
                                      <span className="text-[8px] font-bold uppercase">img{idx + 1}</span>
                                    </button>
                                  )}
                                  <input
                                    type="file"
                                    ref={el => fileInputRefs.current[idx] = el}
                                    onChange={(e) => handleImageUpload(e, idx)}
                                    accept="image/*"
                                    className="hidden"
                                  />
                                </div>
                                {img && (
                                  <input
                                    type="text"
                                    value={img.annotation || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setImageSlots(prev => {
                                        const next = [...prev];
                                        if (next[idx]) {
                                          next[idx] = { ...next[idx]!, annotation: val };
                                        }
                                        return next;
                                      });
                                    }}
                                    placeholder="Annotate..."
                                    className="w-full bg-chinese-black border border-white/5 rounded px-2 py-1 text-[8px] text-antique-brass/50 outline-none focus:border-antique-brass/20"
                                  />
                                )}
                              </div>
                            ))}
                            <button
                              onClick={addImageSlot}
                              className="aspect-square rounded-lg border border-dashed border-white/5 flex items-center justify-center text-antique-brass/20 hover:text-antique-brass/40 transition-all"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={tweakInput}
                              onChange={(e) => setTweakInput(e.target.value)}
                              placeholder="e.g., More cinematic lighting..."
                              className="flex-1 p-4 rounded-xl border border-white/5 bg-chinese-black focus:border-antique-brass outline-none transition-all text-sm text-antique-brass"
                              onKeyDown={(e) => e.key === 'Enter' && handleTweak()}
                            />
                            <button
                              onClick={handleTweak}
                              disabled={isLoading || !tweakInput.trim()}
                              className="px-6 bg-antique-brass text-chinese-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-antique-brass/80 disabled:opacity-20 transition-all flex items-center gap-2"
                            >
                              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              Update
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-center pt-8">
                    <button
                      onClick={reset}
                      className="px-10 py-4 bg-antique-brass text-chinese-black rounded-xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-antique-brass/80 transition-all shadow-xl shadow-antique-brass/5"
                    >
                      New Mission
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
