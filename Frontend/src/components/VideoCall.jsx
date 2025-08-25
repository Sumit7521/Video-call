import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Backend URL - handle environment variables safely
const BACKEND_URL = (() => {
  // For Vite (recommended)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
  }
  
  // For Create React App
  if (typeof window !== 'undefined' && window.env) {
    return window.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';
  }
  
  // Fallback
  return 'http://localhost:3000';
})();

const VideoCall = () => {
  const [socket, setSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [roomId, setRoomId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [showMeetingEntry, setShowMeetingEntry] = useState(true);
  const [username, setUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [meetingIdInput, setMeetingIdInput] = useState('');
  const [pinnedVideo, setPinnedVideo] = useState(null);
  const [hoveredVideo, setHoveredVideo] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  const videoGridRef = useRef(null);
  const localVideoRef = useRef(null);
  const chatAreaRef = useRef(null);
  const peersRef = useRef({});

  // Icons as components
  const CameraOnIcon = () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </svg>
  );

  const CameraOffIcon = () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M1 1l22 22" />
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </svg>
  );

  const AudioOnIcon = () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
  );

  const AudioOffIcon = () => (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M9 9v3a3 3 0 0 0 6 0v-1" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  const PinIcon = () => (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
    </svg>
  );

  const UnpinIcon = () => (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2,5.27L3.28,4L20,20.72L18.73,22L12.8,16.07V22H11.2V16H6V14L8,12V11.27L2,5.27M16,12L18,14V16H17.82L8,6.18V4H7V2H17V4H16V12Z" />
    </svg>
  );

  // Initialize socket connection
  useEffect(() => {
    console.log('Connecting to backend:', BACKEND_URL);
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      autoConnect: true
    });

    newSocket.on('connect', () => {
      console.log('Successfully connected to backend server');
      setConnectionStatus('connected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionStatus('error');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      setConnectionStatus('disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleUserConnected = async (userId) => {
      console.log('User connected:', userId);
      if (!localStream) {
        console.log('No local stream available yet');
        return;
      }

      const peerConnection = createPeerConnection(userId);
      
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { target: userId, signal: peerConnection.localDescription });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    };

    const handleSignal = async (data) => {
      const { signal, from } = data;

      if (!peersRef.current[from]) {
        createPeerConnection(from);
      }

      const peerConnection = peersRef.current[from];

      try {
        if (signal.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(signal));
        } else if (signal.type === 'offer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit('signal', { target: from, signal: peerConnection.localDescription });
        } else if (signal.type === 'answer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        }
      } catch (error) {
        console.error('Error handling signal:', error);
      }
    };

    const handleUserDisconnected = (userId) => {
      console.log('User disconnected:', userId);
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      setPeers(prevPeers => {
        const newPeers = { ...prevPeers };
        delete newPeers[userId];
        return newPeers;
      });
      if (pinnedVideo === userId) {
        setPinnedVideo(null);
      }
    };

    const handleChatReceived = (data) => {
      const { message, username } = data;
      setChatMessages(prev => [...prev, { username, message, isOwn: false }]);
      setTimeout(() => {
        if (chatAreaRef.current) {
          chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
      }, 100);
    };

    socket.on('user-connected', handleUserConnected);
    socket.on('signal', handleSignal);
    socket.on('user-disconnected', handleUserDisconnected);
    socket.on('chat', handleChatReceived);

    return () => {
      socket.off('user-connected');
      socket.off('signal');
      socket.off('user-disconnected');
      socket.off('chat');
    };
  }, [socket, localStream, pinnedVideo]);

  const createPeerConnection = (userId) => {
    console.log('Creating peer connection for:', userId);
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
    });

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
        console.log('Added local track:', track.kind);
      });
    }

    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from user:', userId);
      const [remoteStream] = event.streams;
      setPeers(prevPeers => ({
        ...prevPeers,
        [userId]: { ...prevPeers[userId], stream: remoteStream }
      }));
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', { target: userId, signal: event.candidate });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state for ${userId}:`, peerConnection.connectionState);
    };

    peersRef.current[userId] = peerConnection;
    setPeers(prevPeers => ({
      ...prevPeers,
      [userId]: { connection: peerConnection, stream: null }
    }));

    return peerConnection;
  };

  const startMeeting = async (meetingId = roomId) => {
    const idToUse = meetingId || roomId;
    if (!idToUse.trim()) {
      alert('Please enter a valid Meeting ID.');
      return false;
    }

    try {
      console.log('Starting meeting with room ID:', idToUse);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true 
      });
      setLocalStream(stream);
      
      setTimeout(() => {
        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
          console.log('Local video stream set');
        }
      }, 100);

      socket.emit('join-room', idToUse);
      setShowMeetingEntry(false);
      console.log('Joined room:', idToUse);
      return true;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Error accessing camera/microphone. Please ensure permissions are granted.');
      return false;
    }
  };

  const createMeeting = async () => {
    const newRoomId = 'meet-' + Math.random().toString(36).substring(2, 9);
    setRoomId(newRoomId);
    setMeetingIdInput(newRoomId);
    setIsHost(true);
    console.log('Created meeting with ID:', newRoomId);
    
    const result = await startMeeting(newRoomId);
    if (!result) {
      alert('Failed to start the meeting. Please try again.');
    }
  };

  const joinMeeting = async () => {
    const trimmedId = meetingIdInput.trim();
    if (!trimmedId) {
      alert('Please enter a valid Meeting ID.');
      return;
    }

    try {
      console.log(`Checking room existence at: ${BACKEND_URL}/api/meet/check-room/${trimmedId}`);
      const response = await fetch(`${BACKEND_URL}/api/meet/check-room/${trimmedId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Room check response:', data);
      
      if (!data.exists) {
        alert('Room ID does not exist. Please check the Meeting ID or create a new meeting.');
        return;
      }
      
      setIsHost(false);
      const result = await startMeeting(trimmedId);
      if (result) {
        console.log('Successfully joined the meeting');
        setRoomId(trimmedId);
      } else {
        alert('Failed to join the meeting. Please try again.');
      }
    } catch (error) {
      console.error('Error checking room existence:', error);
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert(`Cannot connect to the server at ${BACKEND_URL}. Please check if the backend server is running.`);
      } else {
        alert(`Error: ${error.message}. Please try again.`);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      
      Object.values(peersRef.current).forEach(peer => {
        const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenStream.getVideoTracks()[0]);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      screenStream.getVideoTracks()[0].onended = async () => {
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          Object.values(peersRef.current).forEach(peer => {
            const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(cameraStream.getVideoTracks()[0]);
            }
          });
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = cameraStream;
          }
          setLocalStream(cameraStream);
        } catch (error) {
          console.error('Error reverting to camera:', error);
        }
      };
    } catch (error) {
      console.error('Error sharing screen:', error);
      alert('Screen sharing failed. Please try again.');
    }
  };

  const leaveMeeting = () => {
    if (socket) {
      socket.emit('leave-room');
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    Object.values(peersRef.current).forEach(peer => {
      peer.close();
    });
    
    setLocalStream(null);
    setPeers({});
    peersRef.current = {};
    setChatMessages([]);
    setPinnedVideo(null);
    setShowMeetingEntry(true);
    setMeetingIdInput('');
    setRoomId('');
    console.log('Left the meeting and cleared resources.');
  };

  const sendMessage = () => {
    if (chatMessage.trim() !== '' && socket) {
      setChatMessages(prev => [...prev, { username: 'You', message: chatMessage, isOwn: true }]);
      socket.emit('chat', { message: chatMessage, username });
      setChatMessage('');
      setTimeout(() => {
        if (chatAreaRef.current) {
          chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const submitUsername = () => {
    if (username.trim()) {
      setShowUsernameModal(false);
    } else {
      alert("Username is required to join the meeting.");
    }
  };

  const handlePinVideo = (videoId) => {
    setPinnedVideo(videoId === pinnedVideo ? null : videoId);
  };

  const copyMeetingId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      alert('Meeting ID copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = roomId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Meeting ID copied to clipboard!');
    }
  };

  // Get all participants
  const getAllParticipants = () => {
    const participants = [
      { id: 'local', name: `You (${username})`, stream: localStream, isLocal: true }
    ];
    
    Object.entries(peers).forEach(([userId, peer]) => {
      if (peer.stream) {
        participants.push({
          id: userId,
          name: `User ${userId.substring(0, 8)}`,
          stream: peer.stream,
          isLocal: false
        });
      }
    });
    
    return participants;
  };

  const participants = getAllParticipants();
  const pinnedParticipant = participants.find(p => p.id === pinnedVideo);
  const unpinnedParticipants = participants.filter(p => p.id !== pinnedVideo);

  // Connection status indicator
  const getStatusColor = () => {
    switch(connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'disconnected': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  // Username Modal
  if (showUsernameModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 flex items-center justify-center">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-2xl font-bold text-white">VC</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Welcome to Virtual Classroom</h2>
            <p className="text-slate-400 mb-6">Please enter your name to continue.</p>
            
            {/* Connection Status */}
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-4">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
              <span>Server: {connectionStatus}</span>
            </div>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your name"
              className="w-full bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              onKeyPress={(e) => e.key === 'Enter' && submitUsername()}
            />
            <button
              onClick={submitUsername}
              disabled={connectionStatus !== 'connected'}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              {connectionStatus === 'connected' ? 'Continue' : 'Connecting...'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl">
                  <span className="text-lg font-bold text-white">VC</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Virtual Classroom</h1>
                  <p className="text-sm text-slate-400">Professional Learning Session</p>
                </div>
              </div>
            </div>
            {!showMeetingEntry && (
              <div className="flex items-center gap-3 text-sm bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
                <div className={`w-2 h-2 rounded-full animate-pulse ${getStatusColor()}`}></div>
                <span className="text-slate-300">Meeting ID: <span className="font-mono text-green-400">{roomId}</span></span>
                <button
                  onClick={copyMeetingId}
                  className="ml-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs transition-all"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Meeting Entry Modal */}
      {showMeetingEntry && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Welcome, {username}!</h2>
              <p className="text-slate-400 mb-6">Start or join a virtual classroom meeting.</p>
              
              {/* Connection Status */}
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-4">
                <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
                <span>Server: {connectionStatus}</span>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex flex-col gap-3 mb-4">
                <button
                  onClick={createMeeting}
                  disabled={connectionStatus !== 'connected'}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center shadow-lg"
                >
                  <svg className="h-5 w-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  Create New Meeting (Host)
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={meetingIdInput}
                  onChange={(e) => setMeetingIdInput(e.target.value)}
                  placeholder="Enter Meeting ID to Join"
                  className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  onKeyPress={(e) => e.key === 'Enter' && joinMeeting()}
                />
                <button
                  onClick={joinMeeting}
                  disabled={connectionStatus !== 'connected'}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center shadow-lg"
                >
                  <CameraOnIcon />
                  <span className="ml-2">Join Meeting</span>
                </button>
              </div>
              {isHost && roomId && (
                <div className="text-center bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <p className="text-slate-400 text-sm mb-2">Meeting ID:</p>
                  <p className="text-slate-100 font-mono text-lg bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent font-bold mb-4">{roomId}</p>
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">Meeting ready</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!showMeetingEntry && (
        <>
          <main className="flex-1 flex gap-6 p-6 pb-32 flex-col lg:flex-row">
            {/* Video Section */}
            <div className="flex-1">
              {/* Pinned Video */}
              {pinnedParticipant && (
                <div className="mb-6">
                  <div 
                    className="relative group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                    onMouseEnter={() => setHoveredVideo(pinnedParticipant.id)}
                    onMouseLeave={() => setHoveredVideo(null)}
                  >
                    {pinnedParticipant.isLocal ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-96 object-cover"
                      />
                    ) : (
                      <video
                        autoPlay
                        playsInline
                        className="w-full h-96 object-cover"
                        ref={(el) => {
                          if (el && pinnedParticipant.stream) {
                            el.srcObject = pinnedParticipant.stream;
                          }
                        }}
                      />
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent">
                      <div className="absolute bottom-4 left-4 flex items-center gap-2">
                        <div className="bg-black/70 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full border border-white/20">
                          {pinnedParticipant.name}
                        </div>
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      </div>
                      
                      {hoveredVideo === pinnedParticipant.id && (
                        <button
                          onClick={() => handlePinVideo(pinnedParticipant.id)}
                          className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm hover:bg-red-600/80 text-white p-2 rounded-full transition-all duration-300 transform hover:scale-110 border border-white/20"
                          title="Unpin video"
                        >
                          <UnpinIcon />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Video Grid */}
              <div ref={videoGridRef} className={`grid gap-4 ${
                unpinnedParticipants.length === 1 ? 'grid-cols-1' :
                unpinnedParticipants.length === 2 ? 'grid-cols-2' :
                unpinnedParticipants.length <= 4 ? 'grid-cols-2' :
                unpinnedParticipants.length <= 6 ? 'grid-cols-3' :
                'grid-cols-4'
              }`}>
                {unpinnedParticipants.map((participant) => (
                  <div 
                    key={participant.id}
                    className="relative group bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg border border-white/10 transition-all duration-300 hover:border-white/30"
                    onMouseEnter={() => setHoveredVideo(participant.id)}
                    onMouseLeave={() => setHoveredVideo(null)}
                  >
                    {participant.isLocal ? (
                      <video
                        ref={participant.id === 'local' ? localVideoRef : null}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <video
                        autoPlay
                        playsInline
                        className="w-full h-48 object-cover"
                        ref={(el) => {
                          if (el && participant.stream) {
                            el.srcObject = participant.stream;
                          }
                        }}
                      />
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent">
                      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full border border-white/20">
                        {participant.name}
                      </div>
                      
                      {hoveredVideo === participant.id && (
                        <button
                          onClick={() => handlePinVideo(participant.id)}
                          className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm hover:bg-blue-600/80 text-white p-2 rounded-full transition-all duration-300 transform hover:scale-110 border border-white/20"
                          title="Pin video"
                        >
                          <PinIcon />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Enhanced Chat Panel */}
            <div className="w-full lg:w-80">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl h-96 lg:h-full flex flex-col">
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Chat</h3>
                </div>

                <div ref={chatAreaRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{maxHeight: '250px'}}>
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-8">
                      <svg className="h-8 w-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                      </svg>
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => (
                      <div key={index} className={`text-sm p-3 rounded-xl backdrop-blur-sm border ${
                        msg.isOwn 
                          ? 'bg-blue-600/20 border-blue-400/30 text-blue-100 ml-4' 
                          : 'bg-slate-700/30 border-white/10 text-slate-200 mr-4'
                      }`}>
                        <div className="font-semibold text-xs opacity-70 mb-1">{msg.username}</div>
                        <div>{msg.message}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="flex-1 bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!chatMessage.trim()}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* Enhanced Fixed Bottom Controls */}
          <div className="fixed bottom-0 left-0 right-0 bg-black/20 backdrop-blur-xl border-t border-white/10">
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {/* Mute Button */}
                <button
                  onClick={toggleAudio}
                  className={`px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 shadow-xl backdrop-blur-sm border border-white/20 ${
                    audioEnabled 
                      ? 'bg-white/10 hover:bg-white/20 text-slate-100' 
                      : 'bg-red-600/90 hover:bg-red-700/90 text-white'
                  }`}
                >
                  {audioEnabled ? <AudioOnIcon /> : <AudioOffIcon />}
                  {audioEnabled ? 'Mute' : 'Unmute'}
                </button>

                {/* Video Button */}
                <button
                  onClick={toggleVideo}
                  className={`px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 shadow-xl backdrop-blur-sm border border-white/20 ${
                    videoEnabled 
                      ? 'bg-white/10 hover:bg-white/20 text-slate-100' 
                      : 'bg-orange-600/90 hover:bg-orange-700/90 text-white'
                  }`}
                >
                  {videoEnabled ? <CameraOnIcon /> : <CameraOffIcon />}
                  {videoEnabled ? 'Stop Video' : 'Start Video'}
                </button>

                {/* Share Screen Button */}
                <button
                  onClick={shareScreen}
                  className="bg-white/10 hover:bg-purple-600/80 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 shadow-xl backdrop-blur-sm border border-white/20 text-slate-100"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  Share Screen
                </button>

                {/* Participants Count */}
                <div className="bg-white/10 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/20 text-slate-100 font-medium">
                  <svg className="h-5 w-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  {participants.length} Participant{participants.length !== 1 ? 's' : ''}
                </div>

                {/* Leave Button */}
                <button
                  onClick={leaveMeeting}
                  className="bg-red-600/90 hover:bg-red-700/90 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 shadow-xl backdrop-blur-sm border border-red-500/30 text-white"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16,17 21,12 16,7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Leave
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoCall;