<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'

const containerRef = ref<HTMLDivElement | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let animationId = 0
let isDragging = false
let previousMouseX = 0
let previousMouseY = 0
let autoRotate = true
let globe: THREE.Mesh | null = null

onMounted(() => {
  const container = containerRef.value
  if (!container) return

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a1a)

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  )
  camera.position.z = 2.8

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)

  // Create Earth globe with NASA Blue Marble texture, darkened for data visibility
  // Using NASA Visible Earth "Blue Marble" (public domain)
  const earthTextureUrl = `${import.meta.env.BASE_URL}land_shallow_topo_2048.jpg`

  const geometry = new THREE.SphereGeometry(1, 64, 64)
  // Start with a dark placeholder material
  const material = new THREE.MeshPhongMaterial({ color: 0x0a1628 })
  globe = new THREE.Mesh(geometry, material)
  scene.add(globe)

  // Load the texture, darken it via canvas, then apply
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    // Darken the texture so plotted data stands out
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    material.map = texture
    material.color.set(0xffffff)
    material.needsUpdate = true
  }
  img.src = earthTextureUrl

  // Overlay ATL18 data image on top of the globe
  const overlayGeom = new THREE.SphereGeometry(1.005, 64, 64)
  const overlayMat = new THREE.MeshPhongMaterial({
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    side: THREE.FrontSide,
    color: 0xffffff
  })
  const overlayMesh = new THREE.Mesh(overlayGeom, overlayMat)
  globe.add(overlayMesh)

  const overlayImg = new Image()
  overlayImg.crossOrigin = 'anonymous'
  overlayImg.onload = () => {
    const overlayTexture = new THREE.Texture(overlayImg)
    overlayTexture.colorSpace = THREE.SRGBColorSpace
    overlayTexture.needsUpdate = true
    overlayMat.map = overlayTexture
    overlayMat.needsUpdate = true
  }
  overlayImg.src = 'https://docs.slideruleearth.io/_static/ATL18_reprojected.png'

  // Atmosphere glow
  const atmosGeom = new THREE.SphereGeometry(1.02, 64, 64)
  const atmosMat = new THREE.MeshPhongMaterial({
    color: 0x4fc3f7,
    transparent: true,
    opacity: 0.08,
    side: THREE.FrontSide
  })
  scene.add(new THREE.Mesh(atmosGeom, atmosMat))

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 1.5)
  scene.add(ambientLight)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
  directionalLight.position.set(5, 3, 5)
  scene.add(directionalLight)

  // Star field
  const starGeom = new THREE.BufferGeometry()
  const starVerts = new Float32Array(3000)
  for (let i = 0; i < starVerts.length; i++) {
    starVerts[i] = (Math.random() - 0.5) * 100
  }
  starGeom.setAttribute('position', new THREE.BufferAttribute(starVerts, 3))
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 })
  scene.add(new THREE.Points(starGeom, starMat))

  // Mouse interaction
  const onMouseDown = (e: MouseEvent) => {
    isDragging = true
    autoRotate = false
    previousMouseX = e.clientX
    previousMouseY = e.clientY
  }
  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging || !globe) return
    const dx = e.clientX - previousMouseX
    const dy = e.clientY - previousMouseY
    globe.rotation.y += dx * 0.005
    globe.rotation.x += dy * 0.005
    previousMouseX = e.clientX
    previousMouseY = e.clientY
  }
  const onMouseUp = () => {
    isDragging = false
    // Resume auto-rotate after 2 seconds
    setTimeout(() => {
      if (!isDragging) autoRotate = true
    }, 2000)
  }

  container.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)

  const onResize = () => {
    if (!renderer || !container) return
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  window.addEventListener('resize', onResize)

  const animate = () => {
    animationId = requestAnimationFrame(animate)
    if (autoRotate && globe) {
      globe.rotation.y += 0.002
    }
    renderer!.render(scene, camera)
  }
  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  if (renderer) {
    renderer.dispose()
  }
})
</script>

<template>
  <div ref="containerRef" class="sr-globe-container">
    <div class="sr-globe-label">ICESat-2 global terrian heights (ATL18)</div>
  </div>
</template>

<style scoped>
.sr-globe-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #0a0a1a;
  cursor: grab;
  position: relative;
}

.sr-globe-container:active {
  cursor: grabbing;
}

.sr-globe-label {
  position: absolute;
  bottom: 50%;
  left: 50%;
  transform: translate(calc(0.7 * 50vh), calc(0.7 * 50vh));
  text-align: left;
  font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Courier New', monospace;
  font-size: 1.7rem;
  color: rgba(255, 255, 255, 0.7);
  pointer-events: none;
  user-select: none;
  line-height: 1.5;
  white-space: nowrap;
}
</style>
