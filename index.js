require("dotenv").config();
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { partyChatModel } = require("./models/partyChatModel");
const { send } = require("process");
const { chatHistoryRouter } = require("./routes");
// Use dynamic import to load node-fetch

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// let fetch;
// import('node-fetch').then(module => {
//   fetch = module.default;
//   server.on('upgrade',  async (request, socket, head) => {
//     const cookies = request.headers.cookie
//     try {
//         const response = await fetch('https://971edtce1a.execute-api.ap-south-1.amazonaws.com/auth/verify', {
//             method: 'GET',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Cookie': cookies
//     },
//     credentials: 'include'
//     });

//     const data = await response.json();
//     if (data.success && data.account && data.subscriptionTier.tier.tier == 'Tier 1' ) {
//         wss.handleUpgrade(request, socket, head, (ws) => {
//             wss.emit('connection', ws, request);
//         });
//     } else {
//         socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
//         socket.destroy();
//     }
//     } catch (error) {
//         console.error(error);
//         socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
//         socket.destroy();
//     }
// });
//   // Place the code that depends on `fetch` here or inside another function that gets called after this promise resolves.
// });

module.exports = { wss };

mongoose.connect(process.env.MONGO_URI);

const rooms = {};

// dont allow the user to create a wss connection if they are not logged in using cookies

