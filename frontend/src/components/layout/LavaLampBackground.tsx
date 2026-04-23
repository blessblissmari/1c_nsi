// Simple light gray background - no lava blobs, just subtle noise
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Minimal noise particles - subtle gray dots floating slowly
function NoiseParticles() {
  const ref = useRef<THREE.Points>(null!)
  
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.005
      ref.current.position.y = Math.sin(clock.getElapsedTime() * 0.1) * 0.1
    }
  })

  const positions = useMemo(() => {
    const arr = new Float32Array(100 * 3)
    for (let i = 0; i < 100; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 25
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20
      arr[i * 3 + 2] = -8 - Math.random() * 5
    }
    return arr
  }, [])

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#94a3b8" transparent opacity={0.2} sizeAttenuation depthWrite={false} />
    </points>
  )
}

export function LavaLampBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'linear-gradient(180deg, #cbd5e1 0%, #e2e8f0 50%, #f1f5f9 100%)' }}
      >
        <ambientLight intensity={0.6} />
        <NoiseParticles />
      </Canvas>
    </div>
  )
}
