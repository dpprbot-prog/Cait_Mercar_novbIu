'use client'

import dynamic from 'next/dynamic'
import React, { Suspense, useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useFBX, Environment, PerspectiveCamera, Edges } from '@react-three/drei'
import { Physics, RigidBody, BallCollider, CuboidCollider, RigidBodyApi } from '@react-three/rapier'
import { useDrag } from '@use-gesture/react'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'

const TOOL_COLORS: Record<string, string> = {
  'level': '#fbbf24', 'Hummer': '#ef4444', 'Saw': '#f59e0b',
  'Pliers': '#3b82f6', 'Screwdrivers': '#10b981', 'Spanners': '#6366f1',
  'Brush': '#f97316', 'Pincers': '#8b5cf6'
}

const TOOLS_LIST = [
  { url: "/models/uploads-files-2988947-level.fbx", type: "level", scale: 0.05 },
  { url: "/models/uploads-files-4481103-FBX/Hummer.fbx", type: "Hummer", scale: 0.14 },
  { url: "/models/uploads-files-4481103-FBX/Saw.fbx", type: "Saw", scale: 0.09 },
  { url: "/models/uploads-files-4481103-FBX/Pliers.fbx", type: "Pliers", scale: 0.14 },
  { url: "/models/uploads-files-4481103-FBX/Screwdrivers.fbx", type: "Screwdrivers", scale: 0.12 },
  { url: "/models/uploads-files-4481103-FBX/Spanners.fbx", type: "Spanners", scale: 0.14 },
  { url: "/models/uploads-files-4481103-FBX/Pincers.fbx", type: "Pincers", scale: 0.14 },
  { url: "/models/uploads-files-4481103-FBX/Pipe wrench.fbx", type: "Spanners", scale: 0.16 },
]

function DraggableTool({ url, type, position, scale: baseScale = 0.1 }: any) {
  const fbx = useFBX(url)
  const api = useRef<RigidBodyApi>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { camera, mouse, viewport } = useThree()
  const isMobile = viewport.width < 12
  const responsiveScale = isMobile ? baseScale * 0.6 : baseScale

  const scene = useMemo(() => {
    const clone = fbx.clone()
    const color = TOOL_COLORS[type] || '#ffffff'
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.material = new THREE.MeshPhysicalMaterial({ 
          color: color, metalness: 0.9, roughness: 0.1, envMapIntensity: 2, 
          emissive: color, emissiveIntensity: 0.1, transmission: 0, thickness: 0
        })
      }
    })
    return clone
  }, [fbx, type])

  useFrame((state) => {
    if (!api.current) return
    const p = api.current.translation()
    const v = api.current.linvel()
    const limitX = viewport.width / 2
    const limitY = viewport.height / 2

    if (isDragging) {
      const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera)
      const dir = vector.sub(camera.position).normalize()
      const targetPos = camera.position.clone().add(dir.multiplyScalar(15))
      api.current.setNextKinematicTranslation({
        x: THREE.MathUtils.lerp(p.x, targetPos.x, 0.25),
        y: THREE.MathUtils.lerp(p.y, targetPos.y, 0.25),
        z: THREE.MathUtils.lerp(p.z, targetPos.z, 0.25)
      })
    } else {
      // Плавное вращение в невесомости
      api.current.applyTorqueImpulse({ 
        x: Math.sin(state.clock.elapsedTime * 0.5) * 0.01, 
        y: Math.cos(state.clock.elapsedTime * 0.3) * 0.01, 
        z: 0.01 
      }, true)

      // Жесткий "отскок" от границ, если вылетел
      if (Math.abs(p.x) > limitX + 2 || Math.abs(p.y) > limitY + 2) {
        api.current.setTranslation({
          x: Math.max(-limitX, Math.min(limitX, p.x)),
          y: Math.max(-limitY, Math.min(limitY, p.y)),
          z: Math.max(-5, Math.min(5, p.z))
        }, true)
        api.current.setLinvel({ x: -v.x, y: -v.y, z: -v.z }, true)
      }
    }
  })

  const bind = useDrag(({ active }) => {
    if (api.current) {
      setIsDragging(active)
      api.current.setBodyType(active ? 2 : 0, true)
      api.current.setAngularDamping(active ? 5 : 0.5)
      api.current.setLinearDamping(active ? 5 : 0.5)
    }
  }, { pointerEvents: true })

  return (
    <RigidBody 
      ref={api} 
      position={position} 
      colliders={false} 
      restitution={1.2} 
      linearDamping={0.5} 
      angularDamping={0.5}
      {...(bind() as any)}
    >
      <BallCollider args={[responsiveScale * 16]} /> 
      <primitive object={scene} scale={[responsiveScale, responsiveScale, responsiveScale]} />
    </RigidBody>
  )
}

function WorkshopContent() {
  const { viewport, mouse } = useThree()
  const w = viewport.width
  const h = viewport.height
  const isMobile = w < 12
  const lightRef = useRef<THREE.PointLight>(null)

  const tools = useMemo(() => {
    return Array.from({ length: isMobile ? 8 : 12 }).map((_, i) => ({
      ...TOOLS_LIST[i % TOOLS_LIST.length],
      id: i,
      pos: [(Math.random()-0.5)*w*0.7, (Math.random()-0.5)*h*0.7, (Math.random()-0.5)*5]
    }))
  }, [w, h, isMobile])

  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.position.x = mouse.x * w / 2
      lightRef.current.position.y = mouse.y * h / 2
    }
  })

  return (
    <>
      <pointLight ref={lightRef} intensity={15} distance={20} color="#fff" />
      
      <Physics gravity={[0, 0, 0]}>
        {/* Физические границы (невидимые стены) */}
        <RigidBody type="fixed">
          <CuboidCollider args={[w/2, h/2, 1]} position={[0, 0, -10]} /> {/* Задняя стенка */}
          <CuboidCollider args={[w/2, h/2, 1]} position={[0, 0, 10]} />  {/* Передняя стенка */}
          <CuboidCollider args={[1, h/2, 10]} position={[-w/2-1, 0, 0]} /> {/* Левая */}
          <CuboidCollider args={[1, h/2, 10]} position={[w/2+1, 0, 0]} />  {/* Правая */}
          <CuboidCollider args={[w/2, 1, 10]} position={[0, -h/2-1, 0]} /> {/* Пол */}
          <CuboidCollider args={[w/2, 1, 10]} position={[0, h/2+1, 0]} />  {/* Потолок */}
        </RigidBody>

        {tools.map(t => <DraggableTool key={t.id} {...t} position={t.pos} />)}
      </Physics>

      <mesh>
        <boxGeometry args={[w, h, 20]} />
        <meshStandardMaterial color="#010101" side={THREE.BackSide} />
        <Edges color="#111" />
      </mesh>
      <gridHelper args={[w, isMobile ? 10 : 20, 0x222222, 0x050505]} position={[0, -h/2, 0]} />
    </>
  )
}

function WorkshopScene() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, background: '#000', pointerEvents: 'none' }}>
      <Canvas shadows dpr={[1, 2]} style={{ pointerEvents: 'auto' }} camera={{ fov: 35 }}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 0, 25]} />
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 10, 20]} intensity={10} color="#4488ff" />
          <pointLight position={[-10, -10, 20]} intensity={10} color="#ff4444" />
          
          <WorkshopContent />
          <Environment preset="night" />
          
          <EffectComposer multisampling={4}>
            <Bloom luminanceThreshold={0.5} mipmapBlur intensity={0.8} radius={0.4} />
            <Noise opacity={0.03} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  )
}

export default dynamic(() => Promise.resolve(WorkshopScene), { ssr: false })
