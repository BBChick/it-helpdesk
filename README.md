<div align="center">
  <img src="https://raw.githubusercontent.com/tauri-apps/tauri/dev/app-icon.png" alt="Logo" width="80" height="80">
  <h1 align="center">Techly Local HelpDesk</h1>
  <p align="center">
    <strong>Молниеносная P2P система IT-поддержки для локальных сетей.</strong>
    <br />
    Без облаков. Без задержек. Написана на Rust и React.
  </p>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Rust-Backend-000000?logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/Next.js-Frontend-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socket.io&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind" />
</p>

---

## 🚀 О проекте

**Techly HelpDesk** — это локальная система обработки заявок (Ticketing System), разработанная специально для закрытых корпоративных сетей. Система состоит из двух независимых модулей: **Админ-панели (Сервер)** и **Клиентского приложения**.

Никакой сложной настройки IP-адресов. Клиенты автоматически находят сервер системного администратора в локальной сети (LAN) с помощью UDP-бродкастинга, а всё общение происходит в реальном времени через веб-сокеты. Построено на базе Tauri для минимального потребления ОЗУ и процессора.

### 📸 Скриншоты
*(Заменить ссылки ниже на реальные скриншоты)*

| Админ-панель (Сервер) | Клиентское приложение |
|-----------------------|-----------------------|
| <img src="https://via.placeholder.com/600x400/09090b/4f46e5?text=Techly+Admin+Dashboard" width="400"> | <img src="https://via.placeholder.com/300x400/09090b/4f46e5?text=Techly+Client+App" width="200"> |

---

## ✨ Ключевые возможности

### 🛡️ Админ-панель (Techly Admin)
- **Local Server Engine:** Встроенный высокоскоростной сервер на базе Rust `axum`.
- **Живая очередь:** Мгновенное появление заявок без перезагрузки интерфейса.
- **Массовые действия:** Группировка одинаковых заявок с одного IP и массовое их закрытие.
- **Glassmorphism UI:** Современный парящий интерфейс с поддержкой Dark/Light mode и кастомными окнами.
- **System Tray:** Управление сервером через системный трей (очистка логов, скрытие/разворачивание).
- **Idle Optimization:** Алгоритмы отключения рендера при свернутом окне для экономии CPU.

### 💻 Клиент-модуль (Techly Client)
- **Zero-Config Discovery:** Автоматический поиск админа по UDP-каналу (режим затухающего пинга).
- **Сбор SysInfo:** Автоматический сбор имени ПК, IP-адреса, ОС и подключенных принтеров через PowerShell.
- **Autostart:** Тихий автозапуск при включении Windows.
- **Фоновый режим:** При закрытии на крестик уходит в трей, не мешая работе сотрудника.
- **Smart Notifications:** Уведомления об этапах решения проблемы (Отправлено -> В работе -> Решено).

---

## 🛠️ Архитектура

Приложение не требует выделенного сервера (Apache, Nginx) или облачной базы данных. 

1. **Сервер**: Администратор открывает `techly_adm.exe`. Приложение поднимает внутри себя TCP-сервер (порт 3001) и начинает вещать свой IP-адрес по UDP (порт 41234).
2. **Клиент**: Сотрудник открывает `techly_client.exe`. Клиент ловит UDP-сигнал, получает IP админа и устанавливает непрерывное `Socket.io` соединение.
3. **Хранилище**: Данные хранятся в локальном файле `history.json` с использованием блокировок потоков (Mutex) в Rust для предотвращения коллизий памяти.

---

## 📦 Сборка из исходников (Build)

Для самостоятельной сборки вам понадобится [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/) и пакетный менеджер `pnpm`.

### 1. Сборка Админки:
```bash
# Перейдите в папку админки
cd techly_adm

# Установите зависимости фронтенда
pnpm install


# Соберите .exe файл
pnpm tauri build
```
### 2. Сборка Клиента:
```bash
# Перейдите в папку клиента
cd techly_client

# Установите зависимости
pnpm install

# Соберите .exe файл
pnpm tauri build
```

---

🔒 Безопасность и Сеть
Для корректной работы необходимо разрешить приложениям доступ в "Частные сети" (Private Networks) в настройках Брандмауэра Windows Defender при первом запуске.
<div align="center">
<sub>Разработано с ❤️ для суровых системных администраторов.</sub>
</div>

