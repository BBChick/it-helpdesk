const express = require('express');
const cors = require('cors');
const dgram = require('dgram');
const http = require('http'); // Добавлено для связки Express и Socket.io
const { Server } = require('socket.io'); // Добавлена библиотека сокетов

const app = express();
const port = 3001;

// Создаем HTTP сервер на базе Express
const server = http.createServer(app);

// Настраиваем Socket.io с поддержкой CORS
const io = new Server(server, {
    cors: {
        origin: "*", // В продакшене лучше указать конкретные домены
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

let tickets = [];

// --- SOCKET.IO ЛОГИКА ---
io.on('connection', (socket) => {
    console.log(`[WS] Новый коннект: ${socket.id}`);

    // Клиент (юзер) сообщает свое имя, и мы помещаем его в персональную "комнату"
    socket.on('register_client', (username) => {
        socket.join(username);
        console.log(`[WS] Пользователь ${username} подписан на уведомления`);
    });

    socket.on('disconnect', () => {
        console.log(`[WS] Клиент отключился: ${socket.id}`);
    });
});

// --- ЛОГИКА АВТООБНАРУЖЕНИЯ (МАЯК) ---
const udpServer = dgram.createSocket('udp4');
const DISCOVERY_PORT = 41234;

udpServer.bind(() => {
    udpServer.setBroadcast(true);
    console.log(`[UDP] Маяк запущен на порту ${DISCOVERY_PORT}`);

    setInterval(() => {
        const message = Buffer.from(JSON.stringify({
            type: 'ZENOPS_SERVER',
            port: port
        }));
        udpServer.send(message, 0, message.length, DISCOVERY_PORT, '255.255.255.255');
    }, 3000);
});

// --- API ЭНДПОИНТЫ ---

app.post('/send-ticket', (req, res) => {
    const newTicket = {
        id: Date.now().toString(),
        ...req.body,
        status: 'pending',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString()
    };
    tickets.push(newTicket);

    // Оповещаем всех админов о новом тикете
    io.emit('new_ticket', newTicket);

    console.log(`[NEW] Кабинет ${req.body.office} | ${req.body.user}: ${req.body.issue}`);
    res.status(200).json({ success: true });
});

app.get('/get-tickets', (req, res) => res.json(tickets));

app.post('/update-status', (req, res) => {
    const { id, status } = req.body;
    const ticket = tickets.find(t => t.id === id);

    if (ticket) {
        ticket.status = status;

        // КЛЮЧЕВОЙ МОМЕНТ: Отправляем обновление статуса конкретному юзеру в его комнату
        io.to(ticket.user).emit('status_update', status);

        // Оповещаем админов, что статус изменился (чтобы список в админке обновился у всех)
        io.emit('status_changed', { id, status });

        console.log(`[UPDATE] Тикет ${id} (${ticket.user}) -> ${status}`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Ticket not found" });
    }
});

// Запускаем именно 'server', а не 'app'
server.listen(port, '0.0.0.0', () => {
    console.log('=========================================');
    console.log('   IT-HELPDESK SERVER 2.6 (WS) ЗАПУЩЕН');
    console.log(`   Local: http://localhost:${port}`);
    console.log('=========================================');
});