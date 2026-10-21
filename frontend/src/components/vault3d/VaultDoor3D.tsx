'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface VaultDoor3DProps {
  status: 'idle' | 'typing' | 'unlocking' | 'unlocked' | 'rejecting' | 'destroyed';
  typingCharCount?: number;
  failedAttempts?: number;
  onUnlockComplete?: () => void;
  className?: string;
}

export default function VaultDoor3D({
  status,
  typingCharCount = 0,
  failedAttempts = 0,
  onUnlockComplete,
  className = '',
}: VaultDoor3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    status,
    typingCharCount,
    failedAttempts,
    dialAngle: 0,
    targetDialAngle: 0,
    boltsProgress: 0, // 0 = locked, 1 = retracted
    doorOpenAngle: 0, // 0 = closed, ~ -1.55 = open
    shakeIntensity: 0,
    destructionProgress: 0,
    shockwaveRadius: 0,
    mouseX: 0,
    mouseY: 0,
  });

  // Keep ref updated with latest props
  useEffect(() => {
    stateRef.current.status = status;
    stateRef.current.failedAttempts = failedAttempts;
    if (status === 'rejecting') {
      stateRef.current.shakeIntensity = 1.4;
    }
    if (status === 'destroyed') {
      stateRef.current.shakeIntensity = 6.0;
    }
  }, [status, failedAttempts]);

  // When typing, trigger dial spin
  const prevCountRef = useRef(typingCharCount);
  useEffect(() => {
    if (typingCharCount !== prevCountRef.current) {
      const diff = typingCharCount - prevCountRef.current;
      prevCountRef.current = typingCharCount;
      stateRef.current.targetDialAngle += diff * (Math.PI / 4 + Math.random() * 0.2);
    }
  }, [typingCharCount]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene Setup ---
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06090e, 0.065);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.2);
    const defaultFov = 38;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // --- Materials (Ultra High-Spec Machined Titanium & Steel) ---
    const steelDark = new THREE.MeshStandardMaterial({
      color: 0x161a22,
      metalness: 0.92,
      roughness: 0.22,
    });

    const steelPolished = new THREE.MeshStandardMaterial({
      color: 0x2e3848,
      metalness: 0.95,
      roughness: 0.14,
    });

    const brassAccent = new THREE.MeshStandardMaterial({
      color: 0xc49b45,
      metalness: 0.88,
      roughness: 0.28,
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe6edf5,
      metalness: 0.98,
      roughness: 0.08,
    });

    const innerWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x070b12,
      metalness: 0.6,
      roughness: 0.6,
    });

    // --- Atmospheric Floating Dust Motes in 3D Space ---
    const dustCount = 80;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 8;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 6;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 5 + 1;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.04,
      color: 0x00d2ef,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // --- Lights ---
    const ambientLight = new THREE.AmbientLight(0x1e2736, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xe8f0ff, 2.8);
    keyLight.position.set(4, 5, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00d2ef, 1.8);
    rimLight.position.set(-6, -3, 3);
    scene.add(rimLight);

    // Dual Status LED Lights (Top & Bottom)
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00d2ef });
    const ledLight = new THREE.PointLight(0x00d2ef, 1.5, 5);
    ledLight.position.set(0, 1.4, 0.4);

    const bottomLedMat = new THREE.MeshBasicMaterial({ color: 0x00d2ef });
    const bottomLedLight = new THREE.PointLight(0x00d2ef, 1.5, 5);
    bottomLedLight.position.set(0, -1.4, 0.4);

    // Inner chamber glow (visible when door opens or during explosion)
    const chamberLight = new THREE.PointLight(0x10b981, 0, 14);
    chamberLight.position.set(0, 0, -0.8);
    scene.add(chamberLight);

    // Blast Flash Light (Blinding nuclear surge)
    const blastFlashLight = new THREE.PointLight(0xffeedd, 0, 25);
    blastFlashLight.position.set(0, 0, 1.8);
    scene.add(blastFlashLight);

    // Secondary Fire/Amber Blast Light
    const blastFireLight = new THREE.PointLight(0xff4400, 0, 20);
    blastFireLight.position.set(0, 0, 0.6);
    scene.add(blastFireLight);

    // --- Outer Wall & Vault Frame ---
    const frameGroup = new THREE.Group();
    scene.add(frameGroup);

    // Heavy Circular Wall Opening
    const frameTorusGeo = new THREE.TorusGeometry(2.35, 0.28, 24, 64);
    const frameTorus = new THREE.Mesh(frameTorusGeo, steelPolished);
    frameGroup.add(frameTorus);

    // Inner bevel rim
    const innerRimGeo = new THREE.TorusGeometry(2.15, 0.08, 16, 48);
    const innerRim = new THREE.Mesh(innerRimGeo, brassAccent);
    frameGroup.add(innerRim);

    // Bolt receiver notches in the outer frame
    const numBolts = 8;
    for (let i = 0; i < numBolts; i++) {
      const angle = (i * 2 * Math.PI) / numBolts;
      const notchGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16);
      const notch = new THREE.Mesh(notchGeo, steelDark);
      notch.rotation.z = angle + Math.PI / 2;
      notch.position.x = Math.cos(angle) * 2.3;
      notch.position.y = Math.sin(angle) * 2.3;
      frameGroup.add(notch);
    }

    // Back Chamber (seen inside when opened)
    const chamberBackGeo = new THREE.CylinderGeometry(2.1, 2.1, 1.4, 48, 1, true);
    const chamberBack = new THREE.Mesh(chamberBackGeo, innerWallMaterial);
    chamberBack.rotation.x = Math.PI / 2;
    chamberBack.position.z = -0.7;
    frameGroup.add(chamberBack);

    // Back wall plate inside vault
    const backWallPlateGeo = new THREE.CircleGeometry(2.1, 48);
    const backWallPlate = new THREE.Mesh(backWallPlateGeo, steelDark);
    backWallPlate.position.z = -1.4;
    frameGroup.add(backWallPlate);

    // --- Hinge & Vault Door Assembly ---
    const HINGE_X = -2.25;
    const hingeGroup = new THREE.Group();
    hingeGroup.position.set(HINGE_X, 0, 0.15);
    scene.add(hingeGroup);

    // Heavy Industrial Hinge Brackets
    const hingeBracketGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.9, 24);
    const topHinge = new THREE.Mesh(hingeBracketGeo, chromeMaterial);
    topHinge.position.set(0, 1.4, 0);
    hingeGroup.add(topHinge);

    const bottomHinge = new THREE.Mesh(hingeBracketGeo, chromeMaterial);
    bottomHinge.position.set(0, -1.4, 0);
    hingeGroup.add(bottomHinge);

    // Door Sub-Group
    const doorGroup = new THREE.Group();
    doorGroup.position.set(-HINGE_X, 0, 0);
    hingeGroup.add(doorGroup);

    // Main Door Disc
    const doorPlateGeo = new THREE.CylinderGeometry(2.1, 2.15, 0.38, 64);
    doorPlateGeo.rotateX(Math.PI / 2);
    const doorPlate = new THREE.Mesh(doorPlateGeo, steelDark);
    doorGroup.add(doorPlate);

    // Front Bevel Ring
    const frontRingGeo = new THREE.TorusGeometry(1.9, 0.1, 16, 64);
    const frontRing = new THREE.Mesh(frontRingGeo, steelPolished);
    frontRing.position.z = 0.2;
    doorGroup.add(frontRing);

    // Peripheral Hex Rivets
    const rivetGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8);
    rivetGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 24; i++) {
      const angle = (i * 2 * Math.PI) / 24;
      const rivet = new THREE.Mesh(rivetGeo, chromeMaterial);
      rivet.position.set(Math.cos(angle) * 1.88, Math.sin(angle) * 1.88, 0.21);
      doorGroup.add(rivet);
    }

    // --- Locking Bolts (8 Radial Bolts with independent physics on blast) ---
    const boltBaseDist = 1.95;
    const boltRetractedDist = 1.58;
    const boltGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.6, 20);

    interface BoltData {
      mesh: THREE.Mesh;
      baseAngle: number;
      blastVelocity: THREE.Vector3;
      blastRotVelocity: THREE.Vector3;
    }
    const boltsData: BoltData[] = [];

    for (let i = 0; i < numBolts; i++) {
      const angle = (i * 2 * Math.PI) / numBolts;
      const bolt = new THREE.Mesh(boltGeo, chromeMaterial.clone());
      bolt.rotation.z = angle + Math.PI / 2;
      bolt.position.set(Math.cos(angle) * boltBaseDist, Math.sin(angle) * boltBaseDist, 0);
      doorGroup.add(bolt);

      // Random high-speed trajectory when ejected in blast
      const blastSpeed = 8.0 + Math.random() * 9.0;
      const blastVelocity = new THREE.Vector3(
        Math.cos(angle) * blastSpeed,
        Math.sin(angle) * blastSpeed + Math.random() * 2.0,
        Math.random() * 6.0 + 3.0
      );
      const blastRotVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22
      );
      boltsData.push({ mesh: bolt, baseAngle: angle, blastVelocity, blastRotVelocity });
    }

    // --- Central Combination Dial Mechanism ---
    const dialGroup = new THREE.Group();
    dialGroup.position.set(0, 0, 0.22);
    doorGroup.add(dialGroup);

    // Dial Base Ring
    const dialBaseGeo = new THREE.CylinderGeometry(0.9, 0.95, 0.12, 48);
    dialBaseGeo.rotateX(Math.PI / 2);
    const dialBase = new THREE.Mesh(dialBaseGeo, brassAccent);
    dialGroup.add(dialBase);

    // Graduation Dial Face
    const dialFaceGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.06, 48);
    dialFaceGeo.rotateX(Math.PI / 2);
    const dialFace = new THREE.Mesh(dialFaceGeo, steelPolished);
    dialFace.position.z = 0.06;
    dialGroup.add(dialFace);

    // Dial Knurled Knob
    const knobGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.2, 32);
    knobGeo.rotateX(Math.PI / 2);
    const knob = new THREE.Mesh(knobGeo, chromeMaterial);
    knob.position.z = 0.16;
    dialGroup.add(knob);

    // Graduation tick marks on dial
    const tickGeo = new THREE.BoxGeometry(0.02, 0.08, 0.02);
    for (let i = 0; i < 40; i++) {
      const angle = (i * 2 * Math.PI) / 40;
      const isMajor = i % 5 === 0;
      const tick = new THREE.Mesh(
        isMajor ? new THREE.BoxGeometry(0.03, 0.12, 0.03) : tickGeo,
        isMajor ? brassAccent : chromeMaterial
      );
      tick.rotation.z = angle;
      tick.position.set(Math.cos(angle) * 0.68, Math.sin(angle) * 0.68, 0.1);
      dialGroup.add(tick);
    }

    // --- Heavy 3-Spoke Turning Helm / Steering Wheel ---
    const helmGroup = new THREE.Group();
    helmGroup.position.set(0, 0, 0.4);
    doorGroup.add(helmGroup);

    // Center Hub
    const helmHubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.15, 24);
    helmHubGeo.rotateX(Math.PI / 2);
    const helmHub = new THREE.Mesh(helmHubGeo, chromeMaterial);
    helmGroup.add(helmHub);

    // 3 Radial Spokes with handles (break apart independently on blast)
    interface SpokeData {
      spokeMesh: THREE.Mesh;
      handleMesh: THREE.Mesh;
      baseAngle: number;
      blastVelocity: THREE.Vector3;
      blastRot: THREE.Vector3;
    }
    const spokesData: SpokeData[] = [];

    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      const spokeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.85, 16);
      const spoke = new THREE.Mesh(spokeGeo, chromeMaterial.clone());
      spoke.rotation.z = angle + Math.PI / 2;
      spoke.position.set(Math.cos(angle) * 0.42, Math.sin(angle) * 0.42, 0);
      helmGroup.add(spoke);

      // Handle grip
      const handleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.25, 16);
      handleGeo.rotateX(Math.PI / 2);
      const handle = new THREE.Mesh(handleGeo, brassAccent.clone());
      handle.position.set(Math.cos(angle) * 0.88, Math.sin(angle) * 0.88, 0.05);
      helmGroup.add(handle);

      const spokeVel = new THREE.Vector3(
        Math.cos(angle) * (6.0 + Math.random() * 5),
        Math.sin(angle) * (6.0 + Math.random() * 5) + 2.0,
        Math.random() * 6.0 + 3.0
      );
      const spokeRot = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      );
      spokesData.push({ spokeMesh: spoke, handleMesh: handle, baseAngle: angle, blastVelocity: spokeVel, blastRot: spokeRot });
    }

    // --- Status LED Indicators (Top & Bottom) ---
    const ledHousingGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.1, 16);
    ledHousingGeo.rotateX(Math.PI / 2);

    // Top LED Mount
    const topLedHousing = new THREE.Mesh(ledHousingGeo, chromeMaterial);
    topLedHousing.position.set(0, 1.4, 0.22);
    doorGroup.add(topLedHousing);

    const topLedBulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), ledMat);
    topLedBulb.position.set(0, 1.4, 0.28);
    doorGroup.add(topLedBulb);
    doorGroup.add(ledLight);

    // Bottom LED Mount
    const bottomLedHousing = new THREE.Mesh(ledHousingGeo, chromeMaterial);
    bottomLedHousing.position.set(0, -1.4, 0.22);
    doorGroup.add(bottomLedHousing);

    const bottomLedBulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), bottomLedMat);
    bottomLedBulb.position.set(0, -1.4, 0.28);
    doorGroup.add(bottomLedBulb);
    doorGroup.add(bottomLedLight);

    // =========================================================================
    // EPIC CATASTROPHIC VAULT BLAST SYSTEM (MULTI-TIERED VISCERAL EXPLOSION)
    // =========================================================================

    // 1. Central Expanding Plasma Fireball Sphere (3D Fiery Core)
    const fireballGeo = new THREE.IcosahedronGeometry(0.6, 3);
    const fireballMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const fireballMesh = new THREE.Mesh(fireballGeo, fireballMat);
    fireballMesh.position.set(0, 0, 0.4);
    scene.add(fireballMesh);

    // 2. Triple Supersonic Shockwave Waves (Concentric High-Speed Rings)
    const shockwaveMat1 = new THREE.MeshBasicMaterial({
      color: 0xffeedd,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const shockwave1 = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.35, 48), shockwaveMat1);
    shockwave1.position.set(0, 0, 0.6);
    scene.add(shockwave1);

    const shockwaveMat2 = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const shockwave2 = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.6, 48), shockwaveMat2);
    shockwave2.position.set(0, 0, 0.5);
    shockwave2.rotation.z = Math.PI / 4;
    scene.add(shockwave2);

    const shockwaveMat3 = new THREE.MeshBasicMaterial({
      color: 0xff1100,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const shockwave3 = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.9, 48), shockwaveMat3);
    shockwave3.position.set(0, 0, 0.3);
    scene.add(shockwave3);

    // 3. High-Velocity Sparks & Molten Titanium Slag (1,000 Sparks)
    const sparkCount = 1000;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);
    const sparkColors = new Float32Array(sparkCount * 3);

    for (let i = 0; i < sparkCount; i++) {
      sparkPositions[i * 3] = (Math.random() - 0.5) * 0.6;
      sparkPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
      sparkPositions[i * 3 + 2] = 0.3;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 5.0 + Math.random() * 12.0;
      sparkVelocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      sparkVelocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      sparkVelocities[i * 3 + 2] = Math.abs(Math.cos(phi)) * speed + 3.0;

      // Incandescent gradient: White-hot to fiery amber/red
      const isWhiteHot = Math.random() > 0.65;
      sparkColors[i * 3] = 1.0;
      sparkColors[i * 3 + 1] = isWhiteHot ? 0.95 : 0.35 + Math.random() * 0.45;
      sparkColors[i * 3 + 2] = isWhiteHot ? 0.8 : 0.05;
    }

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));

    const sparkMat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkPoints);

    // 4. Dense Volumetric Smoke Clouds (500 Billowing Particles)
    const smokeCount = 500;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeVelocities = new Float32Array(smokeCount * 3);
    const smokeColors = new Float32Array(smokeCount * 3);

    for (let i = 0; i < smokeCount; i++) {
      smokePositions[i * 3] = (Math.random() - 0.5) * 0.5;
      smokePositions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      smokePositions[i * 3 + 2] = 0.2;

      smokeVelocities[i * 3] = (Math.random() - 0.5) * 4.0;
      smokeVelocities[i * 3 + 1] = Math.random() * 4.5 + 1.2; // Rises with buoyant thermal plume
      smokeVelocities[i * 3 + 2] = Math.random() * 4.0 + 1.0;

      const isFire = Math.random() > 0.55;
      smokeColors[i * 3] = isFire ? 1.0 : 0.15;
      smokeColors[i * 3 + 1] = isFire ? 0.28 : 0.15;
      smokeColors[i * 3 + 2] = isFire ? 0.02 : 0.15;
    }

    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    smokeGeo.setAttribute('color', new THREE.BufferAttribute(smokeColors, 3));

    const smokeMat = new THREE.PointsMaterial({
      size: 0.48,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending,
    });
    const smokePoints = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smokePoints);

    // 5. Heavy Physical Tumbling Shrapnel Chunks (24 3D fragments)
    const debrisGroup = new THREE.Group();
    scene.add(debrisGroup);
    const debrisList: {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      rotVelocity: THREE.Vector3;
    }[] = [];

    const debrisGeos = [
      new THREE.DodecahedronGeometry(0.22),
      new THREE.BoxGeometry(0.28, 0.18, 0.32),
      new THREE.CylinderGeometry(0.12, 0.08, 0.45, 8),
      new THREE.ConeGeometry(0.16, 0.35, 6),
    ];

    for (let i = 0; i < 24; i++) {
      const geo = debrisGeos[i % debrisGeos.length];
      const mat = (i % 3 === 0 ? brassAccent : i % 3 === 1 ? steelPolished : steelDark).clone();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      debrisGroup.add(mesh);

      const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 4.5 + Math.random() * 7.5;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed + 3.0,
        Math.random() * 6.0 + 3.5
      );
      const rotVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      );
      debrisList.push({ mesh, velocity, rotVelocity });
    }

    // 6. Dynamic High-Voltage Electrical Lightning Arcs (Severed Circuit Discharge)
    const lightningCount = 5;
    const lightningLines: THREE.Line[] = [];
    const lightningSegments = 8;

    for (let i = 0; i < lightningCount; i++) {
      const lineGeo = new THREE.BufferGeometry();
      const linePos = new Float32Array(lightningSegments * 3);
      lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        linewidth: 2,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
      lightningLines.push(line);
    }

    // --- Mouse Move Listener for subtle parallax ---
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      stateRef.current.mouseX = x;
      stateRef.current.mouseY = y;
    };
    container.addEventListener('mousemove', handleMouseMove);

    // --- Animation Loop ---
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let helmSpin = 0;
    let unlockStep = 0;
    let greenBlinkCount = 0;
    let blastInitialTriggered = false;
    let secondaryDetonation1 = false;
    let secondaryDetonation2 = false;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const state = stateRef.current;

      // 0. Dust Particles Drift
      const dPositions = dustGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        dPositions[i * 3 + 1] += Math.sin(elapsed + i) * 0.002;
        dPositions[i * 3] += Math.cos(elapsed * 0.5 + i) * 0.001;
      }
      dustGeo.attributes.position.needsUpdate = true;

      // 1. Mouse Parallax (subtle tilt)
      if (state.status !== 'destroyed') {
        const targetRotX = state.mouseY * 0.12;
        const targetRotY = state.mouseX * 0.16;
        scene.rotation.x += (targetRotX - scene.rotation.x) * 0.05;
        scene.rotation.y += (targetRotY - scene.rotation.y) * 0.05;
      }

      // 2. Dial Angle Lerp
      state.dialAngle += (state.targetDialAngle - state.dialAngle) * 0.15;
      dialGroup.rotation.z = state.dialAngle;

      // 3. Status Handling & Animations

      // --- IDLE STATE ---
      if (state.status === 'idle') {
        const pulse = (Math.sin(elapsed * 2.5) + 1) * 0.5;
        ledMat.color.setHex(0x00d2ef);
        bottomLedMat.color.setHex(0x00d2ef);
        ledLight.color.setHex(0x00d2ef);
        bottomLedLight.color.setHex(0x00d2ef);
        ledLight.intensity = 1.0 + pulse * 1.0;
        bottomLedLight.intensity = 1.0 + pulse * 1.0;
        chamberLight.intensity = 0;
        blastFlashLight.intensity = 0;
        blastFireLight.intensity = 0;
        renderer.toneMappingExposure = 1.25;
        camera.fov = defaultFov;
        camera.updateProjectionMatrix();

        // Reset positions smoothly
        state.boltsProgress = Math.max(0, state.boltsProgress - delta * 2);
        state.doorOpenAngle = Math.max(0, state.doorOpenAngle - delta * 2);
        state.destructionProgress = 0;
        state.shockwaveRadius = 0;
        unlockStep = 0;
        greenBlinkCount = 0;
        blastInitialTriggered = false;
        secondaryDetonation1 = false;
        secondaryDetonation2 = false;

        fireballMat.opacity = 0;
        fireballMesh.scale.set(0.1, 0.1, 0.1);
        shockwaveMat1.opacity = 0;
        shockwaveMat2.opacity = 0;
        shockwaveMat3.opacity = 0;
        sparkMat.opacity = 0;
        smokeMat.opacity = 0;

        lightningLines.forEach((l) => {
          (l.material as THREE.LineBasicMaterial).opacity = 0;
        });

        doorGroup.position.set(-HINGE_X, 0, 0);
        doorGroup.rotation.set(0, 0, 0);
        hingeGroup.position.set(HINGE_X, 0, 0.15);
        hingeGroup.rotation.set(0, 0, 0);

        dialGroup.position.set(0, 0, 0.22);
        dialGroup.rotation.set(0, 0, 0);

        helmGroup.position.set(0, 0, 0.4);
        helmGroup.rotation.set(0, 0, 0);

        // Reset bolts to standard locked positions
        boltsData.forEach((b) => {
          b.mesh.visible = true;
          b.mesh.rotation.set(0, 0, b.baseAngle + Math.PI / 2);
          b.mesh.position.set(
            Math.cos(b.baseAngle) * boltBaseDist,
            Math.sin(b.baseAngle) * boltBaseDist,
            0
          );
        });

        // Reset spokes
        spokesData.forEach((s) => {
          s.spokeMesh.rotation.set(0, 0, s.baseAngle + Math.PI / 2);
          s.spokeMesh.position.set(Math.cos(s.baseAngle) * 0.42, Math.sin(s.baseAngle) * 0.42, 0);
          s.handleMesh.position.set(Math.cos(s.baseAngle) * 0.88, Math.sin(s.baseAngle) * 0.88, 0.05);
        });

        debrisList.forEach((d) => {
          d.mesh.visible = false;
        });
      }

      // --- TYPING STATE ---
      else if (state.status === 'typing') {
        ledMat.color.setHex(0x3b82f6);
        bottomLedMat.color.setHex(0x3b82f6);
        ledLight.color.setHex(0x3b82f6);
        bottomLedLight.color.setHex(0x3b82f6);
        ledLight.intensity = 2.5;
        bottomLedLight.intensity = 2.5;
      }

      // --- REJECTING (WRONG PASSWORD) STATE ---
      else if (state.status === 'rejecting') {
        // PROMINENT RED LIGHT BLINKING! (Strobe effect at ~14Hz)
        const isRedBlinkOn = Math.sin(elapsed * 30) > 0;
        const redHex = isRedBlinkOn ? 0xff0033 : 0x2a0005;

        ledMat.color.setHex(redHex);
        bottomLedMat.color.setHex(redHex);
        ledLight.color.setHex(0xff0033);
        bottomLedLight.color.setHex(0xff0033);
        ledLight.intensity = isRedBlinkOn ? 6.5 : 0.1;
        bottomLedLight.intensity = isRedBlinkOn ? 6.5 : 0.1;

        // Violent Sinusoidal Door Rattle
        if (state.shakeIntensity > 0.005) {
          const shakeX = Math.sin(elapsed * 65) * state.shakeIntensity * 0.16;
          const shakeY = Math.cos(elapsed * 60) * state.shakeIntensity * 0.09;
          doorGroup.position.x = -HINGE_X + shakeX;
          doorGroup.position.y = shakeY;
          state.shakeIntensity *= 0.94; // Decay
        } else {
          doorGroup.position.x = -HINGE_X;
          doorGroup.position.y = 0;
        }
      }

      // --- UNLOCKING (CORRECT PASSWORD) STATE ---
      else if (state.status === 'unlocking' || state.status === 'unlocked') {
        // Sequence Step 0: DISTINCT GREEN LIGHT BLINKING!
        if (unlockStep === 0) {
          greenBlinkCount += delta * 6;
          const isGreenBlinkOn = Math.sin(greenBlinkCount * Math.PI) > 0;
          const greenHex = isGreenBlinkOn ? 0x00ff88 : 0x003318;

          ledMat.color.setHex(greenHex);
          bottomLedMat.color.setHex(greenHex);
          ledLight.color.setHex(0x00ff88);
          bottomLedLight.color.setHex(0x00ff88);
          ledLight.intensity = isGreenBlinkOn ? 6.5 : 0.2;
          bottomLedLight.intensity = isGreenBlinkOn ? 6.5 : 0.2;

          if (greenBlinkCount >= 3.5) {
            ledMat.color.setHex(0x10b981);
            bottomLedMat.color.setHex(0x10b981);
            ledLight.color.setHex(0x10b981);
            bottomLedLight.color.setHex(0x10b981);
            ledLight.intensity = 4.5;
            bottomLedLight.intensity = 4.5;
            unlockStep = 1;
          }
        }

        // Sequence Step 1: Turning Helm Wheel Spins 360°
        else if (unlockStep === 1) {
          helmSpin += delta * 8.5;
          helmGroup.rotation.z = helmSpin;
          if (helmSpin >= Math.PI * 2) {
            helmSpin = Math.PI * 2;
            unlockStep = 2;
          }
        }

        // Sequence Step 2: Radial Steel Locking Bolts Retract Inward
        else if (unlockStep === 2) {
          state.boltsProgress = Math.min(1.0, state.boltsProgress + delta * 3.4);
          if (state.boltsProgress >= 1.0) {
            unlockStep = 3;
          }
        }

        // Sequence Step 3: Vault Door Visibly Swings Wide Open!
        else if (unlockStep === 3) {
          const targetOpen = -1.52; // ~87 degrees
          state.doorOpenAngle += (targetOpen - state.doorOpenAngle) * (delta * 3.4);

          // Glowing chamber interior emerald light floods outward!
          chamberLight.color.setHex(0x10b981);
          chamberLight.intensity = Math.min(5.5, chamberLight.intensity + delta * 5.0);

          if (Math.abs(state.doorOpenAngle - targetOpen) < 0.04) {
            state.doorOpenAngle = targetOpen;
            unlockStep = 4;
            if (onUnlockComplete) {
              setTimeout(onUnlockComplete, 400);
            }
          }
        }
      }

      // --- CATASTROPHIC VAULT BLAST (3RD FAILED ATTEMPT) ---
      else if (state.status === 'destroyed') {
        state.destructionProgress += delta;

        // Phase 1: Initial Blinding Nuclear Detonation
        if (!blastInitialTriggered) {
          blastInitialTriggered = true;
          blastFlashLight.intensity = 45.0; // Blinding flash
          blastFireLight.intensity = 28.0;
          renderer.toneMappingExposure = 3.6; // Dramatic exposure surge
          camera.fov = 44; // FOV kick shockwave punch
          camera.updateProjectionMatrix();

          fireballMat.opacity = 1.0;
          fireballMesh.scale.set(0.4, 0.4, 0.4);

          shockwaveMat1.opacity = 1.0;
          shockwaveMat2.opacity = 1.0;
          shockwaveMat3.opacity = 1.0;
          state.shockwaveRadius = 0.4;

          // Activate all 24 physical shrapnel debris chunks
          debrisList.forEach((d) => {
            d.mesh.visible = true;
            d.mesh.position.set(
              (Math.random() - 0.5) * 0.9,
              (Math.random() - 0.5) * 0.9,
              0.4
            );
          });
        }

        // Exposure & FOV Recovery
        renderer.toneMappingExposure = Math.max(1.25, renderer.toneMappingExposure - delta * 4.5);
        camera.fov = Math.max(defaultFov, camera.fov - delta * 12);
        camera.updateProjectionMatrix();

        // Flash Lights Decay
        blastFlashLight.intensity = Math.max(0, blastFlashLight.intensity - delta * 35);
        blastFireLight.intensity = Math.max(3.0, blastFireLight.intensity - delta * 12);

        // Expanding 3D Plasma Fireball Simulation
        if (state.destructionProgress < 1.2) {
          const fireballScale = Math.min(3.8, 0.4 + state.destructionProgress * 4.5);
          fireballMesh.scale.set(fireballScale, fireballScale, fireballScale);
          // Color shifts: White -> Yellow -> Crimson -> Translucent Dark Smoke
          if (state.destructionProgress < 0.2) {
            fireballMat.color.setHex(0xffffff);
          } else if (state.destructionProgress < 0.5) {
            fireballMat.color.setHex(0xffaa00);
          } else {
            fireballMat.color.setHex(0xff2200);
          }
          fireballMat.opacity = Math.max(0, 1.0 - state.destructionProgress * 0.9);
        } else {
          fireballMat.opacity = 0;
        }

        // Concentric Expanding Supersonic Shockwaves
        state.shockwaveRadius += delta * 15.0;
        shockwave1.scale.set(state.shockwaveRadius, state.shockwaveRadius, 1);
        shockwaveMat1.opacity = Math.max(0, 1.0 - state.destructionProgress * 2.2);

        const radius2 = state.shockwaveRadius * 0.85;
        shockwave2.scale.set(radius2, radius2, 1);
        shockwave2.rotation.z += delta * 6.0;
        shockwaveMat2.opacity = Math.max(0, 0.9 - state.destructionProgress * 1.6);

        const radius3 = state.shockwaveRadius * 0.65;
        shockwave3.scale.set(radius3, radius3, 1);
        shockwave3.rotation.z -= delta * 4.0;
        shockwaveMat3.opacity = Math.max(0, 0.8 - state.destructionProgress * 1.2);

        // Blinding emergency alarm red strobe
        const alarmStrobe = Math.sin(elapsed * 35) > 0;
        ledMat.color.setHex(alarmStrobe ? 0xff0000 : 0x330000);
        bottomLedMat.color.setHex(alarmStrobe ? 0xff0000 : 0x330000);
        ledLight.color.setHex(0xff0000);
        bottomLedLight.color.setHex(0xff0000);
        ledLight.intensity = alarmStrobe ? 9.0 : 0.2;
        bottomLedLight.intensity = alarmStrobe ? 9.0 : 0.2;

        // Interior burns with fiery red/orange glow
        chamberLight.color.setHex(0xff3300);
        chamberLight.intensity = 8.5;

        // Particle opacities
        sparkMat.opacity = Math.max(0, 1.0 - state.destructionProgress * 0.28);
        smokeMat.opacity = Math.max(0, 0.9 - state.destructionProgress * 0.18);

        // Secondary Micro-Detonation 1 at t = 0.35s (Mini Flash + Sparks surge)
        if (state.destructionProgress > 0.35 && !secondaryDetonation1) {
          secondaryDetonation1 = true;
          blastFireLight.intensity = 22.0;
          state.shakeIntensity = Math.max(state.shakeIntensity, 3.5);
        }

        // Secondary Micro-Detonation 2 at t = 0.75s
        if (state.destructionProgress > 0.75 && !secondaryDetonation2) {
          secondaryDetonation2 = true;
          blastFlashLight.intensity = 15.0;
          state.shakeIntensity = Math.max(state.shakeIntensity, 2.8);
        }

        // Explosive Sparks Simulation (Gravity + Air Drag)
        const sPositions = sparkGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < sparkCount; i++) {
          sPositions[i * 3] += sparkVelocities[i * 3] * delta;
          sPositions[i * 3 + 1] += sparkVelocities[i * 3 + 1] * delta;
          sPositions[i * 3 + 2] += sparkVelocities[i * 3 + 2] * delta;
          sparkVelocities[i * 3 + 1] -= 14.0 * delta; // Heavy gravity pull
          sparkVelocities[i * 3] *= 0.99;
          sparkVelocities[i * 3 + 2] *= 0.99;
        }
        sparkGeo.attributes.position.needsUpdate = true;

        // Volumetric Smoke Simulation (Billow, Convection & Expand)
        const smPositions = smokeGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < smokeCount; i++) {
          smPositions[i * 3] += smokeVelocities[i * 3] * delta;
          smPositions[i * 3 + 1] += smokeVelocities[i * 3 + 1] * delta;
          smPositions[i * 3 + 2] += smokeVelocities[i * 3 + 2] * delta;
          // Air resistance damping & convection
          smokeVelocities[i * 3] *= 0.97;
          smokeVelocities[i * 3 + 1] += 0.8 * delta; // Thermal updraft
          smokeVelocities[i * 3 + 2] *= 0.97;
        }
        smokeGeo.attributes.position.needsUpdate = true;

        // Tumbling Shrapnel Physics
        debrisList.forEach((d) => {
          d.mesh.position.x += d.velocity.x * delta;
          d.mesh.position.y += d.velocity.y * delta;
          d.mesh.position.z += d.velocity.z * delta;
          d.velocity.y -= 15.0 * delta; // Heavy Gravity

          d.mesh.rotation.x += d.rotVelocity.x * delta;
          d.mesh.rotation.y += d.rotVelocity.y * delta;
          d.mesh.rotation.z += d.rotVelocity.z * delta;
        });

        // =====================================================================
        // BALLISTIC EJECTION OF DOOR, BOLTS, HELM SPOKES & DIAL
        // =====================================================================

        // 1. Radial Locking Bolts violently shoot outward from their sockets
        boltsData.forEach((b) => {
          b.mesh.position.x += b.blastVelocity.x * delta;
          b.mesh.position.y += b.blastVelocity.y * delta;
          b.mesh.position.z += b.blastVelocity.z * delta;
          b.blastVelocity.y -= 14.0 * delta;

          b.mesh.rotation.x += b.blastRotVelocity.x * delta;
          b.mesh.rotation.y += b.blastRotVelocity.y * delta;
          b.mesh.rotation.z += b.blastRotVelocity.z * delta;
        });

        // 2. Helm Spokes Shatter & Fly Apart
        spokesData.forEach((s) => {
          s.spokeMesh.position.x += s.blastVelocity.x * delta;
          s.spokeMesh.position.y += s.blastVelocity.y * delta;
          s.spokeMesh.position.z += s.blastVelocity.z * delta;
          s.handleMesh.position.x += s.blastVelocity.x * delta;
          s.handleMesh.position.y += s.blastVelocity.y * delta;
          s.handleMesh.position.z += s.blastVelocity.z * delta;

          s.spokeMesh.rotation.x += s.blastRot.x * delta;
          s.spokeMesh.rotation.y += s.blastRot.y * delta;
          s.spokeMesh.rotation.z += s.blastRot.z * delta;
        });

        // 3. Central Combination Dial snaps loose and rockets outward
        dialGroup.position.x += delta * 3.5;
        dialGroup.position.y -= delta * 5.0;
        dialGroup.position.z += delta * 4.2;
        dialGroup.rotation.x += delta * 8.0;
        dialGroup.rotation.z += delta * 14.0;

        // 4. Heavy Steel Vault Door Plate Shears Off Hinges & Blasts Forward
        doorGroup.position.z = Math.min(3.4, doorGroup.position.z + delta * 4.5);
        doorGroup.position.y -= delta * 4.5; // Heavy fall
        doorGroup.position.x += delta * 1.5;
        doorGroup.rotation.x = Math.min(1.4, doorGroup.rotation.x + delta * 2.8);
        doorGroup.rotation.y += delta * 0.9;
        doorGroup.rotation.z += delta * 1.6;

        // 5. Crackling Plasma Lightning Arcs Discharge across Ruptured Frame
        if (state.destructionProgress < 2.5) {
          lightningLines.forEach((line, idx) => {
            const lineMat = line.material as THREE.LineBasicMaterial;
            const flicker = Math.random() > 0.4;
            lineMat.opacity = flicker ? 0.9 : 0;
            if (flicker) {
              const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
              const posArray = posAttr.array as Float32Array;
              const startX = -2.1 + (idx * 4.2) / lightningCount;
              const startY = Math.sin(idx * 1.2) * 2.0;
              const endX = startX + (Math.random() - 0.5) * 1.5;
              const endY = startY + (Math.random() - 0.5) * 1.5;

              for (let s = 0; s < lightningSegments; s++) {
                const t = s / (lightningSegments - 1);
                const jitter = (s === 0 || s === lightningSegments - 1) ? 0 : (Math.random() - 0.5) * 0.35;
                posArray[s * 3] = THREE.MathUtils.lerp(startX, endX, t) + jitter;
                posArray[s * 3 + 1] = THREE.MathUtils.lerp(startY, endY, t) + jitter;
                posArray[s * 3 + 2] = 0.2 + (Math.random() - 0.5) * 0.2;
              }
              posAttr.needsUpdate = true;
            }
          });
        } else {
          lightningLines.forEach((line) => {
            (line.material as THREE.LineBasicMaterial).opacity = 0;
          });
        }

        // 6. Concussive Camera Earthquake Tremor (Multi-Axis Chaotic Shake)
        if (state.shakeIntensity > 0.05) {
          camera.position.x = (Math.random() - 0.5) * state.shakeIntensity * 0.45;
          camera.position.y = (Math.random() - 0.5) * state.shakeIntensity * 0.45;
          camera.position.z = 7.2 + (Math.random() - 0.5) * state.shakeIntensity * 0.3;
          state.shakeIntensity *= 0.92;
        } else {
          camera.position.x = 0;
          camera.position.y = 0;
          camera.position.z = 7.2;
        }
      }

      // 4. Update Bolts Radial Positions (in normal unlocked mode)
      if (state.status !== 'destroyed') {
        for (let i = 0; i < numBolts; i++) {
          const angle = boltsData[i].baseAngle;
          const dist = THREE.MathUtils.lerp(boltBaseDist, boltRetractedDist, state.boltsProgress);
          boltsData[i].mesh.position.x = Math.cos(angle) * dist;
          boltsData[i].mesh.position.y = Math.sin(angle) * dist;
          boltsData[i].mesh.position.z = 0;
          boltsData[i].mesh.rotation.set(0, 0, angle + Math.PI / 2);
        }
      }

      // 5. Update Door Hinge Swing Angle
      if (state.status !== 'destroyed') {
        hingeGroup.rotation.y = state.doorOpenAngle;
      }

      renderer.render(scene, camera);
    };

    animate();

    // --- Resize Handler ---
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onUnlockComplete]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[460px] select-none flex items-center justify-center overflow-hidden ${className}`}
    />
  );
}
