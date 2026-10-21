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
    doorOpenAngle: 0, // 0 = closed, ~ -1.50 = fully open
    shakeIntensity: 0,
    destructionProgress: 0,
    unlockProgress: 0,
    mouseX: 0,
    mouseY: 0,
  });

  // Keep ref updated with latest props
  useEffect(() => {
    stateRef.current.status = status;
    stateRef.current.failedAttempts = failedAttempts;
    if (status === 'rejecting') {
      stateRef.current.shakeIntensity = 1.0;
    }
    if (status === 'destroyed') {
      stateRef.current.shakeIntensity = 2.5;
    }
  }, [status, failedAttempts]);

  // When typing, trigger dial spin smoothly
  const prevCountRef = useRef(typingCharCount);
  useEffect(() => {
    if (typingCharCount !== prevCountRef.current) {
      const diff = typingCharCount - prevCountRef.current;
      prevCountRef.current = typingCharCount;
      stateRef.current.targetDialAngle += diff * (Math.PI / 5 + Math.random() * 0.15);
    }
  }, [typingCharCount]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene Setup ---
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06090e, 0.05);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.0);

    // Highly optimized WebGL renderer for buttery 60+ FPS
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // --- Realistic Industrial Metal Materials ---
    const steelDark = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      metalness: 0.88,
      roughness: 0.28,
    });

    const steelPolished = new THREE.MeshStandardMaterial({
      color: 0x333d4e,
      metalness: 0.94,
      roughness: 0.18,
    });

    const brassAccent = new THREE.MeshStandardMaterial({
      color: 0xbfa148,
      metalness: 0.85,
      roughness: 0.32,
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.96,
      roughness: 0.12,
    });

    const innerWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x090d14,
      metalness: 0.5,
      roughness: 0.7,
    });

    // --- Atmospheric Floating Dust Motes (GPU-only rotation, zero CPU lag) ---
    const dustCount = 50;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 7;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 5;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 4 + 1;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.035,
      color: 0x00d2ef,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // --- Lighting Setup (Optimized: 1 Key, 1 Fill/Rim, Dynamic LEDs) ---
    const ambientLight = new THREE.AmbientLight(0x1e2736, 1.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xf0f5ff, 2.6);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00d2ef, 1.2);
    rimLight.position.set(-5, -3, 3);
    scene.add(rimLight);

    // Dual Status LEDs (Top & Bottom)
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00d2ef });
    const ledLight = new THREE.PointLight(0x00d2ef, 1.5, 4);
    ledLight.position.set(0, 1.4, 0.4);

    const bottomLedMat = new THREE.MeshBasicMaterial({ color: 0x00d2ef });
    const bottomLedLight = new THREE.PointLight(0x00d2ef, 1.5, 4);
    bottomLedLight.position.set(0, -1.4, 0.4);

    // Inner chamber light (Floods out with rich emerald green when door opens)
    const chamberLight = new THREE.PointLight(0x10b981, 0, 10);
    chamberLight.position.set(0, 0, -0.6);
    scene.add(chamberLight);

    // Realistic Industrial Breach Fire/Glow Light
    const breachHeatLight = new THREE.PointLight(0xff4500, 0, 12);
    breachHeatLight.position.set(0, 0, 0.4);
    scene.add(breachHeatLight);

    // --- Outer Heavy Wall Opening & Frame ---
    const frameGroup = new THREE.Group();
    scene.add(frameGroup);

    // Heavy Torus Outer Rim
    const frameTorusGeo = new THREE.TorusGeometry(2.35, 0.25, 16, 48);
    const frameTorus = new THREE.Mesh(frameTorusGeo, steelPolished);
    frameGroup.add(frameTorus);

    // Inner Brass Retaining Rim
    const innerRimGeo = new THREE.TorusGeometry(2.15, 0.07, 12, 36);
    const innerRim = new THREE.Mesh(innerRimGeo, brassAccent);
    frameGroup.add(innerRim);

    // 8 Bolt Receiver Notches in Frame
    const numBolts = 8;
    for (let i = 0; i < numBolts; i++) {
      const angle = (i * 2 * Math.PI) / numBolts;
      const notchGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.32, 12);
      const notch = new THREE.Mesh(notchGeo, steelDark);
      notch.rotation.z = angle + Math.PI / 2;
      notch.position.x = Math.cos(angle) * 2.3;
      notch.position.y = Math.sin(angle) * 2.3;
      frameGroup.add(notch);
    }

    // Vault Interior Chamber Tube (Seen when door swings open)
    const chamberBackGeo = new THREE.CylinderGeometry(2.1, 2.1, 1.5, 36, 1, true);
    const chamberBack = new THREE.Mesh(chamberBackGeo, innerWallMaterial);
    chamberBack.rotation.x = Math.PI / 2;
    chamberBack.position.z = -0.75;
    frameGroup.add(chamberBack);

    const backWallPlateGeo = new THREE.CircleGeometry(2.1, 36);
    const backWallPlate = new THREE.Mesh(backWallPlateGeo, steelDark);
    backWallPlate.position.z = -1.5;
    frameGroup.add(backWallPlate);

    // Glowing Security Core Grid on back wall
    const coreGridGeo = new THREE.RingGeometry(0.3, 1.4, 24);
    const coreGridMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const coreGrid = new THREE.Mesh(coreGridGeo, coreGridMat);
    coreGrid.position.z = -1.48;
    frameGroup.add(coreGrid);

    // --- Hinge Assembly & Door Group ---
    const HINGE_X = -2.22;
    const hingeGroup = new THREE.Group();
    hingeGroup.position.set(HINGE_X, 0, 0.15);
    scene.add(hingeGroup);

    // Industrial Solid Hinge Cylinders
    const hingeGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.85, 18);
    const topHinge = new THREE.Mesh(hingeGeo, chromeMaterial);
    topHinge.position.set(0, 1.4, 0);
    hingeGroup.add(topHinge);

    const bottomHinge = new THREE.Mesh(hingeGeo, chromeMaterial);
    bottomHinge.position.set(0, -1.4, 0);
    hingeGroup.add(bottomHinge);

    // Door Sub-Group attached to hinge
    const doorGroup = new THREE.Group();
    doorGroup.position.set(-HINGE_X, 0, 0);
    hingeGroup.add(doorGroup);

    // Main Machined Solid Titanium Door Disc
    const doorPlateGeo = new THREE.CylinderGeometry(2.1, 2.14, 0.36, 48);
    doorPlateGeo.rotateX(Math.PI / 2);
    const doorPlate = new THREE.Mesh(doorPlateGeo, steelDark);
    doorGroup.add(doorPlate);

    // Polished Front Bezel Ring
    const frontRingGeo = new THREE.TorusGeometry(1.9, 0.08, 12, 48);
    const frontRing = new THREE.Mesh(frontRingGeo, steelPolished);
    frontRing.position.z = 0.19;
    doorGroup.add(frontRing);

    // 16 Perimeter Rivets
    const rivetGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8);
    rivetGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const angle = (i * 2 * Math.PI) / 16;
      const rivet = new THREE.Mesh(rivetGeo, chromeMaterial);
      rivet.position.set(Math.cos(angle) * 1.88, Math.sin(angle) * 1.88, 0.2);
      doorGroup.add(rivet);
    }

    // --- 8 Radial Steel Locking Bolts ---
    const boltBaseDist = 1.95;
    const boltRetractedDist = 1.55;
    const boltGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.58, 16);

    interface BoltInfo {
      mesh: THREE.Mesh;
      baseAngle: number;
      ejected: boolean;
      vel: THREE.Vector3;
      rotVel: THREE.Vector3;
    }
    const bolts: BoltInfo[] = [];

    for (let i = 0; i < numBolts; i++) {
      const angle = (i * 2 * Math.PI) / numBolts;
      const bolt = new THREE.Mesh(boltGeo, chromeMaterial);
      bolt.rotation.z = angle + Math.PI / 2;
      bolt.position.set(Math.cos(angle) * boltBaseDist, Math.sin(angle) * boltBaseDist, 0);
      doorGroup.add(bolt);

      bolts.push({
        mesh: bolt,
        baseAngle: angle,
        ejected: false,
        vel: new THREE.Vector3(
          Math.cos(angle) * (5 + Math.random() * 4),
          Math.sin(angle) * (5 + Math.random() * 4) + 1.5,
          Math.random() * 3 + 2
        ),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        ),
      });
    }

    // --- Central Combination Dial Mechanism ---
    const dialGroup = new THREE.Group();
    dialGroup.position.set(0, 0, 0.2);
    doorGroup.add(dialGroup);

    // Dial Brass Outer Ring
    const dialBaseGeo = new THREE.CylinderGeometry(0.85, 0.9, 0.1, 36);
    dialBaseGeo.rotateX(Math.PI / 2);
    const dialBase = new THREE.Mesh(dialBaseGeo, brassAccent);
    dialGroup.add(dialBase);

    // Dial Face
    const dialFaceGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.05, 36);
    dialFaceGeo.rotateX(Math.PI / 2);
    const dialFace = new THREE.Mesh(dialFaceGeo, steelPolished);
    dialFace.position.z = 0.05;
    dialGroup.add(dialFace);

    // Dial Center Knob
    const knobGeo = new THREE.CylinderGeometry(0.35, 0.38, 0.18, 24);
    knobGeo.rotateX(Math.PI / 2);
    const knob = new THREE.Mesh(knobGeo, chromeMaterial);
    knob.position.z = 0.14;
    dialGroup.add(knob);

    // Graduation Tick Marks (Optimized: 24 marks)
    for (let i = 0; i < 24; i++) {
      const angle = (i * 2 * Math.PI) / 24;
      const isMajor = i % 4 === 0;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, isMajor ? 0.1 : 0.06, 0.02),
        isMajor ? brassAccent : chromeMaterial
      );
      tick.rotation.z = angle;
      tick.position.set(Math.cos(angle) * 0.65, Math.sin(angle) * 0.65, 0.08);
      dialGroup.add(tick);
    }

    // --- Heavy 3-Spoke Turning Helm / Steering Wheel ---
    const helmGroup = new THREE.Group();
    helmGroup.position.set(0, 0, 0.36);
    doorGroup.add(helmGroup);

    // Center Wheel Hub
    const helmHubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 18);
    helmHubGeo.rotateX(Math.PI / 2);
    const helmHub = new THREE.Mesh(helmHubGeo, chromeMaterial);
    helmGroup.add(helmHub);

    // 3 Radial Spokes with Brass Handles
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      const spokeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.8, 12);
      const spoke = new THREE.Mesh(spokeGeo, chromeMaterial);
      spoke.rotation.z = angle + Math.PI / 2;
      spoke.position.set(Math.cos(angle) * 0.4, Math.sin(angle) * 0.4, 0);
      helmGroup.add(spoke);

      const handleGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 12);
      handleGeo.rotateX(Math.PI / 2);
      const handle = new THREE.Mesh(handleGeo, brassAccent);
      handle.position.set(Math.cos(angle) * 0.82, Math.sin(angle) * 0.82, 0.04);
      helmGroup.add(handle);
    }

    // --- Status LED Indicators (Top & Bottom) ---
    const ledHousingGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.09, 12);
    ledHousingGeo.rotateX(Math.PI / 2);

    // Top LED Mount & Bulb
    const topLedHousing = new THREE.Mesh(ledHousingGeo, chromeMaterial);
    topLedHousing.position.set(0, 1.4, 0.2);
    doorGroup.add(topLedHousing);

    const topLedBulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), ledMat);
    topLedBulb.position.set(0, 1.4, 0.26);
    doorGroup.add(topLedBulb);
    doorGroup.add(ledLight);

    // Bottom LED Mount & Bulb
    const bottomLedHousing = new THREE.Mesh(ledHousingGeo, chromeMaterial);
    bottomLedHousing.position.set(0, -1.4, 0.2);
    doorGroup.add(bottomLedHousing);

    const bottomLedBulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), bottomLedMat);
    bottomLedBulb.position.set(0, -1.4, 0.26);
    doorGroup.add(bottomLedBulb);
    doorGroup.add(bottomLedLight);

    // --- REALISTIC INDUSTRIAL BREACH PARTICLES (GRITTY & NON-CARTOON) ---
    // 1. High-Velocity Hot Sparks (120 concentrated metal sparks, only active on breach)
    const sparkCount = 120;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);

    for (let i = 0; i < sparkCount; i++) {
      sparkPositions[i * 3] = (Math.random() - 0.5) * 0.6;
      sparkPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
      sparkPositions[i * 3 + 2] = 0.3;

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 6.0;
      sparkVelocities[i * 3] = Math.cos(angle) * speed;
      sparkVelocities[i * 3 + 1] = Math.sin(angle) * speed + 1.5;
      sparkVelocities[i * 3 + 2] = Math.random() * 4.0 + 1.5;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0xffaa33,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkPoints);

    // 2. Gritty Billowing Smoke (60 dark charcoal/smolder particles)
    const smokeCount = 60;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeVelocities = new Float32Array(smokeCount * 3);

    for (let i = 0; i < smokeCount; i++) {
      smokePositions[i * 3] = (Math.random() - 0.5) * 0.4;
      smokePositions[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      smokePositions[i * 3 + 2] = 0.1;

      smokeVelocities[i * 3] = (Math.random() - 0.5) * 1.5;
      smokeVelocities[i * 3 + 1] = Math.random() * 2.2 + 0.8; // Buoyant upward draft
      smokeVelocities[i * 3 + 2] = Math.random() * 1.5;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    const smokeMat = new THREE.PointsMaterial({
      size: 0.38,
      color: 0x22262e,
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending,
    });
    const smokePoints = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smokePoints);

    // Mouse Move Listener for subtle parallax
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      stateRef.current.mouseX = x;
      stateRef.current.mouseY = y;
    };
    container.addEventListener('mousemove', handleMouseMove);

    // --- Animation Loop State Variables ---
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let helmSpin = 0;
    let unlockStage = 0; // 0=idle, 1=greenBlink, 2=helmSpin, 3=boltsRetract, 4=doorSwing, 5=openHold, 6=done
    let greenTimer = 0;
    let holdTimer = 0;
    let isUnlockedFired = false;
    let breachTriggered = false;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05); // Cap delta to prevent large physics jumps
      const elapsed = clock.getElapsedTime();
      const state = stateRef.current;

      // 0. Dust Particles Drift (GPU-only rotation = ZERO CPU overhead!)
      dustPoints.rotation.y = elapsed * 0.02;

      // 1. Mouse Parallax (subtle high-spec depth)
      if (state.status !== 'destroyed') {
        const targetRotX = state.mouseY * 0.08;
        const targetRotY = state.mouseX * 0.10;
        scene.rotation.x += (targetRotX - scene.rotation.x) * 0.05;
        scene.rotation.y += (targetRotY - scene.rotation.y) * 0.05;
      }

      // 2. Smooth Dial Angle Lerp
      state.dialAngle += (state.targetDialAngle - state.dialAngle) * 0.15;
      dialGroup.rotation.z = state.dialAngle;

      // 3. Status State Machine

      // -------------------------------------------------------------
      // STATE: IDLE
      // -------------------------------------------------------------
      if (state.status === 'idle') {
        const pulse = (Math.sin(elapsed * 2.5) + 1) * 0.5;
        // Clean Cyan Idle Glow
        ledMat.color.setHex(0x00d2ef);
        bottomLedMat.color.setHex(0x00d2ef);
        ledLight.color.setHex(0x00d2ef);
        bottomLedLight.color.setHex(0x00d2ef);
        ledLight.intensity = 1.0 + pulse * 0.8;
        bottomLedLight.intensity = 1.0 + pulse * 0.8;

        chamberLight.intensity = 0;
        breachHeatLight.intensity = 0;
        coreGridMat.opacity = 0;
        sparkMat.opacity = 0;
        smokeMat.opacity = 0;

        // Reset positions smoothly
        state.boltsProgress = Math.max(0, state.boltsProgress - delta * 3);
        state.doorOpenAngle = Math.max(0, state.doorOpenAngle - delta * 3);
        hingeGroup.rotation.y = state.doorOpenAngle;
        doorGroup.position.set(-HINGE_X, 0, 0);
        doorGroup.rotation.set(0, 0, 0);

        unlockStage = 0;
        greenTimer = 0;
        holdTimer = 0;
        helmSpin = 0;
        isUnlockedFired = false;
        breachTriggered = false;

        // Reset bolts to standard locked positions
        bolts.forEach((b) => {
          b.mesh.visible = true;
          b.mesh.rotation.set(0, 0, b.baseAngle + Math.PI / 2);
          b.mesh.position.set(
            Math.cos(b.baseAngle) * boltBaseDist,
            Math.sin(b.baseAngle) * boltBaseDist,
            0
          );
        });

        dialGroup.position.set(0, 0, 0.2);
        dialGroup.rotation.set(0, 0, state.dialAngle);
        helmGroup.rotation.set(0, 0, 0);

        camera.position.set(0, 0, 7.0);
      }

      // -------------------------------------------------------------
      // STATE: TYPING
      // -------------------------------------------------------------
      else if (state.status === 'typing') {
        ledMat.color.setHex(0x3b82f6);
        bottomLedMat.color.setHex(0x3b82f6);
        ledLight.color.setHex(0x3b82f6);
        bottomLedLight.color.setHex(0x3b82f6);
        ledLight.intensity = 2.2;
        bottomLedLight.intensity = 2.2;
      }

      // -------------------------------------------------------------
      // STATE: REJECTING (WRONG PASSWORD)
      // -------------------------------------------------------------
      else if (state.status === 'rejecting') {
        // High-Intensity Warning Red Light Blinking (~8Hz)
        const isRedOn = Math.sin(elapsed * 24) > 0;
        const redColor = isRedOn ? 0xff0033 : 0x220006;
        ledMat.color.setHex(redColor);
        bottomLedMat.color.setHex(redColor);
        ledLight.color.setHex(0xff0033);
        bottomLedLight.color.setHex(0xff0033);
        ledLight.intensity = isRedOn ? 6.0 : 0.2;
        bottomLedLight.intensity = isRedOn ? 6.0 : 0.2;

        // Mechanical Door Rattle
        if (state.shakeIntensity > 0.01) {
          const shakeX = Math.sin(elapsed * 55) * state.shakeIntensity * 0.08;
          const shakeY = Math.cos(elapsed * 50) * state.shakeIntensity * 0.04;
          doorGroup.position.x = -HINGE_X + shakeX;
          doorGroup.position.y = shakeY;
          state.shakeIntensity *= 0.95;
        } else {
          doorGroup.position.x = -HINGE_X;
          doorGroup.position.y = 0;
        }
      }

      // -------------------------------------------------------------
      // STATE: UNLOCKING (CORRECT PASSWORD - CINEMATIC SEQUENCE)
      // -------------------------------------------------------------
      else if (state.status === 'unlocking' || state.status === 'unlocked') {
        // Sequence Stage 1: DISTINCT GREEN CONFIRMATION BLINK (1.2 seconds, 3 clear emerald pulses)
        if (unlockStage === 0 || unlockStage === 1) {
          unlockStage = 1;
          greenTimer += delta;

          // Crisp 3-pulse emerald blinking
          const pulsePhase = Math.sin(greenTimer * 8.0);
          const isGreenOn = pulsePhase > -0.2;
          const greenHex = isGreenOn ? 0x00ff88 : 0x00441a;

          ledMat.color.setHex(greenHex);
          bottomLedMat.color.setHex(greenHex);
          ledLight.color.setHex(0x00ff88);
          bottomLedLight.color.setHex(0x00ff88);
          ledLight.intensity = isGreenOn ? 6.5 : 0.4;
          bottomLedLight.intensity = isGreenOn ? 6.5 : 0.4;

          if (greenTimer >= 1.2) {
            // Lock green light to steady vibrant emerald
            ledMat.color.setHex(0x10b981);
            bottomLedMat.color.setHex(0x10b981);
            ledLight.color.setHex(0x10b981);
            bottomLedLight.color.setHex(0x10b981);
            ledLight.intensity = 5.0;
            bottomLedLight.intensity = 5.0;
            unlockStage = 2; // Proceed to helm spin
          }
        }

        // Sequence Stage 2: Mechanical Steering Helm Wheel Spins 360° (0.9s)
        else if (unlockStage === 2) {
          helmSpin += delta * 7.5;
          helmGroup.rotation.z = helmSpin;
          if (helmSpin >= Math.PI * 2) {
            helmGroup.rotation.z = Math.PI * 2;
            unlockStage = 3; // Proceed to bolt retraction
          }
        }

        // Sequence Stage 3: Radial Locking Bolts Retract Inward (0.7s)
        else if (unlockStage === 3) {
          state.boltsProgress = Math.min(1.0, state.boltsProgress + delta * 2.2);
          for (let i = 0; i < numBolts; i++) {
            const angle = bolts[i].baseAngle;
            const dist = THREE.MathUtils.lerp(boltBaseDist, boltRetractedDist, state.boltsProgress);
            bolts[i].mesh.position.x = Math.cos(angle) * dist;
            bolts[i].mesh.position.y = Math.sin(angle) * dist;
          }

          if (state.boltsProgress >= 1.0) {
            unlockStage = 4; // Proceed to door swing
          }
        }

        // Sequence Stage 4: Heavy Titanium Door Visibly Swings Wide Open! (1.4s)
        else if (unlockStage === 4) {
          const targetOpenAngle = -1.48; // ~85 degrees wide open
          state.doorOpenAngle += (targetOpenAngle - state.doorOpenAngle) * (delta * 2.8);
          hingeGroup.rotation.y = state.doorOpenAngle;

          // Glowing chamber interior light floods outward!
          chamberLight.intensity = Math.min(6.5, chamberLight.intensity + delta * 5.0);
          coreGridMat.opacity = Math.min(0.85, coreGridMat.opacity + delta * 1.5);

          if (Math.abs(state.doorOpenAngle - targetOpenAngle) < 0.05) {
            state.doorOpenAngle = targetOpenAngle;
            hingeGroup.rotation.y = targetOpenAngle;
            unlockStage = 5; // Hold open for user appreciation
          }
        }

        // Sequence Stage 5: Pause on Fully Open Vault Door, then Smoothly Transition Inside
        else if (unlockStage === 5) {
          holdTimer += delta;
          if (holdTimer >= 0.7 && !isUnlockedFired) {
            isUnlockedFired = true;
            unlockStage = 6;
            if (onUnlockComplete) {
              onUnlockComplete();
            }
          }
        }
      }

      // -------------------------------------------------------------
      // STATE: DESTROYED (REALISTIC INDUSTRIAL BREACH - NOT CARTOON!)
      // -------------------------------------------------------------
      else if (state.status === 'destroyed') {
        state.destructionProgress += delta;

        // Initial Rupture Impact
        if (!breachTriggered) {
          breachTriggered = true;
          breachHeatLight.intensity = 18.0;
          sparkMat.opacity = 1.0;
          smokeMat.opacity = 0.85;
          state.shakeIntensity = 2.5;
        }

        // Camera concussive shudder (decays realistically in 0.4s)
        if (state.shakeIntensity > 0.02) {
          camera.position.x = (Math.random() - 0.5) * state.shakeIntensity * 0.18;
          camera.position.y = (Math.random() - 0.5) * state.shakeIntensity * 0.18;
          state.shakeIntensity *= 0.90;
        } else {
          camera.position.x = 0;
          camera.position.y = 0;
        }

        // Realistic Slow Emergency Beacon Strobe (1.5 Hz slow facility breach beacon)
        const beaconPulse = Math.sin(elapsed * 8) > 0.2;
        const redHex = beaconPulse ? 0xff0000 : 0x220000;
        ledMat.color.setHex(redHex);
        bottomLedMat.color.setHex(redHex);
        ledLight.color.setHex(0xff0000);
        bottomLedLight.color.setHex(0xff0000);
        ledLight.intensity = beaconPulse ? 7.0 : 0.3;
        bottomLedLight.intensity = beaconPulse ? 7.0 : 0.3;

        // Smoldering Breached Furnace Interior Heat Glow
        breachHeatLight.intensity = 4.5 + Math.sin(elapsed * 3) * 1.5;

        // Radial Bolts Forced Outward from Ruptured Sockets
        bolts.forEach((b) => {
          b.mesh.position.x += b.vel.x * delta;
          b.mesh.position.y += b.vel.y * delta;
          b.mesh.position.z += b.vel.z * delta;
          b.vel.y -= 12.0 * delta; // Gravity
          b.mesh.rotation.x += b.rotVel.x * delta;
          b.mesh.rotation.y += b.rotVel.y * delta;
        });

        // Heavy Steel Door Warps and Drops onto Frame (Industrial mechanical failure)
        // Instead of flying off like a toy, the heavy 10-ton door hinges crack:
        // it thrusts forward by 0.4 units, drops down 0.5 units, and rests canted at a broken 20° tilt.
        doorGroup.position.z = Math.min(0.55, doorGroup.position.z + delta * 1.8);
        doorGroup.position.y = Math.max(-0.65, doorGroup.position.y - delta * 2.2);
        doorGroup.rotation.x = Math.min(0.38, doorGroup.rotation.x + delta * 1.2);
        doorGroup.rotation.z = Math.min(0.25, doorGroup.rotation.z + delta * 0.8);

        // Sparks Arc Simulation
        const sPos = sparkGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < sparkCount; i++) {
          sPos[i * 3] += sparkVelocities[i * 3] * delta;
          sPos[i * 3 + 1] += sparkVelocities[i * 3 + 1] * delta;
          sPos[i * 3 + 2] += sparkVelocities[i * 3 + 2] * delta;
          sparkVelocities[i * 3 + 1] -= 10.0 * delta; // Gravity
        }
        sparkGeo.attributes.position.needsUpdate = true;
        sparkMat.opacity = Math.max(0, 1.0 - state.destructionProgress * 0.4);

        // Billowing Charcoal Smoke Convection
        const smPos = smokeGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < smokeCount; i++) {
          smPos[i * 3] += smokeVelocities[i * 3] * delta;
          smPos[i * 3 + 1] += smokeVelocities[i * 3 + 1] * delta;
          smPos[i * 3 + 2] += smokeVelocities[i * 3 + 2] * delta;
          smokeVelocities[i * 3] *= 0.98;
          smokeVelocities[i * 3 + 1] += 0.4 * delta; // Upward thermal plume
        }
        smokeGeo.attributes.position.needsUpdate = true;
        smokeMat.opacity = Math.max(0, 0.85 - state.destructionProgress * 0.15);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
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
