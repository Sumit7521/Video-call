// virtualclassroom.jsx
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Scene from '../components/Virtual_Classroom/Scene';

// Backend URL - handle environment variables safely
const BACKEND_URL = (() => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
  }
  if (typeof window !== 'undefined' && window.env) {
    return window.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';
  }
  return 'http://localhost:3000';
})();

const Virtualclassroom = () => {
  const [socket, setSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [roomId, setRoomId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [showMeetingEntry, setShowMeetingEntry] = useState(true);
  const [username, setUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(true);
  const [meetingIdInput, setMeetingIdInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [chatMessages, setChatMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  
  const peersRef = useRef({});

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
      updateParticipants();
    };

    const handleChatReceived = (data) => {
      const { message, username } = data;
      setChatMessages(prev => [...prev, { username, message, isOwn: false }]);
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
  }, [socket, localStream]);

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
      updateParticipants();
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', { target: userId, signal: event.candidate });
      }
    };

    peersRef.current[userId] = peerConnection;
    setPeers(prevPeers => ({
      ...prevPeers,
      [userId]: { connection: peerConnection, stream: null }
    }));

    return peerConnection;
  };

  const updateParticipants = () => {
    const participantList = [
      { id: 'local', name: `${username} (You)`, stream: localStream, isLocal: true }
    ];
    
    Object.entries(peers).forEach(([userId, peer]) => {
      if (peer.stream) {
        participantList.push({
          id: userId,
          name: `User ${userId.substring(0, 8)}`,
          stream: peer.stream,
          isLocal: false
        });
      }
    });
    
    setParticipants(participantList);
  };

  useEffect(() => {
    updateParticipants();
  }, [peers, localStream, username]);

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

  const sendMessage = (message) => {
    if (message.trim() !== '' && socket) {
      setChatMessages(prev => [...prev, { username: 'You', message: message, isOwn: true }]);
      socket.emit('chat', { message: message, username });
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
    setParticipants([]);
    setShowMeetingEntry(true);
    setMeetingIdInput('');
    setRoomId('');
    console.log('Left the meeting and cleared resources.');
  };

  const submitUsername = () => {
    if (username.trim()) {
      setShowUsernameModal(false);
    } else {
      alert("Username is required to join the meeting.");
    }
  };

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

  // Meeting Entry Modal
  if (showMeetingEntry) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 flex items-center justify-center">
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
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
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
    );
  }

  // Main Virtual Classroom Scene
  return (
    <div className='h-screen w-screen relative'>
      <Scene 
        participants={participants}
        chatMessages={chatMessages}
        onSendMessage={sendMessage}
        onLeaveMeeting={leaveMeeting}
        localStream={localStream}
        username={username}
        roomId={roomId}
      />
    </div>
  );
};

export default Virtualclassroom;