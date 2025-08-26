// RightBoard.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Html } from '@react-three/drei';

const RightBoard = ({ chatMessages = [], onSendMessage, username = "You" }) => {
  const [newMessage, setNewMessage] = useState("");
  const chatContainerRef = useRef(null);

  // Auto scroll to bottom whenever messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [chatMessages]);

  const handleSend = () => {
    if (!newMessage.trim() || !onSendMessage) return;
    onSendMessage(newMessage.trim());
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
          {/* Header */}
          <div className="text-center mb-2 py-1 border-b border-gray-700">
            <h3 className="text-white text-sm font-semibold">Live Chat</h3>
          </div>

          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex flex-col gap-2 flex-1 overflow-y-auto scrollbar-hide mb-2"
          >
            {chatMessages.length === 0 ? (
              <div className="text-gray-400 italic text-center py-5">
                Start the conversation!
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 rounded-lg text-sm shadow-sm break-words ${
                    msg.isOwn
                      ? 'bg-blue-600/80 text-white ml-2'
                      : 'bg-gray-800 text-white mr-2'
                  }`}
                >
                  <strong className={`mr-1 ${msg.isOwn ? 'text-blue-200' : 'text-blue-400'}`}>
                    {msg.username}:
                  </strong>
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
              className="flex-1 px-3 py-2 rounded-l-lg w-[75%] bg-gray-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              className="px-1 py-2 rounded-r-lg w-[25%] bg-blue-500 hover:bg-blue-600 text-white text-sm cursor-pointer transition-colors"
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