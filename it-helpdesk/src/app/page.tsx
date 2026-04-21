"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { io, Socket } from 'socket.io-client';
import {
  WifiOff, Printer, MonitorX, MousePointer2,
  X, Minus, ShieldAlert,
  CheckCircle2, Lock, Mail, Tv, Truck, Clock, Monitor, Sun, Moon
} from "lucide-react";

interface SystemInfo {
  username: string; hostname: string; ip: string; os: string; devices: string[];
}

type NotifyType = 'sent' | 'processing' | 'success' | 'error';

interface NotificationConfig {
  id: string;
  msg: string;
  type: NotifyType;
}

const PROBLEMS = [
  { id: 'net', label: 'Нет интернета', icon: WifiOff, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  { id: 'print', label: 'Принтер / Сканер', icon: Printer, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  { id: 'soft', label: 'Программа зависла', icon: MonitorX, color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)' },
  { id: 'periph', label: 'Мышь / Клавиатура', icon: MousePointer2, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)' },
  { id: 'monitor', label: 'Проблема с монитором', icon: Tv, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
  { id: 'pass', label: 'Забыл пароль', icon: Lock, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  { id: 'mail', label: 'Ошибка почты', icon: Mail, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
];

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [adminUrl, setAdminUrl] = useState<string | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo>({ username: 'Загрузка...', hostname: '', ip: '', os: '', devices: [] });
  const [office, setOffice] = useState('');
  const [phone, setPhone] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [socketConnected, setSocketConnected] = useState(false);

  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);

  const socketRef = useRef<Socket | null>(null);

  const activeTicketsRef = useRef<Set<string>>(
    new Set(typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('zenops_active_tickets') || '[]') : [])
  );

  const lastAcceptedTime = useRef<number>(0);
  const lastResolvedTime = useRef<number>(0);

  // Оптимизация сети: уменьшаем частоту поиска, если админа в сети нет
  const discoveryAttemptsRef = useRef<number>(0);

  const saveTickets = (newSet: Set<string>) => {
    activeTicketsRef.current = newSet;
    localStorage.setItem('zenops_active_tickets', JSON.stringify([...newSet]));
  };

  const showNotify = (msg: string, type: NotifyType = 'sent', duration: number = 2000) => {
    const uniqueId = `notif_${Date.now()}_${Math.random()}`;
    setNotifications(prev => [...prev, { id: uniqueId, msg, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== uniqueId));
    }, duration);
  };

  const closeNotify = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const updateInfo = useCallback(async () => {
    try {
      const info = await invoke<SystemInfo>('get_system_info');
      setSysInfo(info);
    } catch (e) {
      console.warn("System info warn"); // Заменили error на warn, чтобы не спамить в консоль
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    updateInfo();

    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');

    let isDiscovering = true;
    let timerId: NodeJS.Timeout;

    const initConnection = async () => {
      if (!isDiscovering) return;

      // ОПТИМИЗАЦИЯ CPU: Динамический таймер поиска
      discoveryAttemptsRef.current += 1;
      let nextTimeoutDelay = 3000; // База 3 секунды

      if (document.hidden) {
        nextTimeoutDelay = 60000; // Если свернуто - ищем раз в минуту! (Срез 95% CPU)
      } else if (discoveryAttemptsRef.current > 10) {
        nextTimeoutDelay = 15000; // Если не нашли за полминуты - ищем раз в 15с
      }

      try {
        const ip = await invoke<string>('discover_server');

        if (ip !== "not_found" && ip !== "error") {
          const url = `http://${ip}:3001`;
          setAdminUrl(url);

          const currentSocket = io(url, {
            transports: ['websocket'],
            reconnectionAttempts: Infinity,
          });
          socketRef.current = currentSocket;

          currentSocket.on('connect', () => {
            setSocketConnected(true);
            discoveryAttemptsRef.current = 0; // Сбрасываем счетчик при успехе
          });

          currentSocket.on('disconnect', () => {
            setSocketConnected(false);
            // Если отрубились - заново запускаем поиск!
            if (isDiscovering) {
              timerId = setTimeout(initConnection, 3000);
            }
          });

          currentSocket.on('ticket_update', (data: { id: string, status: string }) => {
            if (activeTicketsRef.current.has(data.id)) {

              const now = Date.now();
              const numActive = activeTicketsRef.current.size;

              if (data.status === 'accepted') {
                if (now - lastAcceptedTime.current > 500) {
                  showNotify(numActive > 1 ? `Админ взял пачку заявок в работу` : 'Админ взял заявку в работу', 'processing', 3500);
                  lastAcceptedTime.current = now;
                }
              }

              else if (data.status === 'resolved') {
                if (now - lastResolvedTime.current > 500) {
                  showNotify(numActive > 1 ? `Закрыта пачка заявок` : 'Проблема решена', 'success', 3500);
                  lastResolvedTime.current = now;
                }

                const newSet = new Set(activeTicketsRef.current);
                newSet.delete(data.id);
                saveTickets(newSet);
              }
            }
          });
        } else {
          timerId = setTimeout(initConnection, nextTimeoutDelay);
        }
      } catch (e) {
        timerId = setTimeout(initConnection, nextTimeoutDelay);
      }
    };

    initConnection();

    return () => {
      isDiscovering = false;
      clearTimeout(timerId);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [updateInfo]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSend = async (problemLabel: string) => {
    if (!adminUrl) {
      showNotify("Поиск сервера...", "error");
      return;
    }

    try {
      // Игнорируем ошибку автостарта, чтобы она не роняла функцию
      isEnabled().then(enabled => {
        if (!enabled) enable().catch(() => { });
      }).catch(() => { });

      const response = await fetch(`${adminUrl}/send-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: sysInfo.username,
          issue: problemLabel,
          ip: sysInfo.ip,
          os: sysInfo.os,
          office: office || "Не указан",
          phone: phone || "Не указан",
          status: "pending"
        })
      });

      if (response.ok) {
        const responseData = await response.json();
        const newSet = new Set(activeTicketsRef.current);
        newSet.add(responseData.id);
        saveTickets(newSet);

        showNotify("Кейс отправлен в IT-отдел", "sent", 1500);
      } else {
        throw new Error("HTTP Error " + response.status);
      }
    } catch (e) {
      showNotify("Ошибка сети", "error");
    }
  };

  if (!mounted) return null;

  return (
    <div className={`h-screen w-full bg-transparent flex items-center justify-center p-[2px] font-sans select-none overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}>
      <div className={`h-full w-full max-w-[380px] shadow-2xl rounded-[32px] border flex flex-col relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#09090b] border-white/10' : 'bg-white border-black/10'}`}>

        <div className="absolute top-14 left-0 right-0 z-[100] flex flex-col gap-2 px-4 pointer-events-none">
          <AnimatePresence>
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                layout
                initial={{ y: -20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -20, opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`pointer-events-auto p-3.5 rounded-2xl backdrop-blur-xl border shadow-xl flex items-center justify-between transition-colors
                  ${theme === 'dark' ? 'bg-zinc-800/95 border-white/10' : 'bg-white/95 border-black/5'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl flex items-center justify-center ${notif.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' :
                    notif.type === 'processing' ? 'bg-indigo-500/20 text-indigo-500' :
                      notif.type === 'error' ? 'bg-rose-500/20 text-rose-500' : 'bg-blue-500/20 text-blue-500'
                    }`}>
                    {notif.type === 'success' && <CheckCircle2 size={18} />}
                    {notif.type === 'processing' && <Truck size={18} className="animate-bounce" />}
                    {notif.type === 'error' && <X size={18} />}
                    {notif.type === 'sent' && <Clock size={18} className="animate-pulse" />}
                  </div>
                  <div className="flex flex-col pr-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 leading-none mb-1">
                      {notif.type === 'processing' ? 'Статус обновлен' : notif.type === 'success' ? 'Архив' : 'Система'}
                    </span>
                    <span className="text-xs font-bold leading-none">{notif.msg}</span>
                  </div>
                </div>

                <button
                  onClick={(e) => closeNotify(notif.id, e)}
                  className={`p-2 shrink-0 rounded-lg transition-colors opacity-50 hover:opacity-100
                    ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <header data-tauri-drag-region className={`h-14 shrink-0 flex items-center justify-between px-5 border-b relative z-10 transition-colors ${theme === 'dark' ? 'bg-[#121214] border-white/5' : 'bg-zinc-50 border-black/5'}`}>
          <div className="flex items-center gap-2.5 pointer-events-none">
            <ShieldAlert size={16} className="text-indigo-500" />
            <span className={`text-[10px] font-black uppercase tracking-[0.25em] mt-0.5 transition-colors ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Techly</span>
          </div>
          <div className="flex gap-1 z-20">
            <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-zinc-400 hover:text-yellow-400' : 'hover:bg-black/5 text-zinc-400 hover:text-indigo-500'}`}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={() => invoke('minimize_window').catch(() => { })} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-black/5 text-zinc-400 hover:text-black'}`}><Minus size={14} /></button>
            <button onClick={() => invoke('close_window').catch(() => { })} className={`p-2 rounded-lg transition-colors hover:text-rose-500 hover:bg-rose-500/10 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-400'}`}><X size={14} /></button>
          </div>
        </header>

        <main className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar relative">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">
              TECH <span className="text-indigo-500">LY</span>
            </h1>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${socketConnected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
              <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'} animate-pulse`} />
              <p className={`text-[9px] font-bold tracking-widest uppercase ${socketConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {socketConnected ? 'ONLINE' : 'СЕРВЕР...'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 pb-6">
            <div className="flex gap-3">
              <input placeholder="КАБ." value={office} onChange={e => setOffice(e.target.value)} className={`w-[72px] border rounded-2xl py-3.5 px-4 text-xs font-bold transition-all outline-none focus:border-indigo-500 focus:ring-4 ring-indigo-500/10 placeholder:text-zinc-400 uppercase text-center ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-zinc-50 border-black/10'}`} />
              <input placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)} className={`flex-1 border rounded-2xl py-3.5 px-4 text-xs font-bold transition-all outline-none focus:border-indigo-500 focus:ring-4 ring-indigo-500/10 placeholder:text-zinc-400 ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-zinc-50 border-black/10'}`} />
            </div>

            <div className="grid gap-3">
              {PROBLEMS.map((p) => (
                <motion.button
                  key={p.id}
                  onClick={() => handleSend(p.label)}
                  whileHover={{ scale: 1.015, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={`group flex items-center p-3.5 rounded-[20px] border transition-colors shadow-sm text-left relative overflow-hidden
                    ${theme === 'dark' ? 'bg-zinc-900/50 border-white/5 hover:border-white/20 text-zinc-200' : 'bg-zinc-50 border-black/5 hover:border-black/10 text-zinc-700'}`}
                >
                  <div className="p-3 rounded-2xl mr-4 z-10 transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300" style={{ backgroundColor: p.bg, color: p.color }}>
                    <p.icon size={20} strokeWidth={2.5} />
                  </div>
                  <span className="font-bold text-[12px] tracking-wide z-10">
                    {p.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </main>

        <footer className={`h-12 shrink-0 px-5 border-t flex justify-between items-center text-[10px] font-bold tracking-wider transition-colors ${theme === 'dark' ? 'bg-[#121214] border-white/5 text-zinc-400' : 'bg-zinc-50 border-black/5 text-zinc-500'}`}>
          <div className="flex items-center gap-2">
            <Monitor size={12} className="opacity-50" />
            <span>{sysInfo.ip || '...'}</span>
          </div>
          <span className="opacity-50 uppercase">{sysInfo.username}</span>
        </footer>
      </div>
    </div>
  );
}