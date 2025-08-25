import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { useControls } from 'leva';
import Classroom from './Classroom';
import Blackboard from './Blackboard';
import RightBoard from './RightBoard';
import { useRef } from 'react';
import LeftBoard from './LeftBoard';

const CameraController = () => {
  const { camera } = useThree();

  // Only Leva for Y-axis rotation
  const { rotY } = useControls('Camera', {
    rotY: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 },
  });

  useFrame(() => {
    // Keep fixed position
    camera.position.set(-1, 7.4, 9);
    // Only Y-axis rotation
    camera.rotation.set(0, rotY, 0);
  });

  return null;
};

const Scene = () => {
  const controlsRef = useRef();

  return (
    <Canvas camera={{ position: [-1, 7.4, 9], fov: 50 }}>
      <ambientLight intensity={1} />
      <Environment preset="sunset" />

      <CameraController />
      <Classroom />
      <Blackboard />
      <RightBoard />
      <LeftBoard />

      {/* OrbitControls for pan & zoom only */}
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={false} // rotation controlled by Leva
      />
    </Canvas>
  );
};

export default Scene;
