import React, { useState, useRef, useEffect } from 'react';
import { Html } from '@react-three/drei';

const RightBoard = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const chatContainerRef = useRef(null);
  const username = "You";

  // Auto scroll to bottom whenever messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    setMessages(prev => [...prev, { username, message: newMessage.trim() }]);
    setNewMessage("");
  };

  // Fixed board position & scale
  const posX = 11.7;
  const posY = 8.2;
  const posZ = -18.1;
  const scaleX = 1.0;
  const scaleY = 2.3;

  const baseWidth = 2.2;
  const baseHeight = 1.4;
  const scaledWidth = baseWidth * scaleX;
  const scaledHeight = baseHeight * scaleY;
  const htmlOffsetY = scaledHeight / 2 + 0.5;

  return (
    <group position={[posX, posY, posZ]} rotation={[0, 0, 0]}>
      <Html
        position={[0, htmlOffsetY, 0]}
        transform
        scaleFactor={1}
        sprite={false}
        style={{ pointerEvents: 'auto', width: `${scaledWidth * 100}px`, height: `${scaledHeight * 100}px` }}
      >
        <div className="w-full h-full bg-gray-900/90 rounded-xl flex flex-col p-2 font-sans">
          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex flex-col gap-2 flex-1 overflow-y-auto scrollbar-hide mb-2"
          >
            {messages.length === 0 ? (
              <div className="text-gray-400 italic text-center py-5">
                Start the conversation!
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className="px-3 py-2 bg-gray-800 rounded-lg text-white text-sm shadow-sm break-words"
                >
                  <strong className="text-blue-500 mr-1">{msg.username}:</strong>
                  {msg.message}
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="flex gap-0 flex-shrink-0 w-full">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 rounded-l-lg w-[75%] bg-gray-800 text-white text-sm focus:outline-none"
            />
            <button
              onClick={handleSend}
              className="px-1 py-2 rounded-r-lg w-[25%] bg-blue-500 text-white text-sm cursor-pointer"
            >
              Send
            </button>
          </div>
        </div>
      </Html>
    </group>
  );
};

export default RightBoard;
