const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/room/:room", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const rooms = new Map();

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(socket.id);

    socket.to(roomId).emit("user-connected", {
      socketId: socket.id,
      userName
    });

    socket.emit("room-joined", {
      roomId,
      socketId: socket.id,
      userName
    });
  });

  socket.on("send-offer", ({ roomId, offer, targetSocketId }) => {
    socket.to(targetSocketId).emit("receive-offer", {
      offer,
      senderSocketId: socket.id
    });
  });

  socket.on("send-answer", ({ roomId, answer, targetSocketId }) => {
    socket.to(targetSocketId).emit("receive-answer", {
      answer,
      senderSocketId: socket.id
    });
  });

  socket.on("send-candidate", ({ targetSocketId, candidate }) => {
    socket.to(targetSocketId).emit("receive-candidate", {
      candidate,
      senderSocketId: socket.id
    });
  });

  socket.on("disconnect", () => {
    for (const [roomId, peers] of rooms.entries()) {
      if (peers.has(socket.id)) {
        peers.delete(socket.id);
        socket.to(roomId).emit("user-disconnected", socket.id);
      }
      if (peers.size === 0) {
        rooms.delete(roomId);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
