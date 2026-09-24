const socket = io();

const joinScreen = document.getElementById("joinScreen");
const consentScreen = document.getElementById("consentScreen");
const callControls = document.getElementById("callControls");
const shareLinkBox = document.getElementById("shareLinkBox");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const shareLinkInput = document.getElementById("shareLinkInput");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const allowCallBtn = document.getElementById("allowCallBtn");
const cancelCallBtn = document.getElementById("cancelCallBtn");
const toggleMicBtn = document.getElementById("toggleMicBtn");
const toggleCameraBtn = document.getElementById("toggleCameraBtn");
const leaveCallBtn = document.getElementById("leaveCallBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");

let localStream = null;
let peerConnections = {};
let roomId = "";
let userName = "";
let isMicOn = true;
let isCameraOn = true;

function getRoomFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/room\/([^/]+)/);
  if (match) return match[1];
  return "";
}

function buildRoomUrl(room) {
  const base = window.location.origin;
  return `${base}/room/${room}`;
}

function showElement(el) {
  el.classList.remove("hidden");
}

function hideElement(el) {
  el.classList.add("hidden");
}

function generateRoomId() {
  return Math.random().toString(36).slice(2, 10);
}

async function requestMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user"
      },
      audio: true
    });

    localVideo.srcObject = localStream;
    localVideo.play();

    return true;
  } catch (error) {
    console.error("Camera/Mic access denied:", error);
    alert("Camera and microphone permission required to join the call.");
    return false;
  }
}

function createPeerConnection(targetSocketId) {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("send-candidate", {
        targetSocketId,
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = (event) => {
    const [remoteStream] = event.streams;
    if (remoteStream) {
      remoteVideo.srcObject = remoteStream;
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") {
      console.log("Connection failed");
    }
  };

  peerConnections[targetSocketId] = pc;
  return pc;
}

async function startCall() {
  if (!roomId) {
    alert("Room is required");
    return;
  }

  const granted = await requestMedia();
  if (!granted) return;

  socket.emit("join-room", { roomId, userName });

  hideElement(joinScreen);
  hideElement(consentScreen);
  showElement(callControls);
}

async function makeOffer(targetSocketId) {
  const pc = createPeerConnection(targetSocketId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("send-offer", {
    roomId,
    offer,
    targetSocketId
  });
}

socket.on("room-joined", ({ roomId: joinedRoomId, userName: joinedUserName }) => {
  roomId = joinedRoomId;
  userName = joinedUserName;

  if (roomInput.value.trim() === "") {
    roomInput.value = roomId;
  }
});

socket.on("user-connected", ({ socketId, userName: remoteUserName }) => {
  makeOffer(socketId);
});

socket.on("receive-offer", async ({ offer, senderSocketId }) => {
  const pc = createPeerConnection(senderSocketId);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("send-answer", {
    roomId,
    answer,
    targetSocketId: senderSocketId
  });
});

socket.on("receive-answer", async ({ answer, senderSocketId }) => {
  const pc = peerConnections[senderSocketId];
  if (!pc) return;

  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("receive-candidate", async ({ candidate, senderSocketId }) => {
  const pc = peerConnections[senderSocketId];
  if (!pc) return;

  await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("user-disconnected", (socketId) => {
  const pc = peerConnections[socketId];
  if (pc) {
    pc.close();
    delete peerConnections[socketId];
  }
});

createRoomBtn.addEventListener("click", () => {
  const generatedRoom = generateRoomId();
  const url = buildRoomUrl(generatedRoom);
  roomInput.value = generatedRoom;
  shareLinkInput.value = url;
  showElement(shareLinkBox);
  roomId = generatedRoom;
});

joinRoomBtn.addEventListener("click", () => {
  const enteredName = nameInput.value.trim() || "Guest";
  userName = enteredName;

  const enteredRoom = roomInput.value.trim();

  if (!enteredRoom) {
    alert("Please enter room ID or share link");
    return;
  }

  roomId = enteredRoom;

  if (!window.location.pathname.includes("/room/")) {
    const roomUrl = buildRoomUrl(enteredRoom);
    window.history.pushState({}, "", roomUrl);
  }

  showElement(consentScreen);
  hideElement(joinScreen);
});

allowCallBtn.addEventListener("click", () => {
  startCall();
});

cancelCallBtn.addEventListener("click", () => {
  hideElement(consentScreen);
  showElement(joinScreen);
});

toggleMicBtn.addEventListener("click", () => {
  if (!localStream) return;

  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    isMicOn = audioTrack.enabled;
    toggleMicBtn.textContent = isMicOn ? "Mute" : "Unmute";
  }
});

toggleCameraBtn.addEventListener("click", () => {
  if (!localStream) return;

  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    isCameraOn = videoTrack.enabled;
    toggleCameraBtn.textContent = isCameraOn ? "Camera Off" : "Camera On";
  }
});

leaveCallBtn.addEventListener("click", () => {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }

  Object.values(peerConnections).forEach((pc) => pc.close());
  peerConnections = {};

  remoteVideo.srcObject = null;
  localVideo.srcObject = null;

  showElement(joinScreen);
  hideElement(consentScreen);
  hideElement(callControls);
  hideElement(shareLinkBox);

  roomInput.value = "";
  shareLinkInput.value = "";
});

copyLinkBtn.addEventListener("click", () => {
  shareLinkInput.select();
  document.execCommand("copy");
  alert("Link copied to clipboard");
});

const existingRoom = getRoomFromUrl();
if (existingRoom) {
  roomInput.value = existingRoom;
  roomId = existingRoom;
  showElement(consentScreen);
  hideElement(joinScreen);
}
