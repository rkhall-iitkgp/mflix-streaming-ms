require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { Message } = require('./models/userModel');

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
            case 'create_room':
                currentRoomId = uuidv4();
                const roomCode = uuidv4().substring(0, 8);
                rooms[currentRoomId] = { clients: { [clientId]: ws }, roomCode: roomCode, buttonColors: {}, chatHistory: [], creator: clientId };
                ws.send(JSON.stringify({ type: 'room_created', roomId: currentRoomId, roomCode: roomCode }));
                break;

            case 'join_room':
                const roomToJoin = Object.values(rooms).find(room => room.roomCode === data.roomCode);
                if (roomToJoin) {
                    currentRoomId = Object.keys(rooms).find(key => rooms[key] === roomToJoin);
                    roomToJoin.clients[clientId] = ws;
                    ws.send(JSON.stringify({ type: 'joined_room', roomId: currentRoomId, roomCode: roomToJoin.roomCode}));
                    
                    Object.entries(roomToJoin.buttonColors).forEach(([button, color]) => {
                        ws.send(JSON.stringify({ type: 'button_color_change', button: button, color: color }));
                    });
                    roomToJoin.chatHistory.forEach(chatMessage => {
                        ws.send(JSON.stringify({ type: 'chat', content: chatMessage }));
                    });
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                }
                break;
        
            case 'chat':
                if (currentRoomId && rooms[currentRoomId]) {
                    const chatMessage = { content: data.content, username: data.username };
                    rooms[currentRoomId].chatHistory.push(chatMessage); // Save to chat history
                    sendToRoom(currentRoomId, { type: 'chat', content: chatMessage });

                    const message = new Message({
                        username: data.username,
                        content: data.content,
                        roomId: currentRoomId,
                    });
                    message.save();
                }
                break;

            case 'button_press':
                if (currentRoomId && rooms[currentRoomId]) {
                    const { button, isActive } = data;
                    rooms[currentRoomId].buttonColors[button] = isActive; 
                    sendToRoom(currentRoomId, { type: 'button_state_change', button: button, isActive: isActive });
                }
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

server.listen(process.env.PORT || 5000, () => {
    console.log(`Server started on port ${server.address().port}`);
});
