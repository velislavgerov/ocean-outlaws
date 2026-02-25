import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { useGameState } from '../game/state/useGameState';

var DISPLAY_SCALE = 3.2;

function sampleWave(x, z, t) {
  var h = 0;
  h += Math.sin((x * 0.18) + (t * 1.1)) * 0.34;
  h += Math.cos((z * 0.14) - (t * 0.9)) * 0.28;
  h += Math.sin((x * 0.35) + (z * 0.26) + (t * 1.4)) * 0.14;
  return h;
}

function OceanSurface() {
  var meshRef = useRef();
  var frameRef = useRef(0);
  var geometryData = useMemo(function () {
    var geometry = new THREE.PlaneGeometry(180, 180, 38, 38);
    var base = new Float32Array(geometry.attributes.position.array);
    return {
      geometry: geometry,
      base: base,
      normalTick: 0
    };
  }, []);

  useFrame(function (state) {
    var mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    frameRef.current += 1;
    if (frameRef.current % 2 !== 0) {
      return;
    }

    var t = state.clock.getElapsedTime();
    var pos = geometryData.geometry.attributes.position;
    var arr = pos.array;
    var base = geometryData.base;

    for (var i = 0; i < arr.length; i += 3) {
      var x = base[i];
      var z = base[i + 1];
      arr[i + 2] = sampleWave(x, z, t);
    }

    pos.needsUpdate = true;
    geometryData.normalTick += 1;
    if (geometryData.normalTick % 5 === 0) {
      geometryData.geometry.computeVertexNormals();
    }
  });

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometryData.geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.3, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#0e4f86" roughness={0.88} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
        <planeGeometry args={[260, 260, 1, 1]} />
        <meshBasicMaterial color="#092f59" />
      </mesh>
    </>
  );
}

function PlayerShip() {
  var shipRef = useRef();
  var wakeRef = useRef();

  useFrame(function (state) {
    var ship = shipRef.current;
    if (!ship) {
      return;
    }

    var player = useGameState.getState().combat.player;
    var t = state.clock.getElapsedTime();
    var sampleDist = 0.75;

    var px = player.x * DISPLAY_SCALE;
    var pz = player.z * DISPLAY_SCALE;
    var waveY = sampleWave(px, pz, t);
    var waveFore = sampleWave(
      px + Math.sin(player.rot) * sampleDist,
      pz + Math.cos(player.rot) * sampleDist,
      t
    );
    var waveAft = sampleWave(
      px - Math.sin(player.rot) * sampleDist,
      pz - Math.cos(player.rot) * sampleDist,
      t
    );
    var wavePort = sampleWave(
      px + Math.cos(player.rot) * sampleDist,
      pz - Math.sin(player.rot) * sampleDist,
      t
    );
    var waveStbd = sampleWave(
      px - Math.cos(player.rot) * sampleDist,
      pz + Math.sin(player.rot) * sampleDist,
      t
    );

    var targetPitch = (waveFore - waveAft) * 0.08;
    var targetRoll = (wavePort - waveStbd) * 0.09;

    ship.position.set(px, waveY + 0.22, pz);
    ship.rotation.y = player.rot;
    ship.rotation.x = THREE.MathUtils.lerp(ship.rotation.x, targetPitch, 0.16);
    ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, targetRoll, 0.16);

    var wake = wakeRef.current;
    if (wake) {
      var speed = Math.abs(player.speed || 0);
      wake.position.set(
        px - Math.sin(player.rot) * 0.95,
        waveY + 0.03,
        pz - Math.cos(player.rot) * 0.95
      );
      wake.rotation.x = -Math.PI / 2;
      wake.scale.setScalar(0.65 + Math.min(0.65, speed * 0.1));
      wake.material.opacity = 0.15 + Math.min(0.35, speed * 0.04);
    }
  });

  return (
    <group ref={shipRef}>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.62, 0.16, 1.35]} />
        <meshStandardMaterial color="#e7ba5c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.24, 0.72]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.26, 0.46, 8]} />
        <meshStandardMaterial color="#f2ce75" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.3, -0.16]}>
        <boxGeometry args={[0.24, 0.16, 0.34]} />
        <meshStandardMaterial color="#143255" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh ref={wakeRef}>
        <ringGeometry args={[0.22, 0.32, 24]} />
        <meshBasicMaterial color="#c9ebff" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function WorldMarkers() {
  var markers = useMemo(function () {
    return [
      { x: -18, z: -18, c: '#78c7ff' },
      { x: -8, z: 14, c: '#6fd9a0' },
      { x: 12, z: -12, c: '#f4cf72' },
      { x: 16, z: 9, c: '#ff8b8b' },
      { x: -20, z: 2, c: '#b9a6ff' }
    ];
  }, []);

  return (
    <>
      {markers.map(function (m, idx) {
        return (
          <mesh key={idx} position={[m.x, 0.35, m.z]}>
            <cylinderGeometry args={[0.2, 0.24, 0.7, 10]} />
            <meshStandardMaterial color={m.c} />
          </mesh>
        );
      })}
    </>
  );
}

export default function OceanScene() {
  return (
    <Canvas camera={{ position: [0, 8.4, 15.8], fov: 46 }}>
      <color attach="background" args={['#07203c']} />
      <ambientLight intensity={0.85} color="#2b4162" />
      <directionalLight position={[12, 18, 8]} intensity={1.18} color="#afcfff" />
      <hemisphereLight intensity={0.28} color="#6d98ca" groundColor="#06162a" />
      <OceanSurface />
      <WorldMarkers />
      <PlayerShip />
    </Canvas>
  );
}
