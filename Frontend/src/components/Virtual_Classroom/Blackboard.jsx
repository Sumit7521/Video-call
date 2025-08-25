import { useEffect, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const Blackboard = () => {
  const { nodes } = useGLTF('/models/Classroom.glb');
  const [videoTexture, setVideoTexture] = useState(null);
  const planeRef = useRef();

  useEffect(() => {
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      video.srcObject = stream;
      video.play();

      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.format = THREE.RGBFormat;
      texture.colorSpace = THREE.SRGBColorSpace;

      setVideoTexture(texture);
    });
  }, []);

  if (!nodes?.Blackboard || !videoTexture) return null;

  const blackboard = nodes.Blackboard.clone();
  const box = new THREE.Box3().setFromObject(blackboard);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  return (
    <mesh
      ref={planeRef}
      position={[
        center.x + 0.75,
        center.y + 8.08,
        center.z - 14.29,
      ]}
      scale={[5, 5.07, 1.5]}
    >
      <planeGeometry args={[size.x, size.y]} />
      <meshBasicMaterial
        map={videoTexture}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
};

export default Blackboard;
