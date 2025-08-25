import React, { useRef, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useControls } from 'leva';

const LeftBoard = () => {
  const boardContainerRef = useRef(null);

  const participants = [
    { name: 'Alice', videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { name: 'Bob', videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { name: 'Charlie', videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { name: 'David', videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { name: 'Eve', videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { name: 'Frank', videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { name: 'Grace', videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { name: 'Hannah', videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { name: 'Ian', videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' },
    { name: 'Jane', videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  ];

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
          <div
            ref={boardContainerRef}
            className="flex flex-col gap-3 flex-1 overflow-y-auto scrollbar-hide"
          >
            {participants.map((p, i) => (
              <div
                key={i}
                className="relative rounded-xl overflow-hidden w-full min-h-[180px] bg-gray-800/90 flex items-center justify-center shadow-md"
              >
                <video
                  src={p.videoSrc}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 left-1 text-white bg-black/50 px-2 py-0.5 rounded text-sm">
                  {p.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Html>
    </group>
  );
};

export default LeftBoard;
