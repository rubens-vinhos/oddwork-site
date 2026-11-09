// Hélice da Oddwork em 3D. Usa as mesmas coordenadas do símbolo SVG (y para baixo, em px de 1080).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const palco = document.getElementById("palco");
const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ESPINHA = [[8, -78], [34, -82], [60, -198], [42, -332], [8, -376]];
const ALETA = [[50, -92], [76, -212], [118, -136], [100, -102]];

function forma(pontos, espelhar) {
  const s = new THREE.Shape();
  pontos.forEach(([x, y], i) => {
    const px = (espelhar ? -x : x) / 100;
    const py = -y / 100;
    i ? s.lineTo(px, py) : s.moveTo(px, py);
  });
  s.closePath();
  return s;
}

function extrudir(pontos, espelhar, profundidade) {
  const g = new THREE.ExtrudeGeometry(forma(pontos, espelhar), {
    depth: profundidade,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.022,
    bevelSegments: 3,
    curveSegments: 1,
  });
  g.translate(0, 0, -profundidade / 2);
  return g;
}

function iniciar() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return; // sem WebGL: fica o símbolo em SVG
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  palco.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camara = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camara.position.set(0, 0, 16.5); // as pontas (raio ~3,9) nunca saem do palco ao rodar

  // Luz principal vinda de cima à esquerda, para a sombra cair no "papel"
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(-2.5, 3.5, 10); // luz mais frontal: sombra curta e suave
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.radius = 10;
  sol.shadow.blurSamples = 16;
  Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  sol.shadow.bias = -0.0005;
  cena.add(sol);
  cena.add(new THREE.AmbientLight(0xffffff, 0.25));

  const parede = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ opacity: 0.08 })
  );
  parede.position.z = -0.9;
  parede.receiveShadow = true;
  cena.add(parede);

  const aco = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.36, metalness: 0.55 });
  const acoAleta = new THREE.MeshStandardMaterial({ color: "#161616", roughness: 0.5, metalness: 0.45 });
  const laranja = new THREE.MeshStandardMaterial({ color: "#F45127", roughness: 0.6, metalness: 0, envMapIntensity: 0.25, emissive: "#F45127", emissiveIntensity: 0.12 });

  const geoEspinhaD = extrudir(ESPINHA, false, 0.42);
  const geoEspinhaE = extrudir(ESPINHA, true, 0.42);
  const geoAletaD = extrudir(ALETA, false, 0.24);
  const geoAletaE = extrudir(ALETA, true, 0.24);

  const pivo = new THREE.Group(); // inclinação (rato)
  const helice = new THREE.Group(); // rotação da hélice
  pivo.add(helice);
  cena.add(pivo);

  for (let i = 0; i < 3; i++) {
    const pa = new THREE.Group();
    pa.rotation.z = (i * Math.PI * 2) / 3;
    for (const [geo, mat, z] of [
      [geoEspinhaD, aco, 0],
      [geoEspinhaE, aco, 0],
      [geoAletaD, acoAleta, -0.08],
      [geoAletaE, acoAleta, -0.08],
    ]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.z = z;
      m.castShadow = true;
      pa.add(m);
    }
    helice.add(pa);
  }

  const centro = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.62, 64), laranja);
  centro.rotation.x = Math.PI / 2;
  centro.castShadow = true;
  helice.add(centro);
  const tampa = new THREE.Mesh(new THREE.SphereGeometry(0.48, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), laranja);
  tampa.rotation.x = Math.PI / 2;
  tampa.scale.set(1, 0.18, 1);
  tampa.position.z = 0.31;
  helice.add(tampa);

  // O centro laranja é o eixo: fica no meio do palco para a hélice não "dançar" ao rodar
  helice.position.y = 0;

  // ---------- Estado de movimento ----------
  const VEL_REPOUSO = reduzirMovimento ? 0 : 0.32; // rad/s
  let velocidade = reduzirMovimento ? 0 : 7; // arranque: gira depressa e abranda até ao repouso
  let alvoX = 0, alvoY = 0;
  let arrastar = null;
  let ultimoScroll = window.scrollY;

  palco.addEventListener("pointermove", (e) => {
    const r = palco.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (arrastar) {
      const dx = e.clientX - arrastar.x;
      helice.rotation.z -= dx * 0.012;
      arrastar.v = (dx * 0.012) / Math.max(1 / 120, (e.timeStamp - arrastar.t) / 1000); // rad/s
      arrastar.x = e.clientX;
      arrastar.t = e.timeStamp;
      pedirFrame();
    }
    if (e.pointerType === "mouse") {
      alvoY = nx * 0.38;
      alvoX = ny * 0.3;
      pedirFrame();
    }
  });
  palco.addEventListener("pointerleave", () => { alvoX = 0; alvoY = 0; pedirFrame(); });
  palco.addEventListener("pointerdown", (e) => {
    arrastar = { x: e.clientX, t: e.timeStamp, v: 0 };
    palco.setPointerCapture(e.pointerId);
  });
  const largar = (e) => {
    if (!arrastar) return;
    // se o dedo parou antes de largar, a hélice não dispara
    const v = e.timeStamp - arrastar.t > 90 ? 0 : arrastar.v;
    velocidade = THREE.MathUtils.clamp(v, -14, 14);
    arrastar = null;
    pedirFrame();
  };
  palco.addEventListener("pointerup", largar);
  palco.addEventListener("pointercancel", largar);

  if (!reduzirMovimento) {
    window.addEventListener("scroll", () => {
      const d = window.scrollY - ultimoScroll;
      ultimoScroll = window.scrollY;
      velocidade = THREE.MathUtils.clamp(velocidade + d * 0.01, -10, 10);
      pedirFrame();
    }, { passive: true });
  }

  // ---------- Tamanho ----------
  function ajustar() {
    const { width, height } = palco.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camara.aspect = width / height;
    camara.updateProjectionMatrix();
    pedirFrame();
  }
  new ResizeObserver(ajustar).observe(palco);

  // ---------- Ciclo ----------
  let visivel = true;
  let pedido = 0;
  let anterior = performance.now();

  new IntersectionObserver(([entrada]) => {
    visivel = entrada.isIntersecting;
    if (visivel) pedirFrame();
  }).observe(palco);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pedirFrame(); });

  function pedirFrame() {
    if (!pedido && visivel && !document.hidden) {
      anterior = performance.now();
      pedido = requestAnimationFrame(frame);
    }
  }

  function frame(agora) {
    pedido = 0;
    const dt = Math.min(0.05, (agora - anterior) / 1000);
    anterior = agora;

    if (!arrastar) {
      // aproxima-se da velocidade de repouso como uma ventoinha a abrandar
      velocidade += (VEL_REPOUSO - velocidade) * Math.min(1, dt * 1.1);
      helice.rotation.z -= velocidade * dt;
    }
    pivo.rotation.x += (alvoX - pivo.rotation.x) * Math.min(1, dt * 5);
    pivo.rotation.y += (alvoY - pivo.rotation.y) * Math.min(1, dt * 5);

    renderer.render(cena, camara);

    const parado =
      Math.abs(velocidade) < 0.001 &&
      Math.abs(alvoX - pivo.rotation.x) < 0.001 &&
      Math.abs(alvoY - pivo.rotation.y) < 0.001;
    if (!parado || arrastar) pedirFrame();
  }

  ajustar();
  renderer.render(cena, camara);
  palco.classList.add("pronto");
  pedirFrame();
}

iniciar();
