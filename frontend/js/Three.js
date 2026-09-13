/**
 * three-scene.js
 * Interactive 3D hero scene: a floating "AI core" icosahedron, rotating
 * code-symbol sprites, drifting particles, glowing connection lines, and a
 * couple of small floating "PR panel" planes. Subtle camera drift + mouse
 * parallax. Kept lightweight so it never blocks the rest of the page.
 *
 * Requires THREE (r128) to be loaded globally before this file runs.
 */

(function initHeroScene() {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas || typeof THREE === "undefined") return;

  const heroSection = document.querySelector(".hero");

  let width = heroSection.clientWidth;
  let height = heroSection.clientHeight;

  // --- Renderer / Scene / Camera -----------------------------------------

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
  camera.position.set(0, 0, 9);

  // --- Lighting ------------------------------------------------------------

  const ambient = new THREE.AmbientLight(0x8899ff, 0.6);
  scene.add(ambient);

  const pointLight1 = new THREE.PointLight(0x7c6bff, 2.2, 20);
  pointLight1.position.set(4, 3, 4);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x34e7e0, 1.8, 20);
  pointLight2.position.set(-4, -2, 3);
  scene.add(pointLight2);

  // --- AI core (icosahedron with wireframe overlay) -------------------------

  const coreGroup = new THREE.Group();

  const coreGeometry = new THREE.IcosahedronGeometry(1.4, 1);
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b2140,
    emissive: 0x4d3fd6,
    emissiveIntensity: 0.5,
    metalness: 0.4,
    roughness: 0.35,
    flatShading: true,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  coreGroup.add(core);

  const wireGeometry = new THREE.IcosahedronGeometry(1.55, 1);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x34e7e0,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  const wireCore = new THREE.Mesh(wireGeometry, wireMaterial);
  coreGroup.add(wireCore);

  scene.add(coreGroup);

  // --- Rotating code symbol sprites -----------------------------------------

  const symbols = ["</>", "{ }", "AI", "PR", "if()", "=>"];
  const symbolSprites = [];

  function makeTextSprite(text, color) {
    const canvasEl = document.createElement("canvas");
    canvasEl.width = 256;
    canvasEl.height = 128;
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, 256, 128);
    ctx.font = "600 52px 'JetBrains Mono', monospace";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvasEl);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.6, 0.8, 1);
    return sprite;
  }

  symbols.forEach((sym, i) => {
    const color = i % 2 === 0 ? "#7c6bff" : "#34e7e0";
    const sprite = makeTextSprite(sym, color);
    const angle = (i / symbols.length) * Math.PI * 2;
    const radius = 3.2;
    sprite.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.3) * 1.2, Math.sin(angle) * radius);
    sprite.userData.angle = angle;
    sprite.userData.radius = radius;
    sprite.userData.speed = 0.15 + Math.random() * 0.1;
    scene.add(sprite);
    symbolSprites.push(sprite);
  });

  // --- Floating particles --------------------------------------------------

  const particleCount = 220;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const particleMaterial = new THREE.PointsMaterial({
    color: 0x9fb4ff,
    size: 0.035,
    transparent: true,
    opacity: 0.6,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // --- Glowing connection lines (core -> symbols) ---------------------------

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x7c6bff,
    transparent: true,
    opacity: 0.25,
  });
  const connectionLines = symbolSprites.map((sprite) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      sprite.position.clone(),
    ]);
    const line = new THREE.Line(geometry, lineMaterial);
    scene.add(line);
    return { line, sprite };
  });

  // --- Small floating PR/code panels -----------------------------------------

  const panelGroup = new THREE.Group();
  function makePanel(x, y, z, color) {
    const geometry = new THREE.PlaneGeometry(1.1, 0.7);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(geometry, material);
    panel.position.set(x, y, z);

    const edges = new THREE.EdgesGeometry(geometry);
    const edgeLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })
    );
    panel.add(edgeLines);

    return panel;
  }

  const panel1 = makePanel(-3.4, 1.6, -1.5, 0x34e7e0);
  const panel2 = makePanel(3.2, -1.4, -1, 0x7c6bff);
  panelGroup.add(panel1, panel2);
  scene.add(panelGroup);

  // --- Mouse parallax --------------------------------------------------------

  let mouseX = 0;
  let mouseY = 0;
  let targetRotX = 0;
  let targetRotY = 0;

  window.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // --- Resize handling ---------------------------------------------------

  function handleResize() {
    width = heroSection.clientWidth;
    height = heroSection.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener("resize", handleResize);

  // --- Animation loop ------------------------------------------------------

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Core rotation + subtle pulse
    coreGroup.rotation.y = elapsed * 0.25;
    coreGroup.rotation.x = Math.sin(elapsed * 0.3) * 0.15;
    const pulse = 1 + Math.sin(elapsed * 1.4) * 0.04;
    core.scale.set(pulse, pulse, pulse);
    wireCore.rotation.y = -elapsed * 0.18;

    // Orbit the code symbols around the core
    symbolSprites.forEach((sprite) => {
      const angle = sprite.userData.angle + elapsed * sprite.userData.speed;
      const radius = sprite.userData.radius;
      sprite.position.x = Math.cos(angle) * radius;
      sprite.position.z = Math.sin(angle) * radius;
      sprite.position.y += Math.sin(elapsed * 0.8 + angle) * 0.0015;
      sprite.lookAt(camera.position);
    });

    // Update connection lines to follow the orbiting symbols
    connectionLines.forEach(({ line, sprite }) => {
      const positionsAttr = line.geometry.attributes.position;
      positionsAttr.setXYZ(1, sprite.position.x, sprite.position.y, sprite.position.z);
      positionsAttr.needsUpdate = true;
    });

    // Drift particles slowly
    particles.rotation.y = elapsed * 0.02;

    // Floating panels bob gently
    panel1.position.y = 1.6 + Math.sin(elapsed * 0.6) * 0.15;
    panel2.position.y = -1.4 + Math.cos(elapsed * 0.5) * 0.15;
    panelGroup.rotation.y = Math.sin(elapsed * 0.15) * 0.1;

    // Subtle camera drift + mouse parallax (never distracts from usability)
    targetRotX += (mouseY * 0.15 - targetRotX) * 0.03;
    targetRotY += (mouseX * 0.15 - targetRotY) * 0.03;
    camera.position.x = Math.sin(elapsed * 0.1) * 0.3 + targetRotY * 1.2;
    camera.position.y = Math.cos(elapsed * 0.12) * 0.2 - targetRotX * 1.2;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  animate();
})();