// LeftBoard.jsx
import React, { useRef, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useControls } from 'leva';

const LeftBoard = ({ participants = [], localStream }) => {
  const boardContainerRef = useRef(null);

  useEffect(() => {
    if (boardContainerRef.current) {
      boardContainerRef.current.scrollTop = boardContainerRef.current.scrollHeight;
    }
  }, [participants]);

  const { posX, posY, posZ, scaleX, scaleY } = useControls('LeftBoard', {
    posX: { value: -9.6, min: -20, max: 20, step: 0.1 },
    posY: { value: 8.4, min: 0, max: 20, step: 0.1 },
    posZ: { value: -18.1, min: -50, max: 5, step: 0.1 },
    scaleX: { value: 0.8, min: 0.5, max: 3, step: 0.1 },
    scaleY: { value: 1.9, min: 0.5, max: 3, step: 0.1 },
  });

  const baseWidth = 2.2;
  const baseHeight = 1.4;
  const scaledWidth = baseWidth * scaleX;
  const scaledHeight = baseHeight * scaleY;
  const htmlOffsetY = scaledHeight / 2 + 0.5;

  // Video component for rendering video streams
  const VideoElement = ({ participant }) => {
    const videoRef = useRef(null);

    useEffect(() => {
      if (videoRef.current && participant.stream) {
        videoRef.current.srcObject = participant.stream;
      }
    }, [participant.stream]);

    if (participant.isLocal && localStream) {
      return (
        <video
          ref={videoRef}
          autoPlay
          muted={true}
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }} // Mirror local video
        />
      );
    } else if (!participant.isLocal && participant.stream) {
      return (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      );
    } else {
      // Placeholder for when video is not available
      return (
        <div className="w-full h-full bg-gray-700 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="w-12 h-12 bg-gray-600 rounded-full mx-auto mb-2 flex items-center justify-center">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <p className="text-xs">No Video</p>
          </div>
        </div>
      );
    }
  };

  return (
    <group position={[posX, posY, posZ]} rotation={[0, 0, 0]}>
      <Html
        position={[0, htmlOffsetY, 0]}
        transform
        scaleFactor={1}
        sprite={false}
        style={{ pointerEvents: 'auto', width: `${scaledWidth * 120}px`, height: `${scaledHeight * 120}px` }}
      >
        <div className="w-full h-full bg-gray-900/90 rounded-xl flex flex-col p-2 box-border">
          {/* Header */}
          <div className="text-center mb-2 py-1 border-b border-gray-700">
            <h3 className="text-white text-sm font-semibold">
              Participants ({participants.length})
            </h3>
          </div>

          <div
            ref={boardContainerRef}
            className="flex flex-col gap-3 flex-1 overflow-y-auto scrollbar-hide"
          >
            {participants.length === 0 ? (
              <div className="text-gray-400 italic text-center py-5">
                Waiting for participants to join...
              </div>
            ) : (
              participants.map((participant, i) => (
                <div
                  key={participant.id || i}
                  className="relative rounded-xl overflow-hidden w-full min-h-[120px] bg-gray-800/90 flex items-center justify-center shadow-md border-2 border-gray-700"
                >
                  <VideoElement participant={participant} />
                  
                  {/* Participant name overlay */}
                  <div className="absolute bottom-1 left-1 right-1">
                    <div className="text-white bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs text-center truncate">
                      {participant.name}
                      {participant.isLocal && (
                        <span className="ml-1 text-green-400">●</span>
                      )}
                    </div>
                  </div>

                  {/* Connection status indicator */}
                  <div className="absolute top-1 right-1">
                    <div className={`w-2 h-2 rounded-full ${
                      participant.stream ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Html>
    </group>
  );
};

export default LeftBoard;