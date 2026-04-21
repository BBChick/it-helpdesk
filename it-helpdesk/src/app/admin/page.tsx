"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, User, Wifi, Clock, Printer, Activity, PlayCircle,
  Phone, MapPin, Monitor, AlertCircle, Coffee,
  Sun, Moon, ShieldCheck, History, Check, Zap, Layers, Truck, X, Search
} from "lucide-react";

// --- ИНТЕРФЕЙСЫ ---
interface Ticket {
  id: string;
  user: string;
  issue: string;
  ip: string;
  os: string;
  office: string;
  phone: string;
  status: 'pending' | 'processing' | 'completed';
  time: string;
}

const API_URL = 'http://localhost:3001';

const formatOS = (osString: string) => {
  if (!osString) return "Windows";
  return Array.from(new Set(osString.split(' '))).join(' ');
};

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const prevTicketsCount = useRef(0);

  // --- ЛОГИКА ПОЛУЧЕНИЯ ДАННЫХ ---
  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_URL}/get-tickets`);
      if (!res.ok) throw new Error();
      const data: Ticket[] = await res.json();

      // Уведомление о новых заявках
      const pendingCount = data.filter(t => t.status === 'pending').length;
      if (pendingCount > prevTicketsCount.current) {
        new Audio('/notification.mp3').play().catch(() => { });
      }
      prevTicketsCount.current = pendingCount;
      setTickets(data);
    } catch (e) {
      console.warn("Встроенный Rust-сервер еще не запущен");
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchTickets();

    // Опрос локального сервера раз в 2 секунды для мгновенного обновления
    const interval = setInterval(fetchTickets, 2000);
    return () => clearInterval(interval);
  }, []);

  // --- УПРАВЛЕНИЕ СТАТУСОМ ---
  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await fetch(`${API_URL}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      await fetchTickets();
    } catch (e) {
      console.error("Ошибка при обновлении статуса");
    }
  };

  // --- ТЕМА ---
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark');
  };

  // --- ОПТИМИЗИРОВАННАЯ ФИЛЬТРАЦИЯ ---
  const filteredTickets = useMemo(() => {
    const list = activeTab === 'active'
      ? tickets.filter(t => t.status === 'pending' || t.status === 'processing')
      : tickets.filter(t => t.status === 'completed');

    // Новые всегда сверху (для архива и активных)
    return [...list].sort((a, b) => Number(b.id) - Number(a.id));
  }, [tickets, activeTab]);

  const hasProcessing = useMemo(() => tickets.some(t => t.status === 'processing'), [tickets]);

  if (!mounted) return <div className="h-screen w-full bg-[#050506]" />;

  return (
    <div className={`h-screen w-full flex overflow-hidden font-sans transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050506] text-zinc-100' : 'bg-[#f8f9fa] text-zinc-900'}`}>

      {/* SIDEBAR */}
      <aside className={`w-64 border-r p-6 flex flex-col gap-8 shrink-0 transition-colors ${theme === 'dark' ? 'bg-[#09090b] border-white/5' : 'bg-white border-zinc-200'}`}>
        <div className="flex items-center gap-3 text-indigo-500 font-black italic text-xl tracking-tighter select-none">
          <div className="p-2 bg-indigo-500/10 rounded-lg"><Terminal size={20} /></div>
          ZENOPS <span className="text-[10px] not-italic opacity-50 ml-1 tracking-widest uppercase font-bold text-indigo-400">ADM</span>
        </div>

        <nav className="flex-1 space-y-2">
          <TabButton
            active={activeTab === 'active'}
            onClick={() => setActiveTab('active')}
            icon={<Layers size={18} />}
            label="Активные"
            count={tickets.filter(t => t.status !== 'completed').length}
            pulse={tickets.some(t => t.status === 'pending')}
          />
          <TabButton
            active={activeTab === 'completed'}
            onClick={() => setActiveTab('completed')}
            icon={<History size={18} />}
            label="Архив"
            count={tickets.filter(t => t.status === 'completed').length}
          />
        </nav>

        <div className={`p-4 rounded-2xl border transition-all ${hasProcessing ? 'bg-indigo-500/10 border-indigo-500/20' : theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-zinc-100 border-zinc-200'}`}>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
            {hasProcessing ? (
              <><div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" /><span className="text-indigo-500 font-black">Админ в работе</span></>
            ) : (
              <><Zap size={12} className="text-zinc-400" /><span className="text-zinc-400">Локальный узел активен</span></>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className={`h-16 border-b flex items-center justify-between px-8 transition-colors ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/80 border-zinc-200 backdrop-blur-md'}`}>
          <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 font-mono italic">
              {activeTab === 'active' ? 'Live_Stream' : 'Local_Archive_DB'}
            </h2>
          </div>
          <button onClick={toggleTheme} className={`p-2.5 rounded-xl border transition-all hover:scale-105 active:scale-95 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-yellow-400 shadow-lg shadow-yellow-500/5' : 'bg-zinc-100 border-zinc-300 text-indigo-600 shadow-sm'}`}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">
          <AnimatePresence mode="wait">
            {filteredTickets.length > 0 ? (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6"
              >
                {filteredTickets.map((t) => {
                  const isPending = t.status === 'pending';
                  const isProcessing = t.status === 'processing';
                  const isArchive = t.status === 'completed';

                  return (
                    <motion.div key={t.id} layout
                      className={`group p-6 rounded-[32px] border transition-all duration-300 relative 
                        ${theme === 'dark'
                          ? isArchive ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100' : isProcessing ? 'bg-indigo-500/[0.05] border-indigo-500/30 shadow-2xl shadow-indigo-500/10' : 'bg-[#0d0d0f] border-white/5 shadow-2xl shadow-black/40'
                          : isArchive ? 'bg-zinc-50 border-zinc-200 opacity-80 hover:opacity-100 shadow-none' : isProcessing ? 'bg-indigo-50 border-indigo-200 shadow-xl' : 'bg-white border-zinc-200 shadow-md hover:shadow-lg'
                        }`}
                    >
                      {/* КАБИНЕТ */}
                      <div className="absolute top-6 right-6 flex flex-col items-end gap-1.5">
                        <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border transition-all font-black
                          ${isArchive
                            ? 'bg-zinc-200 text-zinc-500 border-zinc-300'
                            : isProcessing ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/30'
                              : theme === 'dark' ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-900 text-white border-zinc-800 shadow-lg'}`}>
                          <MapPin size={14} fill="currentColor" />
                          <span className="text-lg tracking-tighter uppercase font-black">КАБ. {t.office || "—"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-8">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all 
                          ${isArchive ? 'bg-zinc-100 text-zinc-400 border-zinc-200'
                            : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 group-hover:scale-110'}`}>
                          {t.issue.toLowerCase().includes('принтер') ? <Printer size={28} /> : <Activity size={28} />}
                        </div>
                        <div className="flex flex-col">
                          <h3 className={`font-black text-xl uppercase tracking-tighter leading-none max-w-[140px] break-words 
                            ${isArchive ? 'text-zinc-400' : theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>
                            {t.issue}
                          </h3>
                          <span className="text-[10px] opacity-40 font-bold uppercase mt-1 tabular-nums tracking-widest">{t.time}</span>
                        </div>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div className={`rounded-2xl p-4 border space-y-2 transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-zinc-100/50 border-zinc-200'}`}>
                          <DataRow icon={<User size={14} />} label="Юзер" value={t.user} theme={theme} />
                          <DataRow icon={<Phone size={14} />} label="Тел." value={t.phone} color={isArchive ? "text-zinc-400" : "text-indigo-600"} theme={theme} />
                          <DataRow icon={<Monitor size={14} />} label="ОС" value={formatOS(t.os)} theme={theme} />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {isArchive ? (
                          <div className={`w-full py-4 rounded-2xl border flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em]
                            ${theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500/40' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                            <Check size={16} strokeWidth={3} /> Кейс закрыт
                          </div>
                        ) : (
                          <button
                            onClick={() => updateStatus(t.id, isPending ? 'processing' : 'completed')}
                            className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg
                              ${isPending
                                ? theme === 'dark'
                                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10'
                                  : 'bg-zinc-900 hover:bg-black text-white'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'}`}
                          >
                            {isPending ? 'Начать работу' : 'Завершить заявку'}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 select-none"
              >
                <div className={`w-32 h-32 rounded-[40px] flex items-center justify-center mb-8 border-2 border-dashed transition-all
                  ${theme === 'dark' ? 'bg-indigo-500/5 border-white/5 text-indigo-500/20' : 'bg-indigo-50 border-indigo-100 text-indigo-200'}`}>
                  {activeTab === 'completed' ? <History size={64} strokeWidth={1} /> : <Coffee size={64} strokeWidth={1} />}
                </div>
                <h3 className={`text-3xl font-black uppercase tracking-tighter mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>
                  {activeTab === 'completed' ? 'Логи пустые' : 'Тишина в эфире'}
                </h3>
                <p className={`text-sm font-medium max-w-[320px] leading-relaxed transition-colors ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Все заявки обработаны. Самое время для чашки кофе, пока Rust-сервер мониторит сеть.
                </p>
                <div className="mt-10 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Built-in Server Active</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'}; 
          border-radius: 10px; 
        }
      `}</style>
    </div>
  );
}

function DataRow({ icon, label, value, color, theme }: any) {
  const isDark = theme === 'dark';
  const displayValue = value === "Не указан" || !value ? "—" : value;

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-tighter">
        {icon} <span className="opacity-70">{label}</span>
      </div>
      <div className={`${color || (isDark ? 'text-zinc-200' : 'text-zinc-800')} font-black truncate max-w-[160px]`}>
        {displayValue}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count, pulse }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border relative ${active
      ? 'bg-indigo-600 text-white border-indigo-400 shadow-xl shadow-indigo-500/20'
      : 'text-zinc-500 border-transparent hover:bg-white/5'}`}>
      {icon}
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {pulse && !active && <div className="absolute top-3 left-3 w-2 h-2 bg-indigo-500 rounded-full animate-ping" />}
      <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold ${active ? 'bg-white/20' : 'bg-zinc-800 text-zinc-400'}`}>{count}</span>
    </button>
  );
}