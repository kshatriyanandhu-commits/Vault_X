'use client';

import React, { useState, useEffect } from 'react';
import VaultDoor3D, { VaultDoor3DProps } from './VaultDoor3D';
import VaultDoorFallback from './VaultDoorFallback';
import { Eye, Box, Sliders } from 'lucide-react';

export default function VaultDoorContainer(props: VaultDoor3DProps) {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [use3D, setUse3D] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
        setUse3D(false);
      }
    } catch (e) {
      setHasWebGL(false);
      setUse3D(false);
    }
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {/* Renderer View */}
      {hasWebGL && use3D ? (
        <VaultDoor3D {...props} />
      ) : (
        <VaultDoorFallback {...props} />
      )}

      {/* Mode Toggle Pill */}
      {hasWebGL && (
        <div className="absolute bottom-3 left-4 z-20">
          <button
            type="button"
            onClick={() => setUse3D(!use3D)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-all backdrop-blur-md shadow-lg"
            title="Toggle between Three.js 3D and WebGL schematic fallback"
          >
            {use3D ? (
              <>
                <Box className="w-3.5 h-3.5 text-cyan-400" />
                <span>3D WebGL</span>
              </>
            ) : (
              <>
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Schematic</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