wss.on("connection", (ws) => {
  ws.isAlive = true; // Check if connection is alive
  ws.on("pong", () => (ws.isAlive = true)); // Check if connection is alive
  let currentRoomId = null;
  const clientId = uuidv4();

  const sendToRoom = (roomId, message, username) => {
    Object.values(rooms[roomId].clients).forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        let personalizedMessage = { ...message };
        // console.log('cjsd',clientId)

        if (personalizedMessage.type === "chat") {
          personalizedMessage.type =
            client.username === username
              ? "outgoing_message"
              : "incoming_message";
        }
        client.ws.send(JSON.stringify(personalizedMessage));
        // console.log('personal',personalizedMessage, clientId, senderId);
      }
    });
  };

  ws.on("message", (message) => {
    console.log("received: %s", message);

    const data = JSON.parse(message);

    switch (data.type) {
      case "create_room":
        currentRoomId = uuidv4();
        const roomCode = uuidv4().substring(0, 8);
        rooms[currentRoomId] = {
          clients: {
            [clientId]: {
              ws,
              username: data.username,
              videoLink: data.videoLink,
            },
          },
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
            username: data.username,
            clientId: clientId,
            videoLink: data.videoLink,
          })
        );
        // sendToRoom(currentRoomId, { type: 'chat', content: { content: `${data.username} created the room`, username: 'Server' } });
        break;

      case "join_room":
        const roomToJoin = Object.values(rooms).find(
          (room) => room.roomCode === data.roomCode
        );
        if (roomToJoin) {
          currentRoomId = Object.keys(rooms).find(
            (key) => rooms[key] === roomToJoin
          );
          roomToJoin.clients[clientId] = { ws, username: data.username };
          // ws.send(JSON.stringify({ type: 'joined_room', roomId: currentRoomId, roomCode: roomToJoin.roomCode, username: data.username, clientId: clientId, videoLink: data.videoLink }));
          sendToRoom(
            currentRoomId,
            {
              type: "joined_room",
              roomId: currentRoomId,
              roomCode: roomToJoin.roomCode,
              username: data.username,
              clientId: clientId,
              videoLink: data.videoLink,
              creator:
                rooms[currentRoomId].clients[rooms[currentRoomId].creator],
            },
            data.username
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
          sendUserList(currentRoomId);
        } else {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        }
        break;

      case "chat":
        if (currentRoomId && rooms[currentRoomId]) {
          const chatMessage = { text: data.content, username: data.username };
          rooms[currentRoomId].chatHistory.push(chatMessage); // Save to chat history
          sendToRoom(
            currentRoomId,
            { type: "chat", content: chatMessage },
            data.username
          ); // send only content

          const message = new partyChatModel({
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

      case "update_time":
        if (currentRoomId && rooms[currentRoomId]) {
          sendToRoom(
            currentRoomId,
            { type: "emit_update_time", new_time: data.new_time },
            data.username
          );
        }
        break;

      // case 'button_press':
      //     if (currentRoomId && rooms[currentRoomId]) {
      //         const { button, isActive } = data;
      //         rooms[currentRoomId].buttonPress[button] = isActive;
      //         sendToRoom(currentRoomId, { type: 'button_state_change', button: button, isActive: isActive });

      //         const message = new partyChatModel({
      //             roomId: currentRoomId,
      //             messages: [
      //                 {
      //                     username: data.username,
      //                     // content: data.content,
      //                     event: data.event
      //                 }
      //             ]
      //         });
      //     }
      //     break;
      case "seek":
        if (currentRoomId && rooms[currentRoomId]) {
          let message = {
            username: data.username,
            clientId: clientId,
            seekTime: data.seekTime,
          };
          sendToRoom(
            currentRoomId,
            {
              ...message,
              type: "seek",
            },
            data.username
          );
        }
        break;
      case "play_pause":
        if (currentRoomId && rooms[currentRoomId]) {
          sendToRoom(
            currentRoomId,
            {
              type: "play_pause",
              isPlaying: data.isPlaying,
              username: data.username,
            },
            data.username
          );
        }
        break;

      // case "request_sync":
      //     const hostClientId = rooms[currentRoomId].creator;
      //     const host = rooms[currentRoomId].clients[hostClientId];
      //     if (host) {
      //         // Send a request to the host for their current video timestamp
      //         host.ws.send(JSON.stringify({ type: 'sync_request', clientId: clientId }));
      //     }
      //     break;

      // case 'sync_response':
      //     if (currentRoomId && rooms[currentRoomId]) {
      //         const { timestamp } = data;
      //         // Broadcast the host's video timestamp to everyone in the room
      //         sendToRoom(currentRoomId, { type: 'sync_timestamp', timestamp: timestamp }, data.username);
      //     }
      //     break;

      case "leave_room":
        if (currentRoomId && rooms[currentRoomId]) {
          if (rooms[currentRoomId].creator === clientId) {
            sendToRoom(currentRoomId, { type: "room_closed" }, data.username);
            rooms[currentRoomId].clients[clientId].ws.close();
            delete rooms[currentRoomId].clients[clientId];
          } else {
            sendToRoom(
              currentRoomId,
              {
                type: "user_left",
                clientId: clientId,
                username: data.username,
              },
              data.username
            );
            rooms[currentRoomId].clients[clientId].ws.close();
            delete rooms[currentRoomId].clients[clientId];
          }
          if (Object.keys(rooms[currentRoomId].clients).length === 0) {
            sendToRoom(currentRoomId, { type: "room_closed" }, data.username);
            delete rooms[currentRoomId];
          } else {
            sendUserList(currentRoomId);
          }
        }
        // sendToRoom(currentRoomId, { type: 'user_left', clientId: clientId, username: data.username });

        const message = new partyChatModel({
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
      case "rejoin_room":
        if (currentRoomId && rooms[currentRoomId]) {
          rooms[currentRoomId].clients[clientId] = {
            ws,
            username: data.username,
          };
          ws.send(
            JSON.stringify({ type: "rejoined_room", roomId: currentRoomId })
          );
          sendUserList(currentRoomId);
          sendToRoom(
            currentRoomId,
            {
              type: "user_rejoined",
              clientId: clientId,
              username: data.username,
            },
            data.username
          );

          Object.entries(rooms[currentRoomId].buttonPress).forEach(
            ([button, press]) => {
              ws.send(
                JSON.stringify({
                  type: "button_press",
                  button: button,
                  press: press,
                })
              );
            }
          );
          rooms[currentRoomId].chatHistory.forEach((chatMessage) => {
            ws.send(JSON.stringify({ type: "chat", content: chatMessage }));
          });
          const message = new partyChatModel({
            roomId: currentRoomId,
            messages: [
              {
                username: data.username,
                // content: data.content,
                event: `User ${data.username} rejoined the room`,
              },
            ],
          });
        }
        break;
      case "kick_user":
        if (currentRoomId && rooms[currentRoomId]) {
          if (clientId === rooms[currentRoomId].creator) {
            sendToRoom(
              currentRoomId,
              {
                type: "user_left",
                clientId: data.clientId,
                username: data.username,
              },
              data.username
            );
            rooms[currentRoomId].clients[data.clientId].ws.close();
            delete rooms[currentRoomId].clients[data.clientId];
            sendUserList(currentRoomId);
          }
        }
        break;
      case "restrict_user_buttons":
        if (currentRoomId && rooms[currentRoomId]) {
          if (clientId === rooms[currentRoomId].creator) {
            // restrict buttons of a particulat selected client
            sendToRoom(
              currentRoomId,
              {
                type: "restrict_buttons",
                buttons: data.buttons,
                clientId: data.clientId,
              },
              data.username
            );
          }
        }
        break;
      case "unrestrict_user_buttons":
        if (currentRoomId && rooms[currentRoomId]) {
          if (clientId === rooms[currentRoomId].creator) {
            sendToRoom(
              currentRoomId,
              {
                type: "unrestrict_buttons",
                buttons: data.buttons,
                clientId: data.clientId,
              },
              data.username
            );
          }
        }
        break;
      case "get_chat_history":
        partyChatModel.find({ roomId: currentRoomId }, (err, messages) => {
          if (err) {
            console.log(err);
          } else {
            ws.send(
              JSON.stringify({ type: "chat_history", messages: messages })
            );
          }
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
      console.log("is it here");
      delete rooms[currentRoomId].clients[clientId];
      sendUserList(currentRoomId);
      if (Object.keys(rooms[currentRoomId].clients).length === 0) {
        delete rooms[currentRoomId];
      }
    }
  });
});
app.use(cors());
app.use(fileUpload());
app.use(bodyParser.json());
app.use("/", require("./Router/streamingRouter"));
app.use("/enc.key", express.static(path.join(__dirname, "enc.key")));
app.get("/", (req, res) => {
  res.send(
    "HLS video server is running. Access the videos at /videos/output.m3u8"
  );
});

function sendUserList(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const users = Object.entries(room.clients).map(
    ([clientId, { username }]) => ({ clientId, username })
  );
  const creatorWs = room.clients[room.creator]?.ws;

  if (creatorWs && creatorWs.readyState === WebSocket.OPEN) {
    creatorWs.send(
      JSON.stringify({ type: "user_list", users, isCreator: true })
    );
  }
}

app.use(express.json());
app.use("/chat", chatHistoryRouter);
app.get("/", (req, res) => {
  res.send("Server is up and runnning");
});

server.listen(process.env.PORT || 5000, () => {
  console.log(`Server started on port ${server.address().port}`);
});

const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//     console.log(`Server running at PORT: ${PORT}`);
// });
