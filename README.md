# it-helpdesk
# ⚡ ZENOPS IT-Support System v2.8

![Next.js](https://img.shields.io/badge/Next.js-000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-FFC131?style=for-the-badge&logo=tauri&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**ZENOPS** — это высокоскоростная система управления IT-инцидентами, разработанная для локальных сетей. Состоит из легковесного клиента на Tauri и футуристичной админ-панели. 

> "Пока другие ищут номер сисадмина, наши пользователи уже видят человечка, который к ним бежит."

## 🚀 Основные фичи

### 👤 Клиентское приложение (Support App)
* **One-tap ticketing**: Выбор проблемы в один клик.
* **Auto System Info**: Автоматический сбор IP, OS и имени пользователя.
* **Real-time Status**: Уведомление «Админ в пути» с прыгающим человечком.
* **Non-blocking UI**: Индикация работы не мешает пользоваться приложением.

### 🛠 Админ-панель (Admin Dashboard)
* **Neubrutalism Design**: Стильный темный интерфейс с яркими акцентами.
* **Smart Archive**: Выполненные заявки сохраняются с полной историей (кабинет, телефон, время).
* **Live Monitoring**: Мгновенное получение заявок со звуковым уведомлением.
* **Theme Support**: Идеальный вид как в Dark, так и в Light моде.

## 🛠 Технологический стек
- **Frontend**: Next.js 14, Tailwind CSS, Framer Motion.
- **Desktop Wrapper**: Tauri (Rust) — для минимального потребления ОЗУ.
- **Backend**: Node.js + Express.
- **Icons**: Lucide-React.

## 📦 Как запустить (Dev-режим)

1. **Запуск сервера**:
   ```bash
   cd server
   node server.js
