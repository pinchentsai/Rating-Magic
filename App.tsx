import React, { useState, useMemo, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Sparkles, Moon, Wand2, Star, AlertCircle, Info, Plus, Trash2, Cpu } from 'lucide-react';

import { Student, Criterion } from './types';
import { DEFAULT_LEVELS } from './constants';
import { 
  generateRubricCriteria, 
  evaluateStudentWork, 
  generateClassAnalysis 
} from './services/geminiService';

interface Template {
  id: string;
  name: string;
  tasks: string[];
  criteria: Criterion[];
  timestamp: number;
}

const MAGIC_QUOTES = [
  "幻之銀水晶正在全力計算月亮力量...",
  "請稍候，正以銀千年之光掃描作業...",
  "代表月亮！正在給予正義的建議...",
  "愛與正義的魔法，正在轉化為成績...",
  "星光閃爍，成績正在凝聚中..."
];

const MoonWandSVG = () => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 wand-spin">
    <defs>
      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style={{ stopColor: '#ff9a9e', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#fad0c4', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect x="45" y="40" width="10" height="60" rx="5" fill="#ff69b4" />
    <path d="M50 10 A 30 30 0 1 0 50 70 A 30 30 0 1 0 50 10 M50 15 A 25 25 0 1 1 50 65 A 25 25 0 1 1 50 15" fill="#ffd700" />
    <circle cx="50" cy="40" r="12" fill="url(#grad1)" stroke="#fff" strokeWidth="2" />
  </svg>
);

const RANK_STYLES = [
  "bg-pink-100 text-pink-600 border-pink-200",
  "bg-blue-100 text-blue-600 border-blue-200",
  "bg-red-100 text-red-600 border-red-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-yellow-100 text-yellow-700 border-yellow-200"
];

const App: React.FC = () => {
  // 核心狀態
  const [tasks, setTasks] = useState<string[]>([""]);
  const [criteria, setCriteria] = useState<Criterion[]>([
    { id: uuidv4(), focus: "", levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)) }
  ]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // 優化功能狀態
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluatingProgress, setEvaluatingProgress] = useState({ current: 0, total: 0 });
  const [currentQuote, setCurrentQuote] = useState(MAGIC_QUOTES[0]);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // 模板與報告狀態
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化與本地儲存
  useEffect(() => {
    const saved = localStorage.getItem('sailor_grading_templates');
    if (saved) try { setTemplates(JSON.parse(saved)); } catch (e) {}
  }, []);

  useEffect(() => {
    localStorage.setItem('sailor_grading_templates', JSON.stringify(templates));
  }, [templates]);

  // 魔法語句輪播
  useEffect(() => {
    let interval: number;
    if (isEvaluating) {
      interval = window.setInterval(() => {
        setCurrentQuote(MAGIC_QUOTES[Math.floor(Math.random() * MAGIC_QUOTES.length)]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isEvaluating]);

  // 計算分數區間
  const totalScoreThresholds = useMemo(() => {
    const rawFloors = [0, 0, 0, 0, 0];
    let maxPossibleScore = 0;
    criteria.forEach(c => {
      maxPossibleScore += c.levels[0].score;
      c.levels.forEach((lvl, lIdx) => {
        const lowerBound = (lIdx < 4) ? (c.levels[lIdx + 1].score + 1) : 0;
        rawFloors[lIdx] += lowerBound;
      });
    });
    return rawFloors.map((floor, i) => {
      const ceiling = (i === 0) ? maxPossibleScore : (rawFloors[i - 1] - 1);
      return { label: DEFAULT_LEVELS[i].label.split(' (')[0], floor, ceiling };
    });
  }, [criteria]);

  const getLevelLabelFromScore = (score: number) => {
    const match = totalScoreThresholds.find(t => score >= t.floor && score <= t.ceiling);
    return match ? match.label : "未判定";
  };

  // 評分邏輯
  const startBatchGrading = async () => {
    const targets = students.filter(s => s.status !== 'done' && s.contents.some(c => c.trim() !== ""));
    if (targets.length === 0) return;

    setIsEvaluating(true);
    setEvaluatingProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const s = targets[i];
      setEvaluatingProgress(prev => ({ ...prev, current: i + 1 }));
      setStudents(prev => prev.map(st => st.id === s.id ? { ...st, status: 'loading' } : st));
      
      try {
        const res = await evaluateStudentWork(s, tasks, criteria);
        const autoDetectedLabel = getLevelLabelFromScore(res.score);
        
        setStudents(prev => prev.map(st => st.id === s.id ? { 
          ...st, status: 'done', score: res.score, levelLabel: autoDetectedLabel, feedback: res.feedback 
        } : st));
        await new Promise(r => setTimeout(r, 4000));
      } catch (e: any) {
        console.error(e);
        setStudents(prev => prev.map(st => st.id === s.id ? { ...st, status: 'error', errorMsg: "能量中斷 (API 頻率限制)" } : st));
        setErrorToast("月亮能量不足（API 頻率限制），評分已暫停。");
      }
    }
    setIsEvaluating(false);
  };

  const chartData = useMemo(() => {
    const dist: Record<string, number> = {};
    students.forEach(s => { 
      if (s.levelLabel) {
        const baseName = s.levelLabel.split(' (')[0];
        dist[baseName] = (dist[baseName] || 0) + 1; 
      }
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [students]);

  return (
    <div className="max-w-[95%] mx-auto p-4 md:p-8 space-y-12 pb-24">
      {/* 魔法動畫遮罩 */}
      {isEvaluating && (
        <div className="fixed inset-0 z-[150] bg-pink-600/60 backdrop-blur-xl flex flex-col items-center justify-center text-white p-6">
          <div className="relative mb-12">
            <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
            <Wand2 size={120} className="relative wand-spin text-yellow-300 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
          </div>
          <h2 className="text-4xl font-black mb-4 tracking-widest drop-shadow-lg text-center">正在召喚月亮力量...</h2>
          <p className="text-xl font-medium mb-12 text-pink-100 h-8 text-center">{currentQuote}</p>
          <div className="w-full max-w-md bg-white/20 h-4 rounded-full overflow-hidden border-2 border-white/30 mb-4">
            <div 
              className="h-full bg-gradient-to-r from-yellow-300 to-pink-300 transition-all duration-500 shadow-[0_0_10px_white]"
              style={{ width: `${(evaluatingProgress.current / evaluatingProgress.total) * 100}%` }}
            ></div>
          </div>
          <p className="font-mono text-2xl font-black">{evaluatingProgress.current} / {evaluatingProgress.total} 位學員</p>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
        <div className="flex items-center gap-4">
          <MoonWandSVG />
          <div>
            <h1 className="text-4xl font-bold text-pink-600 drop-shadow-sm flex items-center gap-2">評分魔法棒 <span className="text-yellow-400 text-2xl sparkle">✨</span></h1>
            <p className="text-purple-600 mt-2 font-medium">♥ 讓評分像魔法一樣精準、快速、充滿愛！ ♥</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-end md:items-center gap-3">
          <select 
            value={selectedTemplateId}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                setTasks([""]);
                setCriteria([{ id: uuidv4(), focus: "", levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)) }]);
                setSelectedTemplateId("");
              } else {
                const t = templates.find(x => x.id === id);
                if (t) {
                  setTasks([...t.tasks]);
                  setCriteria(JSON.parse(JSON.stringify(t.criteria)));
                  setSelectedTemplateId(id);
                }
              }
            }}
            className="bg-white/80 border-2 border-pink-200 text-purple-700 px-4 py-2.5 rounded-xl font-bold shadow-sm outline-none text-sm w-48 focus:border-pink-400 transition-all"
          >
            <option value="">＋ 新的魔法陣</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <div className="flex gap-2">
            <button onClick={() => setShowSaveModal(true)} className="bg-white/80 border-2 border-pink-200 text-pink-500 px-5 py-2.5 rounded-full font-bold shadow-sm hover:bg-pink-50 transition-all text-sm">💾 儲存</button>
            <button onClick={() => setShowTemplateModal(true)} className="bg-gradient-to-r from-pink-400 to-purple-400 text-white px-5 py-2.5 rounded-full font-bold shadow-md hover:scale-105 transition-all text-sm">📖 Mercury的圖書館 ({templates.length})</button>
          </div>
        </div>
      </header>

      {/* Step 1: 題目 */}
      <section className="glass-panel p-8 rounded-[2rem]">
        <div className="flex items-center gap-3 mb-8 border-b-2 border-pink-100 pb-4">
          <span className="bg-pink-100 p-2 rounded-full text-2xl">🌙</span>
          <h2 className="text-2xl font-bold text-purple-800">Step 1. 召喚題目魔法陣</h2>
        </div>
        <div className="space-y-4">
          {tasks.map((task, idx) => (
            <div key={idx} className="flex gap-3 group animate-in fade-in slide-in-from-left duration-300">
              <div className="bg-pink-100 text-pink-600 w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-inner flex-shrink-0">
                {idx + 1}
              </div>
              <input 
                value={task}
                onChange={(e) => { const n = [...tasks]; n[idx] = e.target.value; setTasks(n); }}
                className="flex-1 bg-white/50 border-2 border-pink-50 rounded-2xl px-6 py-3 text-purple-800 font-medium focus:border-pink-300 outline-none transition-all placeholder:text-pink-200"
                placeholder=""
              />
              {tasks.length > 1 && (
                <button onClick={() => setTasks(tasks.filter((_, i) => i !== idx))} className="text-pink-200 hover:text-red-400 transition-colors p-2">
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => setTasks([...tasks, ""])} className="w-full border-2 border-dashed border-pink-200 text-pink-400 py-4 rounded-2xl font-bold hover:bg-pink-50 transition-all flex items-center justify-center gap-2">
            <Plus size={20} /> 新增一個魔法陣
          </button>
        </div>
      </section>

      {/* Step 2: 評量向度 (調整佈局與字體) */}
      <section className="glass-panel p-8 rounded-[2rem]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b-2 border-pink-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="bg-purple-100 p-2 rounded-full text-2xl">⭐</span>
            <h2 className="text-2xl font-bold text-purple-800">Step 2. 設定評量魔杖</h2>
          </div>
          <div className="bg-purple-50 px-4 py-2 rounded-2xl border border-purple-100">
             <p className="text-[10px] text-purple-400 font-bold mb-1">總分區間參考：</p>
             <div className="flex gap-3">
               {totalScoreThresholds.map((t, i) => (
                 <div key={i} className="text-[11px] font-black text-purple-700">{t.label}: {t.floor}~{t.ceiling}</div>
               ))}
             </div>
          </div>
        </div>

        <div className="space-y-12">
          {criteria.map((criterion, cIdx) => (
            <div key={criterion.id} className="bg-white/40 border-2 border-white rounded-[2.5rem] p-8 shadow-sm relative group">
              <button onClick={() => setCriteria(criteria.filter(c => c.id !== criterion.id))} className="absolute -top-3 -right-3 bg-white text-pink-300 hover:text-red-500 w-10 h-10 rounded-full shadow-md flex items-center justify-center border-2 border-pink-50 transition-all opacity-0 group-hover:opacity-100">
                <Trash2 size={18} />
              </button>

              <div className="flex flex-col gap-8">
                {/* 頂部區塊：向度名稱與召喚 AI 按鈕 (字體調大) */}
                <div className="flex flex-col md:flex-row gap-6 items-end border-b-2 border-purple-50 pb-6">
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-base font-black text-purple-600 flex items-center gap-2">
                      <Info size={16} /> 評量目標
                    </label>
                    <input 
                      value={criterion.focus}
                      onChange={(e) => { const n = [...criteria]; n[cIdx].focus = e.target.value; setCriteria(n); }}
                      className="w-full bg-white border-2 border-purple-50 rounded-2xl px-6 py-4 text-xl text-purple-900 font-black focus:border-purple-300 outline-none shadow-sm placeholder:text-purple-100"
                      placeholder="例如：內容完整度、邏輯思考..."
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      const res = await generateRubricCriteria(criterion.focus, tasks);
                      const n = [...criteria];
                      res.forEach((text, i) => { if (n[cIdx].levels[i]) n[cIdx].levels[i].criteria = text; });
                      setCriteria(n);
                    }}
                    className="w-full md:w-auto bg-purple-100 text-purple-700 px-8 py-4 rounded-2xl font-black text-base hover:bg-purple-200 transition-all flex items-center justify-center gap-2 border-2 border-purple-50 shadow-sm"
                  >
                    <Cpu size={20} /> 使用幻之銀水晶自動生成標準
                  </button>
                </div>

                {/* 底部區塊：五個等級網格 (字體調大) */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  {criterion.levels.map((level, lIdx) => (
                    <div key={lIdx} className="space-y-3">
                      <div className={`text-center py-2.5 px-2 rounded-xl text-sm font-black border-2 ${RANK_STYLES[lIdx]} shadow-sm`}>
                        {level.label.split(' (')[0]}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-purple-400 font-bold ml-1 uppercase tracking-wider">配分</label>
                        <input 
                          type="number" 
                          value={level.score}
                          onChange={(e) => { const n = [...criteria]; n[cIdx].levels[lIdx].score = parseInt(e.target.value); setCriteria(n); }}
                          className="w-full text-center bg-white border border-purple-100 rounded-lg py-1.5 text-sm font-black text-purple-700 focus:border-purple-300 outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-purple-400 font-bold ml-1 uppercase tracking-wider">描述標準</label>
                        <textarea 
                          value={level.criteria}
                          onChange={(e) => { const n = [...criteria]; n[cIdx].levels[lIdx].criteria = e.target.value; setCriteria(n); }}
                          className="w-full bg-white border border-purple-100 rounded-xl p-3 text-sm text-purple-800 font-medium leading-relaxed min-h-[160px] focus:border-purple-300 outline-none placeholder:text-purple-50 transition-all shadow-inner"
                          placeholder="具體標準描述..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => setCriteria([...criteria, { id: uuidv4(), focus: "", levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)) }])} className="w-full border-2 border-dashed border-purple-200 text-purple-400 py-6 rounded-3xl font-black text-lg hover:bg-purple-50 transition-all flex items-center justify-center gap-2 group">
            <Plus className="group-hover:rotate-90 transition-transform" /> 新增一個魔杖
          </button>
        </div>
      </section>

      {/* Step 3: 學生表 */}
      <section className="glass-panel p-8 rounded-[2rem]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b-2 border-pink-100 pb-6">
          <div className="flex items-center gap-3">
            <span className="bg-indigo-100 p-2 rounded-full text-2xl">🏰</span>
            <h2 className="text-2xl font-bold text-purple-800">Step 3. 銀千年魔法紀錄書</h2>
          </div>
          <div className="flex gap-3">
            <input type="file" accept=".csv" ref={fileInputRef} onChange={e => {
              const file = e.target.files?.[0]; if(!file) return;
              const r = new FileReader(); r.onload = (ev) => {
                const text = ev.target?.result as string;
                const rows = text.split('\n').map(x => x.split(',')).slice(1);
                setStudents(rows.map(r => ({ id: uuidv4(), name: r[0], contents: tasks.map((_, i) => r[i+1]||""), feedback: "", score: null, levelLabel: "", status: 'idle' })));
              }; r.readAsText(file);
            }} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="bg-white text-pink-600 border-2 border-pink-200 px-6 py-2 rounded-full font-bold">📥 召喚水手戰士</button>
            <button onClick={() => setStudents([...students, { id: uuidv4(), name: `學生 ${students.length + 1}`, contents: new Array(tasks.length).fill(""), feedback: "", score: null, levelLabel: "", status: 'idle' }])} className="bg-pink-400 text-white px-6 py-2 rounded-full font-bold">➕ 新增</button>
          </div>
        </div>
        
        <div className="overflow-x-auto border-2 border-pink-100 rounded-3xl bg-white/60 custom-scrollbar max-h-[600px]">
          <table className="w-full text-sm text-left min-w-[1200px]">
            <thead className="bg-pink-50 sticky top-0 z-10 text-purple-700 font-bold border-b border-pink-200">
              <tr>
                <th className="p-5">戰士姓名</th>
                {tasks.map((_, i) => <th key={i} className="p-5">答題 {i+1}</th>)}
                <th className="p-5 text-center">總分</th>
                <th className="p-5">等級</th>
                <th className="p-5">女王回應</th>
                <th className="p-5">狀態</th>
                <th className="p-5">移除</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-50">
              {students.map((s, sIdx) => (
                <tr key={s.id} className="hover:bg-white/80 transition-all">
                  <td className="p-4 font-black text-purple-800">
                    <input value={s.name} onChange={e => setStudents(students.map(x => x.id === s.id ? {...x, name: e.target.value} : x))} className="bg-transparent border-b border-pink-100 outline-none w-24" />
                  </td>
                  {tasks.map((_, tIdx) => (
                    <td key={tIdx} className="p-4">
                      <textarea 
                        value={s.contents[tIdx]} 
                        onChange={e => {const n=[...students]; n[sIdx].contents[tIdx]=e.target.value; setStudents(n);}} 
                        className="w-full p-3 rounded-xl border border-pink-100 bg-white/50 text-xs min-h-[100px] min-w-[200px]" 
                      />
                    </td>
                  ))}
                  <td className="p-4 text-center text-2xl font-black text-pink-500">{s.score ?? '--'}</td>
                  <td className="p-4">
                    {s.levelLabel && (
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border ${RANK_STYLES[DEFAULT_LEVELS.findIndex(l => l.label.startsWith(s.levelLabel)) || 0]}`}>
                        {s.levelLabel}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="text-[10px] max-w-xs overflow-y-auto max-h-24 whitespace-pre-wrap leading-relaxed">
                      {s.feedback}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {s.status === 'loading' ? <div className="loading-ring"></div> : 
                     s.status === 'done' ? "✅" : 
                     s.status === 'error' ? <span title={s.errorMsg}><AlertCircle className="text-red-400" /></span> : "🌙"}
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => setStudents(students.filter(x => x.id !== s.id))} className="text-pink-200 hover:text-red-500 text-xl">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* 控制按鈕 */}
        <div className="mt-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <button onClick={async () => {
            setIsEvaluating(true); setEvaluatingProgress({current:0, total: 1});
            const res = await generateClassAnalysis(students);
            setReport(res); setShowReport(true); setIsEvaluating(false);
          }} className="bg-purple-100 text-purple-700 px-8 py-3 rounded-full font-bold shadow-sm hover:bg-purple-200 flex items-center gap-2">
            🔮 水手戰士戰力分析
          </button>
          
          <div className="flex gap-4">
            <button onClick={() => {
              const h = ["姓名", ...tasks.map((_,i)=>`題${i+1}`), "得分", "等級", "評語"].join(',');
              const b = students.map(s => [s.name, ...s.contents.map(c=>`"${c.replace(/"/g,'""')}"`), s.score, s.levelLabel, `"${s.feedback.replace(/"/g,'""')}"`].join(',')).join('\n');
              const bl = new Blob(["\ufeff"+h+'\n'+b], {type:'text/csv'});
              const u = URL.createObjectURL(bl); const a = document.createElement('a');
              a.href=u; a.download='成績表.csv'; a.click();
            }} className="px-8 py-3 border-2 border-pink-200 rounded-full font-bold text-pink-600 bg-white shadow-sm hover:bg-pink-50 transition-all">
              📤 匯出 卷軸
            </button>
            <button 
              onClick={startBatchGrading} 
              disabled={isEvaluating}
              className="bg-gradient-to-r from-pink-500 to-indigo-500 text-white px-12 py-4 rounded-full font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              🌙 代替月亮來評分！
            </button>
          </div>
        </div>
      </section>

      {/* 儲存 Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[200] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[3rem] w-full max-w-sm border-4 border-pink-100 shadow-2xl">
            <h3 className="text-xl font-black text-pink-600 mb-6">儲存魔法陣</h3>
            <input value={saveNameInput} onChange={e=>setSaveNameInput(e.target.value)} className="w-full p-4 rounded-2xl border-2 border-pink-50 mb-8 font-bold outline-none focus:border-pink-300" placeholder="輸入名稱..." />
            <div className="flex gap-4">
              <button onClick={()=>setShowSaveModal(false)} className="flex-1 py-3 bg-gray-50 rounded-2xl font-bold text-gray-400">取消</button>
              <button onClick={()=>{
                const n = { id:uuidv4(), name:saveNameInput, tasks, criteria, timestamp:Date.now() };
                const updated = [n, ...templates];
                setTemplates(updated); setShowSaveModal(false); setSaveNameInput(""); setSelectedTemplateId(n.id);
              }} className="flex-1 py-3 bg-pink-500 text-white rounded-2xl font-bold shadow-lg shadow-pink-100">確認</button>
            </div>
          </div>
        </div>
      )}

      {/* 分析報告 Modal */}
      {showReport && (
        <div className="fixed inset-0 z-[160] bg-purple-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border-4 border-white">
            <div className="p-8 bg-gradient-to-r from-pink-50 to-indigo-50 border-b flex justify-between items-center">
              <h3 className="text-2xl font-black text-purple-800">🔮 全班魔法數據分析</h3>
              <button onClick={()=>setShowReport(false)} className="text-3xl text-purple-300 hover:text-purple-600 transition-colors">×</button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="h-64 mb-12">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" fontSize={12} stroke="#a78bfa" />
                    <YAxis hide />
                    <Tooltip cursor={{fill: '#fdf2f8'}} contentStyle={{borderRadius:'16px', border:'none', boxShadow:'0 10px 20px rgba(0,0,0,0.05)'}} />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {chartData.map((e, i) => <Cell key={i} fill={i % 2 === 0 ? '#ff9a9e' : '#a78bfa'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <article className="prose prose-pink max-w-none text-purple-900 font-medium">
                <ReactMarkdown>{report || ""}</ReactMarkdown>
              </article>
            </div>
          </div>
        </div>
      )}

      {/* 圖書館 Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[160] bg-pink-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-8 bg-pink-50 border-b flex justify-between items-center">
              <h3 className="text-2xl font-black text-pink-600">📖 魔法圖書館</h3>
              <button onClick={()=>setShowTemplateModal(false)} className="text-3xl text-pink-200 hover:text-pink-500">×</button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {templates.length === 0 ? (
                <div className="text-center py-12 text-pink-200 font-bold italic">目前還沒有收藏的魔法陣...</div>
              ) : (
                templates.map(t => (
                  <div key={t.id} className="bg-pink-50/50 p-6 rounded-3xl flex justify-between items-center border-2 border-transparent hover:border-pink-200 transition-all group">
                    <div>
                      <h4 className="font-black text-purple-700 text-lg">{t.name}</h4>
                      <p className="text-[10px] text-pink-300 font-bold mt-1">
                        {new Date(t.timestamp).toLocaleString()} • {t.tasks.length} 個題目 • {t.criteria.length} 個向度
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setTasks([...t.tasks]);
                          setCriteria(JSON.parse(JSON.stringify(t.criteria)));
                          setShowTemplateModal(false);
                          setSelectedTemplateId(t.id);
                        }}
                        className="bg-white text-pink-500 px-4 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-pink-500 hover:text-white transition-all"
                      >
                        讀取
                      </button>
                      <button 
                        onClick={() => {
                          const updated = templates.filter(x => x.id !== t.id);
                          setTemplates(updated);
                          if (selectedTemplateId === t.id) setSelectedTemplateId("");
                        }}
                        className="bg-red-50 text-red-300 px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-12 text-purple-300 font-medium italic">
        <p>&copy; Sailor Moon Grading Wand. 每位學生都是閃耀的星光。🌙</p>
      </footer>
    </div>
  );
};

export default App;