require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { partyChatModel } = require('./models/partyChatModel');
const { send } = require('process');
const { chatHistoryRouter } = require("./routes");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

mongoose.connect(process.env.MONGO_URI);

const rooms = {};

wss.on('connection', (ws) => {
    let currentRoomId = null;
    const clientId = uuidv4();

    const sendToRoom = (roomId, message) => {
        Object.values(rooms[roomId].clients).forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    };

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'watch':
                if (currentWatcher === null) {
                    currentWatcher = clientId;
                    ws.send(JSON.stringify({ type: 'watchAllowed' }));
                } else {
                    ws.send(JSON.stringify({ type: 'watchDenied', message: 'Someone is already watching' }));
                }
                break;

            case 'stopWatching':
                if (currentWatcher === clientId) {
                    currentWatcher = null;
                }
                break;
            case 'create_room':
                currentRoomId = uuidv4();
                const roomCode = uuidv4().substring(0, 8);
                rooms[currentRoomId] = { clients: { [clientId]: {ws, username: data.username } }, roomCode: roomCode, buttonPress: {}, chatHistory: [], creator: clientId };
                ws.send(JSON.stringify({ type: 'room_created', roomId: currentRoomId, roomCode: roomCode }));
                break;

            case 'join_room':
                const roomToJoin = Object.values(rooms).find(room => room.roomCode === data.roomCode);
                if (roomToJoin) {
                    currentRoomId = Object.keys(rooms).find(key => rooms[key] === roomToJoin);
                    roomToJoin.clients[clientId] = {ws, username: data.username};
                    ws.send(JSON.stringify({ type: 'joined_room', roomId: currentRoomId, roomCode: roomToJoin.roomCode }));

                    Object.entries(roomToJoin.buttonPress).forEach(([button, press]) => {
                        ws.send(JSON.stringify({ type: 'button_press', button: button, press: press }));
                    });
                    roomToJoin.chatHistory.forEach(chatMessage => {
                        ws.send(JSON.stringify({ type: 'chat', content: chatMessage }));
                    });
                    sendUserList(currentRoomId);
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                }
                break;

            case 'chat':
                if (currentRoomId && rooms[currentRoomId]) {
                    const chatMessage = { content: data.content, username: data.username };
                    rooms[currentRoomId].chatHistory.push(chatMessage); // Save to chat history
                    sendToRoom(currentRoomId, { type: 'chat', content: chatMessage });

                    const message = new partyChatModel({
                        roomId: currentRoomId,
                        messages: [
                            {
                                username: data.username,
                                content: data.content,
                                // event: data.event
                            }
                        ]
                    });
                    message.save();
                }
                break;

            case 'button_press':
                if (currentRoomId && rooms[currentRoomId]) {
                    const { button, isActive } = data;
                    rooms[currentRoomId].buttonPress[button] = isActive;
                    sendToRoom(currentRoomId, { type: 'button_state_change', button: button, isActive: isActive });

                    const message = new partyChatModel({
                        roomId: currentRoomId,
                        messages: [
                            {
                                username: data.username,
                                // content: data.content,
                                event: data.event
                            }
                        ]
                    });
                }
                break;
            case 'leave_room':
                if (currentRoomId && rooms[currentRoomId]) {
                    delete rooms[currentRoomId].clients[clientId];
                    if (Object.keys(rooms[currentRoomId].clients).length === 0) {
                        delete rooms[currentRoomId];
                    } else {
                        sendUserList(currentRoomId);
                    }
                }
                sendToRoom(currentRoomId, { type: 'user_left', clientId: clientId });

                const message = new partyChatModel({
                    roomId: currentRoomId,
                    messages: [
                        {
                            username: data.username,
                            // content: data.content,
                            event: `User ${data.username} left the room`
                        }
                    ]
                });
                break;
            case 'rejoin_room':
                if (currentRoomId && rooms[currentRoomId]) {
                    rooms[currentRoomId].clients[clientId] = {ws, username: data.username};
                    ws.send(JSON.stringify({ type: 'rejoined_room', roomId: currentRoomId }));
                    sendUserList(currentRoomId);

                    Object.entries(rooms[currentRoomId].buttonPress).forEach(([button, press]) => {
                        ws.send(JSON.stringify({ type: 'button_press', button: button, press: press }));
                    });
                    rooms[currentRoomId].chatHistory.forEach(chatMessage => {
                        ws.send(JSON.stringify({ type: 'chat', content: chatMessage }));
                    });
                }
                break;
            case 'kick_user':
                if (currentRoomId && rooms[currentRoomId]) {
                    if (clientId === rooms[currentRoomId].creator) {
                        delete rooms[currentRoomId].clients[data.clientId];
                        sendToRoom(currentRoomId, { type: 'user_left', clientId: data.clientId });
                        sendUserList(currentRoomId);
                    }
                }
                break;
            case 'restrict_user_buttons':
                if (currentRoomId && rooms[currentRoomId]) {
                    if (clientId === rooms[currentRoomId].creator) {
                        sendToRoom(currentRoomId, { type: 'restrict_buttons', buttons: data.buttons });
                    }
                }
                break;
            case 'unrestrict_user_buttons':
                if (currentRoomId && rooms[currentRoomId]) {
                    if (clientId === rooms[currentRoomId].creator) {
                        sendToRoom(currentRoomId, { type: 'unrestrict_buttons' });
                    }
                }
                break;
            case 'get_chat_history':
                partyChatModel.find({ roomId: currentRoomId }, (err, messages) => {
                    if (err) {
                        console.log(err);
                    } else {
                        ws.send(JSON.stringify({ type: 'chat_history', messages: messages }));
                    }
                });
                break;
            

        }
    });

    ws.on('close', () => {
        if (currentRoomId && rooms[currentRoomId] && rooms[currentRoomId].clients[clientId]) {
            delete rooms[currentRoomId].clients[clientId];
            if (Object.keys(rooms[currentRoomId].clients).length === 0) {

                delete rooms[currentRoomId];
            }
        }
    });
});

function sendUserList(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const users = Object.entries(room.clients).map(([clientId, {username}]) => ({ clientId, username }));
    const creatorWs = room.clients[room.creator]?.ws;

    if (creatorWs && creatorWs.readyState === WebSocket.OPEN) {
        creatorWs.send(JSON.stringify({ type: 'user_list', users, isCreator: true }));
    }
}

app.use(express.json());
app.use("/", chatHistoryRouter)

server.listen(process.env.PORT || 5000, () => {
    console.log(`Server started on port ${server.address().port}`);
});
