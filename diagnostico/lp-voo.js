// Fim da página: a nave da Oddwork (o símbolo) a voar muito depressa pelo espaço.
// Estrelas em riscos, galáxias e poeira a passar, asteroides que a nave desvia e desfaz com lasers.
// Só carrega quando o fim da página se aproxima e pára quando sai do ecrã.
const lugar = document.querySelector("[data-voo]");
const semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;

function temWebGL() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; }
}

if (lugar && temWebGL()) {
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return;
    o.disconnect();
    import("/assets/vendor/three.module.min.js").then(arrancar).catch(() => {});
  }, { rootMargin: "700px 0px" }).observe(lugar);
}

const PA = [
  [[-8, -78], [-34, -82], [-60, -198], [-42, -332], [-8, -376]],
  [[8, -78], [34, -82], [60, -198], [42, -332], [8, -376]],
  [[-50, -92], [-76, -212], [-118, -136], [-100, -102]],
  [[50, -92], [76, -212], [118, -136], [100, -102]],
];

// Brilho redondo (faíscas, clarões, motor).
function brilhoTextura(THREE) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Galáxia em espiral, desenhada ponto a ponto. Núcleo quente, braços frios.
function galaxiaTextura(THREE, semente, braco, nucleo) {
  let s = semente;
  const R = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const gauss = () => (R() + R() + R() - 1.5) / 1.5;
  const N = 512, cv = document.createElement("canvas"); cv.width = cv.height = N;
  const g = cv.getContext("2d"), c = N / 2;
  const halo = g.createRadialGradient(c, c, 0, c, c, c);
  halo.addColorStop(0, `rgba(${nucleo},1)`); halo.addColorStop(0.1, `rgba(${nucleo},.5)`); halo.addColorStop(0.3, `rgba(${braco},.12)`); halo.addColorStop(0.7, `rgba(${braco},.03)`); halo.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = halo; g.fillRect(0, 0, N, N);
  g.globalCompositeOperation = "lighter";
  const bracos = 2 + Math.floor(R() * 2), torcao = 2.2 + R() * 1.2;

  for (let i = 0; i < 16000; i++) {
    const d = Math.pow(R(), 0.65), arm = Math.floor(R() * bracos);
    const ang = arm * (2 * Math.PI / bracos) + d * torcao * Math.PI + gauss() * (0.75 - d * 0.3);
    const raio = d * c * 0.9 + gauss() * 14;
    const x = c + Math.cos(ang) * raio, y = c + Math.sin(ang) * raio;
    const quente = d < 0.18 || R() < 0.08;
    g.fillStyle = `rgba(${quente ? nucleo : braco},${(0.08 + R() * 0.3) * (1 - d * 0.7)})`;
    const t = R() < 0.03 ? 2.6 : R() < 0.4 ? 1.8 : 1.1;
    g.fillRect(x, y, t, t);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Poeira de nebulosa: mancha suave e irregular.
function poeiraTextura(THREE, semente) {
  let s = semente;
  const R = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const N = 256, cv = document.createElement("canvas"); cv.width = cv.height = N;
  const g = cv.getContext("2d");
  for (let i = 0; i < 26; i++) {
    const x = N / 2 + (R() - 0.5) * N * 0.5, y = N / 2 + (R() - 0.5) * N * 0.4, r = N * (0.12 + R() * 0.22);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,255,255,.16)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function arrancar(THREE) {
  const telemovel = matchMedia("(max-width: 900px)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, telemovel ? 1.6 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const FUNDO = 0x0d1222;
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(FUNDO);
  cena.fog = new THREE.Fog(FUNDO, 1800, 5200);
  const camara = new THREE.PerspectiveCamera(42, 2, 5, 12000);
  const alvo = new THREE.Vector3(0, 0, -260);
  const R = Math.random;
  const suave = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const tBrilho = brilhoTextura(THREE);

  // Luzes
  cena.add(new THREE.HemisphereLight(0x9fb2e6, 0x0b0e18, 0.7));
  const chave = new THREE.DirectionalLight(0xe8edff, 1.6); chave.position.set(400, 700, 500); cena.add(chave);
  const contra = new THREE.DirectionalLight(0xff7a30, 1.4); contra.position.set(-300, -100, -800); cena.add(contra);
  const clarao = new THREE.PointLight(0xffa060, 0, 1400, 1.4); cena.add(clarao);

  // ---------- A nave ----------
  const matPa = new THREE.MeshPhysicalMaterial({ color: 0xe9ebf2, metalness: 0.25, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.3 });
  const matCentro = new THREE.MeshPhysicalMaterial({ color: 0xf26a21, emissive: 0xf26a21, emissiveIntensity: 1.2, roughness: 0.3, clearcoat: 1 });
  const extr = { depth: 56, bevelEnabled: true, bevelThickness: 10, bevelSize: 7, bevelSegments: 3, curveSegments: 1 };
  const simbolo = new THREE.Group();
  for (let r = 0; r < 3; r++) {
    const a = (r * 2 * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a);
    for (const peca of PA) {
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(peca.map(([x, y]) => new THREE.Vector2(x * c - y * s, -(x * s + y * c)))), extr);
      g.translate(0, 0, -28);
      simbolo.add(new THREE.Mesh(g, matPa));
    }
  }
  const centro = new THREE.Mesh(new THREE.CylinderGeometry(52, 52, 96, 48), matCentro);
  centro.rotation.x = Math.PI / 2; simbolo.add(centro);
  // motor: brilho atrás do núcleo
  const motor = new THREE.Sprite(new THREE.SpriteMaterial({ map: tBrilho, color: 0xff8a3a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  motor.position.set(0, 0, 70); motor.scale.setScalar(260); simbolo.add(motor);
  const nave = new THREE.Group(); nave.add(simbolo); nave.scale.setScalar(0.34); cena.add(nave);
  // pontas das três pás (de onde saem os lasers), em coordenadas do símbolo
  const PONTAS = [0, 1, 2].map((r) => { const a = (r * 2 * Math.PI) / 3; return new THREE.Vector3(376 * Math.sin(a) * 0.9, -376 * Math.cos(a) * 0.9, -20); });

  // ---------- Estrelas em riscos ----------
  const NE = telemovel ? 520 : 1000, LONGE = -5200, PERTO = 700;
  const ePos = new Float32Array(NE * 6), eCor = new Float32Array(NE * 6), estrelas = [];
  for (let i = 0; i < NE; i++) {
    const quente = R() < 0.12, b = 0.55 + R() * 0.45;
    const cor = quente ? [1, 0.72 * b + 0.2, 0.5 * b] : [0.78 * b + 0.15, 0.84 * b + 0.12, b];
    for (let k = 0; k < 2; k++) eCor.set(k ? cor.map((x) => x * 0.15) : cor, i * 6 + k * 3);
    estrelas.push({ x: 0, y: 0, z: LONGE + R() * (PERTO - LONGE) });
    novaEstrela(estrelas[i], true);
  }
  function novaEstrela(e, qualquer) {
    // longe do centro, para não atravessarem a nave
    let x, y; do { x = (R() - 0.5) * 4200; y = (R() - 0.5) * 2600; } while (Math.abs(x) < 160 && Math.abs(y) < 110);
    e.x = x; e.y = y; if (!qualquer) e.z = LONGE - R() * 400;
  }
  const gE = new THREE.BufferGeometry();
  gE.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
  gE.setAttribute("color", new THREE.BufferAttribute(eCor, 3));
  cena.add(new THREE.LineSegments(gE, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })));

  // ---------- Galáxias e poeira ----------
  const tGal = [
    galaxiaTextura(THREE, 11, "170,185,225", "255,214,170"),
    galaxiaTextura(THREE, 29, "255,150,90", "255,236,210"),
    galaxiaTextura(THREE, 47, "200,190,180", "255,240,220"),
  ];
  const galaxias = [];
  for (let i = 0; i < (telemovel ? 3 : 4); i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tGal[i % tGal.length], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    cena.add(s);
    const g = { s, giro: (R() - 0.5) * 0.12 };
    novaGalaxia(g, LONGE + (i / 4) * (PERTO - LONGE) * 0.8);
    galaxias.push(g);
  }
  function novaGalaxia(g, z) {
    const lado = R() < 0.5 ? -1 : 1;
    g.s.position.set(lado * (700 + R() * 1500), (R() - 0.5) * 1400, z ?? LONGE - 600 - R() * 1200);
    g.tam = 600 + R() * 800; g.s.scale.setScalar(g.tam); g.s.material.rotation = R() * 6.28;
  }
  const tPo = [poeiraTextura(THREE, 5), poeiraTextura(THREE, 9)];
  const CORES_PO = [0x1f2c52, 0x243258, 0x6a3418, 0x1c2a4a];
  const poeiras = [];
  for (let i = 0; i < (telemovel ? 5 : 8); i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tPo[i % 2], color: CORES_PO[i % CORES_PO.length], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    cena.add(s);
    const p = { s }; novaPoeira(p, LONGE + R() * (PERTO - LONGE)); poeiras.push(p);
  }
  function novaPoeira(p, z) {
    p.s.position.set((R() - 0.5) * 3600, (R() - 0.5) * 2200, z ?? LONGE - R() * 800);
    p.s.scale.setScalar(1400 + R() * 1800); p.s.material.rotation = R() * 6.28; p.forca = 0.25 + R() * 0.3;
  }

  // ---------- Asteroides ----------
  const matPedra = new THREE.MeshStandardMaterial({ color: 0x6a7290, roughness: 0.88, flatShading: true });
  const asteroides = [];
  for (let i = 0; i < 6; i++) {
    const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const f = 0.75 + R() * 0.45; p.setXYZ(k, p.getX(k) * f, p.getY(k) * f, p.getZ(k) * f); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, matPedra); cena.add(m);
    const a = { m, vivo: false, espera: 1 + i * 1.6 + R() * 2, rot: new THREE.Vector3(R(), R(), R()).multiplyScalar(1.5) };
    m.visible = false; asteroides.push(a);
  }
  function novoAsteroide(a) {
    a.raio = 26 + R() * 38; a.m.scale.setScalar(a.raio);
    // uns passam perto da rota da nave (para ela atirar), outros ao lado
    const perto = R() < 0.65;
    a.m.position.set(perto ? (R() - 0.5) * 520 : (R() < 0.5 ? -1 : 1) * (420 + R() * 700), perto ? (R() - 0.5) * 300 : (R() - 0.5) * 900, LONGE + 200);
    a.vivo = true; a.m.visible = true;
  }

  // ---------- Lasers, faíscas e explosões ----------
  const matLaser = new THREE.MeshBasicMaterial({ color: 0xffe2c4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const matHalo = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const gLaser = new THREE.CylinderGeometry(2.4, 2.4, 300, 6); gLaser.rotateX(Math.PI / 2);
  const gHalo = new THREE.CylinderGeometry(9, 9, 330, 8); gHalo.rotateX(Math.PI / 2);
  const lasers = [];
  for (let i = 0; i < 24; i++) {
    const g = new THREE.Group(); g.add(new THREE.Mesh(gLaser, matLaser), new THREE.Mesh(gHalo, matHalo)); g.visible = false; cena.add(g);
    lasers.push({ g, vivo: false, v: new THREE.Vector3(), idade: 0 });
  }
  const NP = telemovel ? 260 : 420;
  const pPos = new Float32Array(NP * 3), pCor = new Float32Array(NP * 3), parts = [];
  for (let i = 0; i < NP; i++) parts.push({ p: new THREE.Vector3(0, 0, 9999), v: new THREE.Vector3(), idade: 1, vida: 1, c: new THREE.Color() });
  const gP = new THREE.BufferGeometry();
  gP.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  gP.setAttribute("color", new THREE.BufferAttribute(pCor, 3));
  cena.add(new THREE.Points(gP, new THREE.PointsMaterial({ size: 9, map: tBrilho, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  let proxP = 0;
  function particula(pos, vel, vida, cor) {
    const q = parts[proxP]; proxP = (proxP + 1) % NP;
    q.p.copy(pos); q.v.copy(vel); q.idade = 0; q.vida = vida; q.c.set(cor);
  }
  const flashes = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tBrilho, color: 0xffb070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    cena.add(s); flashes.push({ s, idade: 1, vida: 1, tam: 1 });
  }
  let proxF = 0;
  function flash(pos, tam, vida) { const f = flashes[proxF]; proxF = (proxF + 1) % flashes.length; f.s.position.copy(pos); f.tam = tam; f.vida = vida; f.idade = 0; }
  function explodir(pos, raio) {
    flash(pos, raio * 9, 0.55);
    clarao.position.copy(pos); clarao.intensity = 2.2e4;
    for (let i = 0; i < 46; i++) {
      const d = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize().multiplyScalar(220 + R() * 520);
      d.z += 900; // o mundo continua a vir na nossa direção
      particula(pos, d, 0.5 + R() * 0.7, R() < 0.5 ? 0xffb070 : 0xff5a1a);
    }
  }

  // ---------- Tamanho e câmara ----------
  lugar.appendChild(renderer.domElement);
  let amplX = 300, amplY = 120;
  function ajustar() {
    const { width, height } = lugar.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camara.aspect = width / height;
    camara.updateProjectionMatrix();
    const tg = Math.tan((camara.fov * Math.PI) / 360);
    const dist = Math.max(620, (camara.aspect < 1 ? 175 : 300) / (tg * camara.aspect));
    camara.userData.sobe = camara.aspect < 1 ? 110 : 45;
    camara.userData.dist = dist;
    amplX = Math.min(420, dist * tg * camara.aspect * 0.55);
    amplY = Math.min(170, dist * tg * 0.32);
  }
  ajustar();
  new ResizeObserver(ajustar).observe(lugar);

  // ---------- Animação ----------
  let a = null, visivel = false, ultimo = null, t = 0;
  let vel = 2600, boost = 0, proxBoost = 4 + R() * 4;
  const pos = new THREE.Vector3(), velNave = new THREE.Vector3(), mira = new THREE.Vector3();
  let rajada = 0, proxTiro = 0, ponta = 0, esperaRajada = 1.2, giro = 0;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  const desenhar = (agora) => {
    const dt = ultimo === null ? 1 / 60 : Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora; t += dt;

    // velocidade com acelerações de vez em quando
    proxBoost -= dt;
    if (proxBoost <= 0) { boost = 1; proxBoost = 6 + R() * 6; }
    boost = Math.max(0, boost - dt * 0.45);
    const vAlvo = 2400 + suave(0, 0.6, boost) * (1 - suave(0.6, 1, 1 - boost)) * 3600;
    vel += (vAlvo - vel) * Math.min(1, dt * 2.5);
    const kVel = (vel - 2400) / 3600;

    // rota: a nave anda de um lado para o outro; quando há um asteroide à frente, vai atrás dele
    let alvoAst = null, melhor = Infinity;
    for (const as of asteroides) if (as.vivo && as.m.position.z < -700 && as.m.position.z > -3600 && Math.abs(as.m.position.x) < amplX * 1.3) {
      const d = -as.m.position.z; if (d < melhor) { melhor = d; alvoAst = as; }
    }
    if (alvoAst) mira.set(alvoAst.m.position.x, alvoAst.m.position.y * 0.6, 0);
    else mira.set(Math.sin(t * 0.55) * amplX + Math.sin(t * 1.37) * amplX * 0.25, Math.sin(t * 0.83 + 1) * amplY, 0);
    mira.x = Math.max(-amplX, Math.min(amplX, mira.x)); mira.y = Math.max(-amplY, Math.min(amplY, mira.y));
    tmp.copy(mira).sub(pos).multiplyScalar(2.2).sub(velNave.clone().multiplyScalar(1.6));
    velNave.addScaledVector(tmp, dt * 2.2);
    pos.addScaledVector(velNave, dt);
    nave.position.copy(pos);
    // inclina para onde vira, e roda sobre si mesma
    giro += dt * (0.9 + kVel * 2.2);
    nave.rotation.set(velNave.y * 0.0016 - 0.12, -velNave.x * 0.0012, 0);
    simbolo.rotation.z = giro - velNave.x * 0.0011;
    matCentro.emissiveIntensity = 1.1 + 0.4 * Math.sin(t * 9) + kVel * 1.2;
    motor.material.opacity = 0.75 + 0.25 * Math.sin(t * 23) + kVel * 0.4;
    motor.scale.setScalar(240 + kVel * 160 + Math.sin(t * 31) * 18);

    // câmara atrás e um pouco ao lado, a acompanhar com atraso; abre o ângulo nas acelerações
    const dist = camara.userData.dist || 700;
    const sobe = camara.userData.sobe || 45;
    camara.position.set(pos.x * 0.45 - dist * 0.16, pos.y * 0.45 + dist * 0.2 - sobe, dist);
    camara.position.x += (R() - 0.5) * kVel * 3; camara.position.y += (R() - 0.5) * kVel * 3;
    camara.fov += ((42 + kVel * 10) - camara.fov) * Math.min(1, dt * 3); camara.updateProjectionMatrix();
    alvo.set(pos.x * 0.6, pos.y * 0.6 - sobe, -260);
    camara.lookAt(alvo);

    // estrelas: riscos tanto mais longos quanto mais depressa
    const risco = 30 + vel * 0.055;
    for (let i = 0; i < NE; i++) {
      const e = estrelas[i];
      e.z += vel * dt;
      if (e.z > PERTO) novaEstrela(e, false);
      ePos[i * 6] = e.x; ePos[i * 6 + 1] = e.y; ePos[i * 6 + 2] = e.z;
      ePos[i * 6 + 3] = e.x; ePos[i * 6 + 4] = e.y; ePos[i * 6 + 5] = e.z - risco;
    }
    gE.attributes.position.needsUpdate = true;

    // galáxias e poeira passam mais devagar (estão longe)
    for (const g of galaxias) {
      g.s.position.z += vel * dt * 0.32;
      g.s.material.rotation += g.giro * dt;
      const z = g.s.position.z;
      g.s.material.opacity = suave(LONGE - 1400, LONGE + 900, z) * (1 - suave(-900, 0, z)) * 0.75;
      if (z > 300) novaGalaxia(g);
    }
    for (const p of poeiras) {
      p.s.position.z += vel * dt * 0.5;
      const z = p.s.position.z;
      p.s.material.opacity = p.forca * suave(LONGE - 800, LONGE + 1200, z) * (1 - suave(-200, 500, z));
      if (z > 500) novaPoeira(p);
    }

    // asteroides
    for (const as of asteroides) {
      if (!as.vivo) { as.espera -= dt; if (as.espera <= 0) novoAsteroide(as); continue; }
      as.m.position.z += vel * dt * 0.85;
      as.m.rotation.x += as.rot.x * dt; as.m.rotation.y += as.rot.y * dt;
      if (as.m.position.z > PERTO) { as.vivo = false; as.m.visible = false; as.espera = 0.5 + R() * 2.5; }
    }

    // tiros: rajadas a partir das pontas das pás, sobretudo com um asteroide na mira
    esperaRajada -= dt;
    const alinhado = alvoAst && Math.abs(alvoAst.m.position.x - pos.x) < 90 && Math.abs(alvoAst.m.position.y - pos.y) < 90;
    if (rajada <= 0 && (esperaRajada <= 0 || (alinhado && esperaRajada < 0.8))) { rajada = 3 + Math.floor(R() * 5); proxTiro = 0; esperaRajada = 1.4 + R() * 2.2; }
    if (rajada > 0) {
      proxTiro -= dt;
      if (proxTiro <= 0) {
        const l = lasers.find((x) => !x.vivo);
        if (l) {
          nave.updateMatrixWorld(true);
          tmp.copy(PONTAS[ponta]).applyMatrix4(simbolo.matrixWorld);
          ponta = (ponta + 1) % 3;
          l.g.position.copy(tmp); l.v.set((alvoAst ? (alvoAst.m.position.x - tmp.x) * 0.25 : 0), (alvoAst ? (alvoAst.m.position.y - tmp.y) * 0.25 : 0), -2700);
          l.g.lookAt(tmp2.copy(tmp).add(l.v)); l.vivo = true; l.idade = 0; l.g.visible = true;
          flash(tmp, 70, 0.12);
          clarao.position.copy(tmp); clarao.intensity = Math.max(clarao.intensity, 6e3);
        }
        rajada--; proxTiro = 0.075 + R() * 0.05;
      }
    }
    for (const l of lasers) {
      if (!l.vivo) continue;
      l.idade += dt; l.g.position.addScaledVector(l.v, dt);
      for (const as of asteroides) {
        if (as.vivo && l.g.position.distanceTo(as.m.position) < as.raio + 30) {
          explodir(as.m.position, as.raio); as.vivo = false; as.m.visible = false; as.espera = 0.8 + R() * 2;
          l.vivo = false; break;
        }
      }
      if (l.idade > 1.7 || l.g.position.z < LONGE) l.vivo = false;
      if (!l.vivo) l.g.visible = false;
    }

    // fogo do motor: faíscas que saem de trás e ficam para trás
    nave.updateMatrixWorld(true);
    tmp.set(0, 0, 60).applyMatrix4(simbolo.matrixWorld);
    for (let i = 0; i < (telemovel ? 3 : 5); i++) {
      tmp2.set((R() - 0.5) * 60, (R() - 0.5) * 60, 700 + vel * 0.25 + R() * 300).add(velNave.clone().multiplyScalar(-0.3));
      particula(tmp, tmp2, 0.25 + R() * 0.3, R() < 0.3 ? 0xfff0d8 : R() < 0.6 ? 0xff9a4a : 0xff5a1a);
    }
    for (let i = 0; i < NP; i++) {
      const q = parts[i];
      if (q.idade >= q.vida) { pPos[i * 3 + 2] = 99999; continue; }
      q.idade += dt; q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 1.2);
      const k = 1 - q.idade / q.vida;
      pPos[i * 3] = q.p.x; pPos[i * 3 + 1] = q.p.y; pPos[i * 3 + 2] = q.p.z;
      pCor[i * 3] = q.c.r * k; pCor[i * 3 + 1] = q.c.g * k; pCor[i * 3 + 2] = q.c.b * k;
    }
    gP.attributes.position.needsUpdate = true; gP.attributes.color.needsUpdate = true;

    for (const f of flashes) {
      if (f.idade >= f.vida) { f.s.material.opacity = 0; continue; }
      f.idade += dt; const k = f.idade / f.vida;
      f.s.material.opacity = (1 - k) * (1 - k); f.s.scale.setScalar(f.tam * (0.6 + k * 0.8));
      f.s.position.z += vel * dt * 0.85;
    }
    clarao.intensity *= Math.max(0, 1 - dt * 9);

    renderer.render(cena, camara);
    a = visivel && !semMovimento ? requestAnimationFrame(desenhar) : null;
  };

  new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting && !document.hidden;
    if (visivel && !a && !semMovimento) { ultimo = null; a = requestAnimationFrame(desenhar); }
  }, { threshold: [0, 0.2] }).observe(lugar);
  document.addEventListener("visibilitychange", () => {
    const r = lugar.getBoundingClientRect();
    visivel = !document.hidden && r.top < innerHeight && r.bottom > 0;
    if (visivel && !a && !semMovimento) { ultimo = null; a = requestAnimationFrame(desenhar); }
  });

  desenhar(performance.now());
  lugar.classList.add("lp-voo--pronta");
  lugar.__voo = { lasers, asteroides };
}
