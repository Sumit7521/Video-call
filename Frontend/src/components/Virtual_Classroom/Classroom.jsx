// components/Classroom.jsx
import { useGLTF } from '@react-three/drei';

const Classroom = () => {
  const { scene } = useGLTF('/models/Classroom.glb');
  return (
    <primitive
      object={scene}
      scale={[5, 5, 5]} // Adjust these values as needed
    />
  );
};

export default Classroom;
