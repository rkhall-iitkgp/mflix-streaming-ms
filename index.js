require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { Message } = require("./models/partyChatModel");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const { send } = require("process");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

mongoose.connect(process.env.MONGO_URI);

const rooms = {};

wss.on("connection", (ws) => {
	let currentRoomId = null;
	const clientId = uuidv4();

	const sendToRoom = (roomId, message) => {
		Object.values(rooms[roomId].clients).forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify(message));
			}
		});
	};

	ws.on("message", (message) => {
		const data = JSON.parse(message);

		switch (data.type) {
			case "create_room":
				currentRoomId = uuidv4();
				const roomCode = uuidv4().substring(0, 8);
				rooms[currentRoomId] = {
					clients: { [clientId]: ws },
					roomCode: roomCode,
					buttonPress: {},
					chatHistory: [],
					creator: clientId,
				};
				ws.send(
					JSON.stringify({
						type: "room_created",
						roomId: currentRoomId,
						roomCode: roomCode,
					})
				);
				break;

			case "join_room":
				const roomToJoin = Object.values(rooms).find(
					(room) => room.roomCode === data.roomCode
				);
				if (roomToJoin) {
					currentRoomId = Object.keys(rooms).find(
						(key) => rooms[key] === roomToJoin
					);
					roomToJoin.clients[clientId] = ws;
					ws.send(
						JSON.stringify({
							type: "joined_room",
							roomId: currentRoomId,
							roomCode: roomToJoin.roomCode,
						})
					);

					Object.entries(roomToJoin.buttonPress).forEach(([button, press]) => {
						ws.send(
							JSON.stringify({
								type: "button_press",
								button: button,
								press: press,
							})
						);
					});
					roomToJoin.chatHistory.forEach((chatMessage) => {
						ws.send(JSON.stringify({ type: "chat", content: chatMessage }));
					});
				} else {
					ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
				}
				break;

			case "chat":
				if (currentRoomId && rooms[currentRoomId]) {
					const chatMessage = {
						content: data.content,
						username: data.username,
					};
					rooms[currentRoomId].chatHistory.push(chatMessage); // Save to chat history
					sendToRoom(currentRoomId, { type: "chat", content: chatMessage });

					const message = new Message({
						roomId: currentRoomId,
						messages: [
							{
								username: data.username,
								content: data.content,
								// event: data.event
							},
						],
					});
					message.save();
				}
				break;

			case "button_press":
				if (currentRoomId && rooms[currentRoomId]) {
					const { button, isActive } = data;
					rooms[currentRoomId].buttonPress[button] = isActive;
					sendToRoom(currentRoomId, {
						type: "button_state_change",
						button: button,
						isActive: isActive,
					});

					const message = new Message({
						roomId: currentRoomId,
						messages: [
							{
								username: data.username,
								// content: data.content,
								event: data.event,
							},
						],
					});
				}
				break;
			case "leave_room":
				if (currentRoomId && rooms[currentRoomId]) {
					delete rooms[currentRoomId].clients[clientId];
					if (Object.keys(rooms[currentRoomId].clients).length === 0) {
						delete rooms[currentRoomId];
					}
				}
				sendToRoom(currentRoomId, { type: "user_left", clientId: clientId });

				const message = new Message({
					roomId: currentRoomId,
					messages: [
						{
							username: data.username,
							// content: data.content,
							event: `User ${data.username} left the room`,
						},
					],
				});
				break;
		}
	});

	ws.on("close", () => {
		if (
			currentRoomId &&
			rooms[currentRoomId] &&
			rooms[currentRoomId].clients[clientId]
		) {
			delete rooms[currentRoomId].clients[clientId];
			if (Object.keys(rooms[currentRoomId].clients).length === 0) {
				delete rooms[currentRoomId];
			}
		}
	});
});

app.use(cors());
app.use(fileUpload());
app.use(bodyParser.json());
wss.on("connection", function connection(ws) {
	ws.isAlive = true;
	ws.on("pong", () => (ws.isAlive = true));
});
wss.on("connection", function connection(ws) {
	ws.on("message", function incoming(message) {
		console.log("received: %s", message);
	});
});
module.exports = { wss };
app.use("/enc.key", express.static(path.join(__dirname, "enc.key")));
app.get("/", (req, res) => {
	res.send(
		"HLS video server is running. Access the videos at /videos/output.m3u8"
	);
});
app.use("/", require("./Router/streamingRouter"));

server.listen(process.env.PORT || 5000, () => {
	console.log(`Server started on port ${server.address().port}`);
});
