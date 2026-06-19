'use client';
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Trail, Float } from '@react-three/drei';

function BrainCore() {
  const meshRef = useRef<any>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.08) * 0.15;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.1} floatIntensity={0.3}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial
          color="#d4a853"
          emissive="#f5b042"
          emissiveIntensity={0.5}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>
    </Float>
  );
}

function OrbitingNode({
  color,
  speed,
  offset,
  radius = 2.5,
  yRange = 0.5,
}: {
  color: string;
  speed: number;
  offset: number;
  radius?: number;
  yRange?: number;
}) {
  const ref = useRef<any>(null);

  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.elapsedTime * speed + offset;
      ref.current.position.x = Math.cos(t) * radius;
      ref.current.position.z = Math.sin(t) * radius;
      ref.current.position.y = Math.sin(t * 0.7) * yRange;
      ref.current.rotation.x = state.clock.elapsedTime * 0.5;
      ref.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <Trail width={0.08} length={6} color={color} attenuation={(t) => t * t}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </Trail>
  );
}

function Particles() {
  const count = 80;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 8;
    }
    return pos;
  }, []);

  const ref = useRef<any>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#d4a853"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

export default function NeuralBrainScene() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 1, 5], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={0.8} />
        <pointLight position={[-5, -3, -5]} intensity={0.3} color="#f5b042" />
        <BrainCore />
        <OrbitingNode color="#2DD4BF" speed={0.4} offset={0} radius={2.8} yRange={0.6} />
        <OrbitingNode color="#25D366" speed={0.5} offset={Math.PI * 0.7} radius={2.2} yRange={0.4} />
        <OrbitingNode color="#F59E0B" speed={0.35} offset={Math.PI * 1.4} radius={3.0} yRange={0.7} />
        <Particles />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.8}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 2.2}
        />
      </Canvas>
    </div>
  );
}
