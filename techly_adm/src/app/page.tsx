"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
  Terminal, User, Printer, Activity,
  Phone, MapPin, Monitor, Coffee,
  Sun, Moon, History, Check, Zap, Layers, Loader2, Search, Calendar,
  X, Minus, Maximize
} from "lucide-react";

interface Ticket {
  id: string;
  user: string;
  issue: string;
  ip: string;
  os: string;
  office: string;
  phone: string;
  status: 'pending' | 'accepted' | 'resolved' | string;
  time: string;
  date?: string;
}

interface GroupedTicket extends Ticket {
  items: Ticket[];
}

const API_URL = 'http://localhost:3001';

const formatOS = (osString: string) => {
  if (!osString) return "Windows";
  return Array.from(new Set(osString.split(' '))).join(' ');
};

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const prevTicketsCount = useRef(0);

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_URL}/get-tickets?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) throw new Error();
      const data: Ticket[] = await res.json();

      const pendingCount = data.filter(t => t.status === 'pending').length;
      if (pendingCount > prevTicketsCount.current) {
        new Audio('/notification.mp3').play().catch(() => { });
      }
      prevTicketsCount.current = pendingCount;
      setTickets(data);
    } catch (e) {
      // Игнорируем в консоли, чтобы не мусорить при отключенном сервере
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchTickets();

    // ОПТИМИЗАЦИЯ CPU:
    // Интервал увеличен до 3 секунд + проверяем, видит ли юзер админку.
    // Если окно свернуто в трей или перекрыто (document.hidden) - вообще ничего не делаем.
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchTickets();
      }
    }, 3000);

    // Дополнительно: мгновенно обновляем тикеты, как только окно развернули
    const handleFocus = () => fetchTickets();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', () => !document.hidden && fetchTickets());

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const updateGroupStatus = async (groupId: string, items: Ticket[], currentGroupStatus: string) => {
    try {
      setUpdatingIds(prev => new Set(prev).add(groupId));

      const newStatus = currentGroupStatus === 'pending' ? 'accepted' : 'resolved';
      const toUpdate = items.filter(t => t.status !== newStatus);

      for (const t of toUpdate) {
        await fetch(`${API_URL}/update-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: t.id, status: newStatus })
        });
      }

      await fetchTickets();
    } catch (e) {
      console.error("Ошибка обновления:", e);
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark');
  };

  const activeGroups = useMemo(() => {
    const pendingAndAccepted = tickets.filter(t => t.status !== 'resolved');
    const groups = new Map<string, Ticket[]>();

    pendingAndAccepted.forEach(t => {
      const key = `${t.user}-${t.ip}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    });

    return Array.from(groups.values()).map(items => {
      items.sort((a, b) => Number(b.id) - Number(a.id));
      const isPending = items.some(t => t.status === 'pending');
      const status = isPending ? 'pending' : 'accepted';
      return { ...items[0], status, items } as GroupedTicket;
    }).sort((a, b) => Number(b.id) - Number(a.id));
  }, [tickets]);

  const archiveGroups = useMemo(() => {
    const resolved = tickets.filter(t => t.status === 'resolved');
    return resolved.map(t => ({
      ...t,
      status: 'resolved',
      items: [t]
    } as GroupedTicket)).sort((a, b) => Number(b.id) - Number(a.id));
  }, [tickets]);

  const filteredArchiveGroups = useMemo(() => {
    let result = archiveGroups;
    if (searchDate) {
      const [year, month, day] = searchDate.split('-');
      const formattedSearchDate = `${day}.${month}.${year}`;
      result = result.filter(g => g.date === formattedSearchDate);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(g =>
        g.user.toLowerCase().includes(q) ||
        g.issue.toLowerCase().includes(q) ||
        (g.office && g.office.toLowerCase().includes(q)) ||
        (g.phone && g.phone.toLowerCase().includes(q))
      );
    }
    return result;
  }, [archiveGroups, searchQuery, searchDate]);

  const displayedGroups = activeTab === 'active' ? activeGroups : filteredArchiveGroups;
  const hasProcessing = useMemo(() => tickets.some(t => t.status !== 'pending' && t.status !== 'resolved'), [tickets]);

  if (!mounted) return <div className="h-screen w-full bg-transparent" />;

  return (
    <div className={`h-screen w-full bg-transparent p-8 font-sans overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}>

      <div className={`h-full w-full rounded-[24px] border overflow-x-auto overflow-y-hidden flex relative transition-colors duration-500 custom-scrollbar 
        ${theme === 'dark' ? 'bg-[#050506] border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.6)]' : 'bg-[#f8f9fa] border-black/10 shadow-[0_15px_35px_rgba(0,0,0,0.15)]'}`}>

        <div className="flex h-full w-full min-w-[1024px]">

          <aside className={`w-64 border-r flex flex-col shrink-0 transition-colors ${theme === 'dark' ? 'bg-[#09090b] border-white/5' : 'bg-white border-zinc-200'}`}>
            <div data-tauri-drag-region className="p-6 cursor-move flex items-center gap-3 text-indigo-500 font-black italic text-xl tracking-tighter select-none">
              <div className="p-2 bg-indigo-500/10 rounded-lg pointer-events-none"><Terminal size={20} /></div>
              <span className="pointer-events-none">TECHLY</span>
              <span className="text-[10px] not-italic opacity-50 ml-1 tracking-widest uppercase font-bold text-indigo-400 pointer-events-none">ADM</span>
            </div>

            <div className="flex-1 flex flex-col px-6 pb-6 pt-2">
              <nav className="flex-1 space-y-2">
                <TabButton
                  active={activeTab === 'active'}
                  onClick={() => { setActiveTab('active'); setSearchQuery(''); setSearchDate(''); }}
                  icon={<Layers size={18} />}
                  label="Активные"
                  count={activeGroups.length}
                  pulse={tickets.some(t => t.status === 'pending')}
                />
                <TabButton
                  active={activeTab === 'archive'}
                  onClick={() => { setActiveTab('archive'); setSearchQuery(''); setSearchDate(''); }}
                  icon={<History size={18} />}
                  label="Архив"
                  count={archiveGroups.length}
                />
              </nav>

              <div className={`mt-auto p-4 rounded-2xl border transition-all ${hasProcessing ? 'bg-indigo-500/10 border-indigo-500/20' : theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-zinc-100 border-zinc-200'}`}>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                  {hasProcessing ? (
                    <><div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" /><span className="text-indigo-500 font-black">Кто-то в пути</span></>
                  ) : (
                    <><Zap size={12} className="text-zinc-400" /><span className="text-zinc-400">Ожидание заявок</span></>
                  )}
                </div>
              </div>
            </div>
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden bg-inherit">
            <header data-tauri-drag-region className={`h-16 border-b flex items-center justify-between px-8 cursor-move transition-colors shrink-0 ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/80 border-zinc-200 backdrop-blur-md'}`}>

              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 font-mono italic whitespace-nowrap pointer-events-none select-none">
                {activeTab === 'active' ? 'Поломалось что-то' : 'Починили что-то'}
              </h2>

              <div className="flex items-center gap-3 z-20 cursor-default ml-auto">
                <AnimatePresence>
                  {activeTab === 'archive' && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-3 mr-4 overflow-hidden"
                    >
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 z-10" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Хвоя, кабинеты..."
                          className={`w-[200px] pl-9 pr-4 py-2 rounded-xl text-xs font-bold transition-all outline-none border focus:ring-2 
                            ${theme === 'dark' ? 'bg-white/5 border-white/10 focus:border-indigo-500 focus:ring-indigo-500/20 text-white placeholder:text-zinc-600' : 'bg-zinc-100 border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500/20 text-zinc-900 placeholder:text-zinc-400'}`}
                        />
                      </div>

                      <div className="relative">
                        <input
                          type="date"
                          value={searchDate}
                          onChange={e => setSearchDate(e.target.value)}
                          style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
                          className={`h-[34px] px-3 py-2 rounded-xl text-xs font-bold transition-all outline-none border focus:ring-2
                            ${theme === 'dark' ? 'bg-white/5 border-white/10 focus:border-indigo-500 focus:ring-indigo-500/20 text-zinc-300' : 'bg-zinc-100 border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500/20 text-zinc-700'}`}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-1.5 p-1 rounded-2xl border transition-colors bg-black/5 dark:bg-white/5 dark:border-white/10">
                  <button onClick={toggleTheme} className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95 ${theme === 'dark' ? 'text-yellow-400 hover:bg-white/10' : 'text-indigo-600 hover:bg-black/5'}`}>
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  </button>
                  <div className="w-[1px] h-4 bg-black/10 dark:bg-white/10 mx-1 border-none" />

                  <button onClick={() => invoke('minimize_window').catch(console.error)} className={`p-1.5 rounded-lg transition-colors hover:text-white ${theme === 'dark' ? 'text-zinc-400 hover:bg-white/10' : 'text-zinc-500 hover:bg-black/10 hover:text-black'}`}>
                    <Minus size={14} />
                  </button>

                  <button onClick={() => invoke('toggle_maximize').catch(console.error)} className={`p-1.5 rounded-lg transition-colors hover:text-white ${theme === 'dark' ? 'text-zinc-400 hover:bg-white/10' : 'text-zinc-500 hover:bg-black/10 hover:text-black'}`}>
                    <Maximize size={14} />
                  </button>

                  <button onClick={() => invoke('close_window').catch(console.error)} className={`p-1.5 rounded-lg transition-colors text-zinc-400 hover:text-rose-500 ${theme === 'dark' ? 'hover:bg-rose-500/20' : 'hover:bg-rose-500/10'}`}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">
              <AnimatePresence mode="wait">
                {displayedGroups.length > 0 ? (
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6"
                  >
                    {displayedGroups.map((group) => {
                      const isPending = group.status === 'pending';
                      const isArchive = group.status === 'resolved';
                      const isProcessing = group.status === 'accepted';
                      const isStaked = group.items.length > 1;
                      const isUpdating = updatingIds.has(group.id);

                      return (
                        <motion.div key={group.id} layout
                          className={`group p-6 rounded-[32px] border transition-all duration-300 relative 
                            ${theme === 'dark'
                              ? isArchive ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100' : isProcessing ? 'bg-indigo-500/[0.05] border-indigo-500/30 shadow-2xl shadow-indigo-500/10' : 'bg-[#0d0d0f] border-white/5 shadow-2xl shadow-black/40'
                              : isArchive ? 'bg-zinc-50 border-zinc-200 opacity-80 hover:opacity-100 shadow-none' : isProcessing ? 'bg-indigo-50 border-indigo-200 shadow-xl' : 'bg-white border-zinc-200 shadow-md hover:shadow-lg'
                            }`}
                        >
                          <div className="absolute top-6 right-6 flex flex-col items-end gap-1.5">
                            <div className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 border transition-all font-black
                              ${isArchive
                                ? 'bg-zinc-200 text-zinc-500 border-zinc-300'
                                : isProcessing ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/30'
                                  : theme === 'dark' ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-zinc-900 text-zinc-200 border-zinc-800 shadow-sm'}`}>
                              <MapPin size={12} fill="currentColor" />
                              <span className="text-[10px] tracking-widest uppercase font-black">
                                {group.office?.toLowerCase() === 'не указан' ? 'Нет каб.' : `КАБ. ${group.office || "—"}`}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-4 mb-6 pt-1">
                            <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center border transition-all 
                              ${isArchive ? 'bg-zinc-100 text-zinc-400 border-zinc-200'
                                : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 group-hover:scale-110'}`}>
                              {isStaked ? <Layers size={28} /> : (group.items[0].issue.toLowerCase().includes('принтер') ? <Printer size={28} /> : <Activity size={28} />)}
                            </div>

                            <div className="flex flex-col flex-1 pb-2 truncate pr-16">
                              <div className="flex flex-col gap-2.5 mb-2">
                                {group.items.map(item => (
                                  <div key={item.id} className="flex items-start gap-2.5">
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${isArchive ? 'bg-zinc-400' : 'bg-indigo-500'}`} />
                                    <div className="flex flex-col truncate">
                                      <span className={`font-black uppercase tracking-tighter leading-none text-[15px] truncate ${isArchive ? 'text-zinc-400' : theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>
                                        {item.issue}
                                      </span>
                                      <span className="text-[9px] opacity-50 font-bold uppercase mt-1 tabular-nums tracking-widest text-indigo-500">
                                        {item.time}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="text-[10px] opacity-40 font-bold uppercase mt-2 pt-3 border-t border-black/10 dark:border-white/10 tabular-nums tracking-widest text-indigo-400">
                                {group.date ? `ДАТА: ${group.date}` : 'РАНЕЕ'}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 mb-6">
                            <div className={`rounded-2xl p-4 border space-y-2 transition-colors ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-zinc-100/50 border-zinc-200'}`}>
                              <DataRow icon={<User size={14} />} label="Юзер" value={group.user} theme={theme} />
                              <DataRow icon={<Phone size={14} />} label="Тел." value={group.phone} color={isArchive ? "text-zinc-400" : "text-indigo-600"} theme={theme} />
                              <DataRow icon={<Monitor size={14} />} label="ОС" value={formatOS(group.os)} theme={theme} />
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
                                onClick={() => updateGroupStatus(group.id, group.items, group.status)}
                                disabled={isUpdating}
                                className={`flex-1 flex justify-center items-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg
                                  ${isUpdating ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}
                                  ${isPending
                                    ? theme === 'dark'
                                      ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10'
                                      : 'bg-zinc-900 hover:bg-black text-white'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'}`}
                              >
                                {isUpdating ? <Loader2 size={16} className="animate-spin" /> : (
                                  <>
                                    {isPending ? (isStaked ? 'Взять все в работу' : 'Начать работу') : (isStaked ? 'Завершить все' : 'Завершить заявку')}
                                    {isStaked && <span className="bg-white/20 px-2 py-0.5 rounded-lg ml-1 font-mono">{group.items.length}</span>}
                                  </>
                                )}
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
                      {activeTab === 'archive' ? <History size={64} strokeWidth={1} /> : <Coffee size={64} strokeWidth={1} />}
                    </div>
                    <h3 className={`text-3xl font-black uppercase tracking-tighter mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-800'}`}>
                      {activeTab === 'archive' ? (searchQuery || searchDate ? 'Ничего не найдено' : 'Логи пустые') : 'Тишина в эфире'}
                    </h3>
                    <p className={`text-sm font-medium max-w-[320px] leading-relaxed transition-colors ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {searchQuery || searchDate ? 'Измени критерии поиска' : 'Принтеры бумагу не жуют, мониторы включены, мышки работают. Самое время для чашки кофе !'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>

      <style jsx global>{`
        html, body, #__next, [data-reactroot] {
          background: transparent !important;
          background-color: transparent !important;
          margin: 0;
          padding: 0;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'}; border-radius: 10px; }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; transition: 0.2s; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
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
      <div className={`${color || (isDark ? 'text-zinc-200' : 'text-zinc-800')} font-black truncate max-w-[160px]`}>{displayValue}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count, pulse }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border relative ${active ? 'bg-indigo-600 text-white border-indigo-400 shadow-xl shadow-indigo-500/20' : 'text-zinc-500 border-transparent hover:bg-white/5'}`}>
      {icon}
      <span className="text-[10px] font-black uppercase tracking-[0.1em]">{label}</span>
      {pulse && !active && <div className="absolute top-3 left-3 w-2 h-2 bg-indigo-500 rounded-full animate-ping" />}
      <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold ${active ? 'bg-white/20' : 'bg-zinc-800 text-zinc-400'}`}>{count}</span>
    </button>
  );
}