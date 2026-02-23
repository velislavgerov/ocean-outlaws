import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGameState } from '../game/state/useGameState';

function PlayerShip() {
  var meshRef = useRef();
  var player = useGameState(function (state) { return state.combat.player; });

  useFrame(function (state) {
    var t = state.clock.getElapsedTime();
    if (!meshRef.current) {
      return;
    }

    meshRef.current.position.x = player.x;
    meshRef.current.position.y = Math.sin(t * 2.1) * 0.05 + 0.15;
    meshRef.current.position.z = player.z;
    meshRef.current.rotation.y = player.rot;
  });

  return (
    <group ref={meshRef}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.9, 0.24, 1.7]} />
        <meshStandardMaterial color="#8B5A2B" />
      </mesh>
      <mesh position={[0, 0.28, -0.22]}>
        <boxGeometry args={[0.24, 0.16, 0.5]} />
        <meshStandardMaterial color="#6d4c2e" />
      </mesh>
    </group>
  );
}

function EnemyFleet() {
  var enemies = useGameState(function (state) { return state.combat.enemies; });

  return (
    <>
      {enemies.map(function (enemy) {
        return (
          <group key={enemy.id} position={[enemy.x, 0.15, enemy.z]}>
            <mesh>
              <boxGeometry args={[0.8, 0.2, 1.3]} />
              <meshStandardMaterial color="#8f2d2d" />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[Math.max(0.05, enemy.hp / enemy.maxHp) * 0.9, 0.06, 0.06]} />
              <meshStandardMaterial color="#ff5c5c" />
            </mesh>
          </group>
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
            <meshStandardMaterial color="#ffd166" emissive="#ffbf00" emissiveIntensity={1} />
          </mesh>
        );
      })}
    </>
  );
}

function OceanPlane() {
  var meshRef = useRef();
  var uniforms = useMemo(function () {
    return {
      uTime: { value: 0 }
    };
  }, []);

  useFrame(function (state) {
    if (!meshRef.current) {
      return;
    }

    uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[80, 80, 128, 128]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.z += sin((p.x * 0.22) + (uTime * 1.8)) * 0.15;
            p.z += cos((p.y * 0.28) + (uTime * 1.3)) * 0.1;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          void main() {
            float wave = sin(vUv.x * 40.0) * 0.02 + cos(vUv.y * 38.0) * 0.02;
            vec3 deep = vec3(0.02, 0.20, 0.38);
            vec3 shallow = vec3(0.11, 0.45, 0.70);
            vec3 color = mix(deep, shallow, clamp(vUv.y + wave + 0.2, 0.0, 1.0));
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
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
