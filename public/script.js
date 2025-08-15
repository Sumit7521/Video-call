const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const chatBox = document.getElementById('chat-box');
const muteButton = document.getElementById('mute');
const stopVideoButton = document.getElementById('stop-video');
const sendMessageButton = document.getElementById('send-message');
const chatMessageInput = document.getElementById('chat-message');
const leaveMeetButton = document.getElementById('leave-meet');
const cameraOnIcon = `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>`;
const cameraOffIcon = `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path d="M1 1l22 22" /> <!-- Slash -->
  <polygon points="23 7 16 12 23 17 23 7"></polygon>
  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
</svg>
`;
const audioOnIcon = `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>`;
const audioOffIcon = `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path d="M9 9v3a3 3 0 0 0 6 0v-1" />
  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
  <line x1="12" y1="19" x2="12" y2="23" />
  <line x1="8" y1="23" x2="16" y2="23" />
  <line x1="1" y1="1" x2="23" y2="23" /> \
</svg>
`;
let audioEnabled = true;
let videoEnabled = true;
const chatingArea = document.getElementById('chating-area');
const username = prompt("Enter your name:");
if(!username) {
  alert("Username is required to join the meeting.");
    throw new Error("Username is required");
}


(async () => {
  const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

  // Create video element for the local user
  const localVideo = document.createElement('video');
  localVideo.srcObject = localStream;
  localVideo.autoplay = true;
  localVideo.muted = true; // Mute own audio to avoid feedback
  localVideo.id = 'local-video'; // Add an ID for managing video boxes
  videoGrid.append(localVideo);

  const peers = {}; // Store peer connections
  const roomId = 'class-room'; // Room name to join
  socket.emit('join-room', roomId); // Join the room

  // Handle when a user connects
  socket.on('user-connected', (userId) => {
    console.log('User connected:', userId);

    const peerConnection = createPeerConnection(userId);

    // Create an offer and send it to the other user
    peerConnection.createOffer().then((offer) => {
      console.log('Sending offer to user:', userId);
      return peerConnection.setLocalDescription(offer);
    }).then(() => {
      socket.emit('signal', { target: userId, signal: peerConnection.localDescription });
    }).catch((error) => {
      console.error('Error creating offer:', error);
    });
  });

  // Handle the reception of a signal (offer, answer, ICE candidate)
  socket.on('signal', (data) => {
    const { signal, from } = data;

    if (!peers[from]) {
      console.log('Creating peer connection for user:', from);
      createPeerConnection(from);
    }

    if (signal.candidate) {
      console.log('Received ICE candidate from user:', from);
      peers[from].addIceCandidate(new RTCIceCandidate(signal)).catch((error) => {
        console.error('Error adding ICE candidate:', error);
      });
    }

    if (signal.type === 'offer') {
      console.log('Received offer from user:', from);
      peers[from].setRemoteDescription(new RTCSessionDescription(signal)).then(() => {
        return peers[from].createAnswer();
      }).then((answer) => {
        return peers[from].setLocalDescription(answer);
      }).then(() => {
        socket.emit('signal', { target: from, signal: peers[from].localDescription });
      }).catch((error) => {
        console.error('Error handling offer:', error);
      });
    }

    if (signal.type === 'answer') {
      console.log('Received answer from user:', from);
      peers[from].setRemoteDescription(new RTCSessionDescription(signal)).catch((error) => {
        console.error('Error handling answer:', error);
      });
    }
  });

  // Remove video box on user disconnection
  socket.on('user-disconnected', (userId) => {
    console.log('User disconnected:', userId);
    if (peers[userId]) {
      peers[userId].close();
      delete peers[userId];
    }
    const videoElement = document.getElementById(`video-${userId}`);
    if (videoElement) {
      videoElement.remove();
    }
  });

  
  // Mute/unmute audio
  muteButton.onclick = () => {
    localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
  };

  // Stop/start video
  stopVideoButton.onclick = () => {
    localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
  };

  // Leave the meeting
  leaveMeetButton.onclick = () => {
    socket.emit('leave-room');
    localStream.getTracks().forEach(track => track.stop()); // Stop all tracks
    videoGrid.innerHTML = ''; // Clear video grid
    chatBox.innerHTML = ''; // Clear chat box
    peers = {}; // Clear peer connections
    console.log('Left the meeting and cleared resources.');
  };

  // Send chat message
  // sendMessageButton.onclick = () => {
  //   const message = chatMessageInput.value.trim();
  //   if (message !== '') {
  //     chatingArea.innerHTML += `<p><b>You:</b> ${message}</p>`;
  //     chatMessageInput.value = '';
  //     chatingArea.scrollTop = chatingArea.scrollHeight; // Scroll to the bottom
  //     socket.emit('chat', message); // Emit the message to the server
  //   }
  // };

  sendMessageButton.onclick = () => {
  const message = chatMessageInput.value.trim();
  if (message !== '') {
    chatingArea.innerHTML += `<p><b>You:</b> ${message}</p>`;
    chatMessageInput.value = '';
    chatingArea.scrollTop = chatingArea.scrollHeight;
    socket.emit('chat', { message, username }); // send username too
  }
};

  // Receive chat message
  // socket.on('chat', (data) => {
  //   const { message, userId } = data;
  //   chatingArea.innerHTML += `<p><b>${userId}:</b> ${message}</p>`;
  //   chatingArea.scrollTop = chatingArea.scrollHeight; // Scroll to the bottom
    
  // });
socket.on('chat', (data) => {
  const { message, username } = data;
  chatingArea.innerHTML += `<p><b>${username}:</b> ${message}</p>`;
  chatingArea.scrollTop = chatingArea.scrollHeight;
});

  // Helper function to create and configure a new peer connection
  function createPeerConnection(userId) {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle remote track and ensure only one video box per user
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from user:', userId);

      // Check if the video element already exists
      let video = document.getElementById(`video-${userId}`);
      if (!video) {
        video = document.createElement('video');
        video.id = `video-${userId}`;
        video.srcObject = event.streams[0];
        video.autoplay = true;
        videoGrid.append(video);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to user:', userId);
        socket.emit('signal', { target: userId, signal: event.candidate });
      }
    };

    peers[userId] = peerConnection; // Store the peer connection
    return peerConnection;
  }

  //share screen
const shareScreenButton = document.getElementById('share-screen');
shareScreenButton.onclick = async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

    // Replace the video track in each peer connection
    Object.values(peers).forEach(peer => {
      const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(screenStream.getVideoTracks()[0]);
      }
    });

    // Show screen stream in local video
    const localVideo = document.getElementById('local-video');
    localVideo.srcObject = screenStream;

    // When user stops sharing, revert to camera
    screenStream.getVideoTracks()[0].onended = () => {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(cameraStream => {
          Object.values(peers).forEach(peer => {
            const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(cameraStream.getVideoTracks()[0]);
            }
          });
          localVideo.srcObject = cameraStream;
        });
    };

  } catch (err) {
    console.error('Error sharing screen:', err);
  }
};

// Mute/unmute audio
muteButton.onclick = () => {
  audioEnabled = !audioEnabled;
  localStream.getAudioTracks()[0].enabled = audioEnabled;
  muteButton.innerHTML = audioEnabled ? audioOnIcon : audioOffIcon;
};

// Stop/start video
stopVideoButton.onclick = () => {
  videoEnabled = !videoEnabled;
  localStream.getVideoTracks()[0].enabled = videoEnabled;
  stopVideoButton.innerHTML = videoEnabled ? cameraOnIcon : cameraOffIcon;
};

})();
