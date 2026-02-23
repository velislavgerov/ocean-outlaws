import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';

function PlayerShip() {
  var meshRef = useRef();

  useFrame(function (state) {
    var t = state.clock.getElapsedTime();

    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y = t * 0.35;
    meshRef.current.position.y = Math.sin(t * 1.8) * 0.08 + 0.15;
  });

  return (
    <mesh ref={meshRef} position={[0, 0.15, 0]}>
      <boxGeometry args={[0.7, 0.2, 1.4]} />
      <meshStandardMaterial color="#8B5A2B" />
    </mesh>
  );
}

function OceanPlane() {
  var meshRef = useRef();

  useFrame(function (state) {
    var t = state.clock.getElapsedTime();

    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.z = Math.sin(t * 0.2) * 0.01;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[30, 30, 40, 40]} />
      <meshStandardMaterial color="#0E4E8A" metalness={0.2} roughness={0.4} />
    </mesh>
  );
}

export default function OceanScene() {
  return (
    <Canvas camera={{ position: [0, 2.4, 4], fov: 55 }}>
      <color attach="background" args={['#001B2E']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 5, 2]} intensity={1.1} />
      <OceanPlane />
      <PlayerShip />
    </Canvas>
  );
}
