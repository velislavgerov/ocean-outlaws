import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGameState } from '../game/state/useGameState';

function PlayerShip() {
  var ref = useRef();
  var player = useGameState(function (state) { return state.combat.player; });

  useFrame(function (state) {
    var t = state.clock.getElapsedTime();
    if (!ref.current) {
      return;
    }

    ref.current.position.x = player.x;
    ref.current.position.y = Math.sin(t * 2) * 0.05 + 0.15;
    ref.current.position.z = player.z;
    ref.current.rotation.y = player.rot;
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.9, 0.24, 1.7]} />
      <meshStandardMaterial color="#8B5A2B" />
    </mesh>
  );
}

function EnemyFleet() {
  var enemies = useGameState(function (state) { return state.combat.enemies; });

  return (
    <>
      {enemies.map(function (enemy) {
        return (
          <mesh key={enemy.id} position={[enemy.x, 0.15, enemy.z]} rotation={[0, enemy.rot || 0, 0]}>
            <boxGeometry args={[0.8, 0.2, 1.3]} />
            <meshStandardMaterial color="#8f2d2d" />
          </mesh>
        );
      })}
    </>
  );
}

function Projectiles() {
  var projectiles = useGameState(function (state) { return state.combat.projectiles; });

  return (
    <>
      {projectiles.map(function (shot) {
        return (
          <mesh key={shot.id} position={[shot.x, 0.2, shot.z]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#ffd166" emissive="#ffbf00" emissiveIntensity={0.8} />
          </mesh>
        );
      })}
    </>
  );
}

function OceanPlane() {
  var ref = useRef();

  useFrame(function (state) {
    if (!ref.current) {
      return;
    }

    ref.current.material.opacity = 0.9 + Math.sin(state.clock.getElapsedTime() * 1.2) * 0.05;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[80, 80, 60, 60]} />
      <meshStandardMaterial color="#0f4d86" transparent />
    </mesh>
  );
}

function CameraRig() {
  var player = useGameState(function (state) { return state.combat.player; });

  useFrame(function (state) {
    var cam = state.camera;
    cam.position.x += (player.x - cam.position.x) * 0.06;
    cam.position.y += (2.5 - cam.position.y) * 0.06;
    cam.position.z += ((player.z + 4.2) - cam.position.z) * 0.06;
    cam.lookAt(player.x, 0, player.z - 0.3);
  });

  return null;
}

export default function OceanScene() {
  return (
    <Canvas camera={{ position: [0, 2.4, 4.2], fov: 55 }}>
      <color attach="background" args={['#001B2E']} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 7, 2]} intensity={1.2} />
      <OceanPlane />
      <PlayerShip />
      <EnemyFleet />
      <Projectiles />
      <CameraRig />
    </Canvas>
  );
}
