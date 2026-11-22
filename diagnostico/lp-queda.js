// Fim da página: o símbolo da Oddwork caído e cravado no chão, numa cratera com fendas a brilhar.
// Só carrega quando o fim da página se aproxima. Sem WebGL a faixa fica só com o brilho em CSS.
const lugar = document.querySelector("[data-queda]");
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

// Aleatório com semente, para o chão ser sempre igual.
let semente = 7;
const rnd = () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;

// Ruído suave para o relevo do chão.
function ruido(x, y) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Altura do chão: cratera no centro, rebordo levantado à volta, pequenas irregularidades.
function altura(x, z) {
  const r = Math.hypot(x, z * 1.15);
  const buraco = -70 * Math.exp(-((r / 175) ** 2));
  const rebordo = 34 * Math.exp(-(((r - 235) / 75) ** 2)) * (0.75 + 0.5 * ruido(x / 90, z / 90));
  const rugas = (ruido(x / 140, z / 140) - 0.5) * 22 + (ruido(x / 40, z / 40) - 0.5) * 6;
  return buraco + rebordo + rugas * Math.min(1, r / 160);
}

// Textura do chão: queimado à volta, fendas a partir do centro; e outra só com o brilho das fendas.
function texturas(THREE) {
  const N = 2048, ESC = 1600 / 2600, cor = document.createElement("canvas"), luz = document.createElement("canvas");
  cor.width = cor.height = luz.width = luz.height = N;
  const c = cor.getContext("2d"), l = luz.getContext("2d");
  c.fillStyle = "#1b2337"; c.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) { // grão
    c.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,255" : "0,0,0"},${0.02 + rnd() * 0.04})`;
    c.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 5, 1 + rnd() * 5);
  }
  for (const ctx of [c, l]) { ctx.translate(N / 2, N / 2); ctx.scale(ESC, ESC); ctx.translate(-N / 2, -N / 2); }
  let g = c.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N * 0.3);
  g.addColorStop(0, "rgba(8,10,16,.95)"); g.addColorStop(0.45, "rgba(10,12,20,.6)"); g.addColorStop(1, "rgba(10,12,20,0)");
  c.fillStyle = g; c.fillRect(0, 0, N, N);
  l.fillStyle = "#000"; l.fillRect(-N, -N, 3 * N, 3 * N);
  g = l.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N * 0.12);
  g.addColorStop(0, "rgba(242,106,33,.55)"); g.addColorStop(1, "rgba(242,106,33,0)");
  l.fillStyle = g; l.fillRect(0, 0, N, N);

  const fenda = (x, y, ang, comp, larg, nivel) => {
    const pts = [[x, y]];
    for (let s = 0; s < comp; s += 14) {
      ang += (rnd() - 0.5) * 0.55; x += Math.cos(ang) * 14; y += Math.sin(ang) * 14; pts.push([x, y]);
      if (nivel < 2 && rnd() < 0.05) fenda(x, y, ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), comp * 0.45, larg * 0.6, nivel + 1);
    }
    const tracar = (ctx, w, estilo) => {
      ctx.strokeStyle = estilo; ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let i = 1; i < pts.length; i++) {
        const k = 1 - i / pts.length; ctx.lineWidth = Math.max(0.6, w * k);
        ctx.beginPath(); ctx.moveTo(...pts[i - 1]); ctx.lineTo(...pts[i]); ctx.stroke();
      }
    };
    tracar(c, larg * 2.2, "rgba(4,5,9,.9)");
    const quente = Math.max(0, 1 - nivel * 0.45);
    tracar(c, larg * 0.7, `rgba(255,140,70,${0.55 * quente})`);
    tracar(l, larg * 0.9, `rgba(255,${120 + 40 * quente},60,${quente})`);
  };
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rnd() * 0.4;
    fenda(N / 2 + Math.cos(a) * 60, N / 2 + Math.sin(a) * 60, a, 260 + rnd() * 420, 7 + rnd() * 5, 0);
  }
  const t1 = new THREE.CanvasTexture(cor), t2 = new THREE.CanvasTexture(luz);
  t1.colorSpace = THREE.SRGBColorSpace; t2.colorSpace = THREE.SRGBColorSpace;
  t1.anisotropy = t2.anisotropy = 8;
  return [t1, t2];
}

function fumoTextura(THREE) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const x = cv.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Textura de fumo: ruído fractal (fiapos) dentro de uma bola suave, com luz por cima e sombra por baixo.
function nuvemTextura(THREE) {
  const N = 128, cv = document.createElement("canvas"); cv.width = cv.height = N;
  const x = cv.getContext("2d"), img = x.createImageData(N, N);
  const ox = Math.random() * 1000, oy = Math.random() * 1000;
  const fbm = (u, v) => { let s = 0, a = 0.5, f = 1; for (let o = 0; o < 5; o++) { s += a * ruido(u * f + ox, v * f + oy); a *= 0.5; f *= 2.03; } return s; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N - 0.5, v = j / N - 0.5, r = Math.hypot(u, v) * 2;
    // a borda é deformada pelo ruído, para não ser um círculo
    const n = fbm(i / 22, j / 22), borda = 1 - Math.min(1, Math.max(0, (r + (n - 0.5) * 0.55 - 0.25) / 0.7));
    const dens = Math.max(0, Math.min(1, (n - 0.3) * 1.9)) * borda * borda;
    const luz = 0.72 + 0.28 * Math.max(0, Math.min(1, 0.5 - v * 1.4 - u * 0.4)) + (n - 0.5) * 0.25;
    const k = (j * N + i) * 4, c = Math.max(0, Math.min(255, luz * 255));
    img.data[k] = c; img.data[k + 1] = c; img.data[k + 2] = c; img.data[k + 3] = dens * 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function arrancar(THREE) {
  const telemovel = matchMedia("(max-width: 900px)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, telemovel ? 1.75 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const NOITE = 0x131a2b;
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(NOITE);
  cena.fog = new THREE.Fog(NOITE, 1100, 2600);
  const camara = new THREE.PerspectiveCamera(30, 2, 10, 8000);
  const alvo = new THREE.Vector3(0, 112, 0);

  cena.add(new THREE.HemisphereLight(0x8fa3d6, 0x0b0e18, 0.55));
  const lua = new THREE.DirectionalLight(0xdfe6ff, 1.5);
  lua.position.set(700, 1100, 500); cena.add(lua);
  const recorte = new THREE.DirectionalLight(0xf26a21, 1.2);
  recorte.position.set(-300, 200, -900); cena.add(recorte);
  const brasa = new THREE.PointLight(0xff7a30, 0, 900, 1.6);
  brasa.position.set(0, 40, 40); cena.add(brasa);

  // Chão
  const [mapa, brilho] = texturas(THREE);
  const LADO = 2600, geo = new THREE.PlaneGeometry(LADO, LADO, 300, 300);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, altura(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const matChao = new THREE.MeshStandardMaterial({ map: mapa, emissiveMap: brilho, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.97, metalness: 0 });
  cena.add(new THREE.Mesh(geo, matChao));
  const longe = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x1b2337, roughness: 1 }));
  longe.rotation.x = -Math.PI / 2; longe.position.y = -2; cena.add(longe);

  // Pedras soltas à volta
  const matPedra = new THREE.MeshStandardMaterial({ color: 0x232c44, roughness: 0.9, flatShading: true });
  const pedras = [];
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, r = 150 + rnd() ** 1.6 * 480, t = 5 + rnd() ** 2 * 24;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(t, 0), matPedra);
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85;
    m.position.set(x, altura(x, z) + t * 0.35, z);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    m.scale.set(1, 0.55 + rnd() * 0.5, 1);
    cena.add(m); pedras.push({ m, final: m.position.clone(), a, r });
  }

  // A nave (o símbolo), inclinada, com uma pá enterrada
  const matPa = new THREE.MeshPhysicalMaterial({ color: 0xe9ebf2, metalness: 0.2, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.4 });
  const matCentro = new THREE.MeshPhysicalMaterial({ color: 0xf26a21, emissive: 0xf26a21, emissiveIntensity: 0.9, roughness: 0.3, clearcoat: 1 });
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
  simbolo.rotation.z = Math.PI + 0.22; // uma pá para baixo, ligeiramente de lado
  const nave = new THREE.Group();
  nave.add(simbolo);
  nave.scale.setScalar(0.6);
  const POUSO = { pos: new THREE.Vector3(10, 92, 0), rot: new THREE.Euler(-0.3, 0.28, 0.1) };
  nave.position.copy(POUSO.pos); nave.rotation.copy(POUSO.rot);
  cena.add(nave);

  // ---------- Efeitos: fumo, faíscas, raios e feixes de luz ----------
  const R = Math.random;
  const suaveK = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const tFumo = fumoTextura(THREE);
  const tNuvens = [0, 1, 2, 3, 4].map(() => nuvemTextura(THREE));

  // Fumo: colunas que saem da cratera e das fendas. Cada baforada nasce pequena e densa,
  // abre ao subir, inclina com o vento, perde a cor da brasa e desfaz-se devagar no alto.
  const NFU = telemovel ? 70 : 130;
  const corBrasa = new THREE.Color(0xb0704a), corFumo = new THREE.Color(0x6a738a), corAlto = new THREE.Color(0x485067);
  const FONTES = [
    { x: -40, z: -120, ritmo: 8, forca: 1 },    // atrás da nave, a coluna principal
    { x: 150, z: -95, ritmo: 5, forca: 0.8 },
    { x: -340, z: 20, ritmo: 3.2, forca: 0.65 }, // fendas dos lados
    { x: 345, z: 0, ritmo: 3, forca: 0.6 },
  ];
  for (const f of FONTES) { f.y = altura(f.x, f.z); f.acum = R(); }
  const fumos = [];
  const nascerFumo = (f, fonte, poeira = false) => {
    if (poeira) {
      const a = R() * Math.PI * 2, v = 200 + R() * 240;
      f.p.set(Math.cos(a) * (40 + R() * 70), 15 + R() * 25, Math.sin(a) * (40 + R() * 70) * 0.7);
      f.v.set(Math.cos(a) * v, 30 + R() * 70, Math.sin(a) * v * 0.6);
      f.vida = 2.6 + R() * 1.8; f.t0 = 90 + R() * 60; f.cresce = 120 + R() * 60; f.op = 0.32 + R() * 0.12;
    } else {
      f.p.set(fonte.x + (R() - 0.5) * 30, fonte.y + 6 + R() * 10, fonte.z + (R() - 0.5) * 24);
      f.v.set((R() - 0.5) * 8, 75 + R() * 35, (R() - 0.5) * 6);
      f.vida = 6.5 + R() * 4; f.t0 = 22 + R() * 16; f.cresce = 26 + R() * 18; f.op = (0.55 + R() * 0.2) * fonte.forca;
    }
    f.idade = 0; f.poeira = poeira; f.vivo = true; f.giro = (R() - 0.5) * 0.5; f.semente = R() * 100; f.v0 = f.v.y;
    f.s.material.map = tNuvens[(R() * tNuvens.length) | 0]; f.s.material.rotation = R() * 6.28;
  };
  for (let i = 0; i < NFU + 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tNuvens[0], transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false; cena.add(s);
    fumos.push({ s, p: s.position, v: new THREE.Vector3(), vivo: false, extra: i >= NFU, idade: 0, vida: 1 });
  }
  let proxFumo = 0;
  const soltarFumo = (fonte) => {
    for (let n = 0; n < NFU; n++) {
      const f = fumos[proxFumo]; proxFumo = (proxFumo + 1) % NFU;
      if (!f.vivo) { nascerFumo(f, fonte); return f; }
    }
    return null;
  };
  const atualizarFumo = (f, dt) => {
    f.idade += dt;
    if (f.idade >= f.vida) { f.vivo = false; f.s.visible = false; return; }
    const k = f.idade / f.vida;
    if (f.poeira) f.v.multiplyScalar(Math.max(0, 1 - dt * 2.4));
    else {
      f.v.y = f.v0 * Math.exp(-f.idade * 0.22) + 8;                 // impulso quente que vai perdendo força
      f.v.x += (6 + f.p.y * 0.035 - f.v.x) * dt * 0.6;               // vento, mais forte em cima
    }
    f.p.addScaledVector(f.v, dt);
    f.p.x += Math.sin(f.idade * 1.1 + f.semente) * 9 * dt;           // remoinhos
    f.p.z += Math.cos(f.idade * 0.9 + f.semente) * 6 * dt;
    f.s.material.rotation += f.giro * Math.exp(-f.idade * 0.3) * dt;
    f.s.scale.setScalar(f.t0 + f.cresce * Math.pow(f.idade, 0.85));
    const alto = 1 - suaveK(380, 600, f.p.y);
    f.s.material.opacity = f.op * suaveK(0, 0.08, k) * Math.pow(1 - k, 1.7) * alto;
    const c = f.s.material.color;
    if (f.poeira) c.copy(corFumo).lerp(corBrasa, 0.25);
    else { c.copy(corBrasa).lerp(corFumo, suaveK(0, 0.3, k)); c.lerp(corAlto, suaveK(0.4, 1, k)); }
    f.s.visible = true;
  };

  // Faíscas: sobem das fendas com turbulência; de vez em quando, um jato que sobe e cai.
  const NF = telemovel ? 110 : 180;
  const fPos = new Float32Array(NF * 3), fCor = new Float32Array(NF * 3), faiscas = [];
  for (let i = 0; i < NF; i++) faiscas.push({ p: new THREE.Vector3(0, -999, 0), v: new THREE.Vector3(), idade: 0, vida: 0, g: 0, semente: R() * 50 });
  const gF = new THREE.BufferGeometry();
  gF.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
  gF.setAttribute("color", new THREE.BufferAttribute(fCor, 3));
  const pontos = new THREE.Points(gF, new THREE.PointsMaterial({ size: 7, map: tFumo, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  cena.add(pontos);
  let proxFaisca = 0;
  const lancarFaisca = (jato, ox = 0, oz = 0) => {
    const f = faiscas[proxFaisca]; proxFaisca = (proxFaisca + 1) % NF;
    const a = R() * Math.PI * 2;
    if (jato) {
      f.p.set(ox + (R() - 0.5) * 20, 30, oz + (R() - 0.5) * 20);
      const v = 120 + R() * 220; f.v.set(Math.cos(a) * v * 0.6, 200 + R() * 260, Math.sin(a) * v * 0.4);
      f.g = 380; f.vida = 0.9 + R() * 0.9;
    } else {
      const r = 40 + R() * 260; f.p.set(Math.cos(a) * r, altura(Math.cos(a) * r, Math.sin(a) * r * 0.85) + 4, Math.sin(a) * r * 0.85);
      f.v.set((R() - 0.5) * 20, 45 + R() * 80, (R() - 0.5) * 12); f.g = -6; f.vida = 2.2 + R() * 2.6;
    }
    f.idade = 0;
  };
  const jato = (n) => { const a = R() * Math.PI * 2, r = 40 + R() * 120; for (let i = 0; i < n; i++) lancarFaisca(true, Math.cos(a) * r, Math.sin(a) * r * 0.6); };

  // Raios: descargas laranja que saltam da nave para o chão, em zigue-zague, sem padrão fixo.
  const matRaio = new THREE.MeshBasicMaterial({ color: 0xffc08a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const matRaioHalo = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const raios = [];
  for (let i = 0; i < 4; i++) {
    const nucleo = new THREE.Mesh(new THREE.BufferGeometry(), matRaio.clone()), halo = new THREE.Mesh(new THREE.BufferGeometry(), matRaioHalo.clone());
    cena.add(nucleo, halo); raios.push({ nucleo, halo, vida: 0, idade: 0, a: null, b: null, prox: 0 });
  }
  const centroMundo = new THREE.Vector3();
  const desenharRaio = (r) => {
    const pts = [], N = 12, dir = r.b.clone().sub(r.a), comp = dir.length();
    const lado = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (let i = 0; i <= N; i++) {
      const k = i / N, desvio = Math.sin(k * Math.PI) * comp * 0.12;
      pts.push(r.a.clone().lerp(r.b, k).add(lado.clone().multiplyScalar((R() - 0.5) * desvio)).add(new THREE.Vector3(0, (R() - 0.5) * desvio, 0)));
    }
    const curva = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1);
    r.nucleo.geometry.dispose(); r.halo.geometry.dispose();
    r.nucleo.geometry = new THREE.TubeGeometry(curva, 48, 1.4, 4);
    r.halo.geometry = new THREE.TubeGeometry(curva, 48, 5.5, 5);
  };
  const lancarRaio = (r) => {
    centro.getWorldPosition(centroMundo);
    const a = R() * Math.PI * 2, d = 140 + R() * 300, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.7;
    r.a = centroMundo.clone().add(new THREE.Vector3((R() - 0.5) * 50, (R() - 0.5) * 50, 0));
    r.b = new THREE.Vector3(x, altura(x, z) + 2, z);
    r.idade = 0; r.vida = 0.16 + R() * 0.28; r.prox = 0;
    desenharRaio(r);
    for (let i = 0; i < 10; i++) lancarFaisca(true, x, z);
  };
  let esperaRaio = 1.2, esperaJato = 2;

  // Feixes de luz que sobem das fendas e se apagam devagar.
  const tFeixe = (() => {
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 256;
    const x = cv.getContext("2d"), gv = x.createLinearGradient(0, 256, 0, 0);
    gv.addColorStop(0, "rgba(255,255,255,1)"); gv.addColorStop(0.35, "rgba(255,255,255,.35)"); gv.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gv; x.fillRect(0, 0, 64, 256);
    const gh = x.createLinearGradient(0, 0, 64, 0);
    gh.addColorStop(0, "rgba(0,0,0,1)"); gh.addColorStop(0.5, "rgba(0,0,0,0)"); gh.addColorStop(1, "rgba(0,0,0,1)");
    x.globalCompositeOperation = "destination-out"; x.fillStyle = gh; x.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const feixes = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tFeixe, color: 0xff7a2e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.geometry.translate(0, 0.5, 0); cena.add(m);
    feixes.push({ m, idade: 0, vida: 0, espera: R() * 3 });
  }
  const nascerFeixe = (f) => {
    const a = R() * Math.PI * 2, r = 90 + R() * 300, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
    f.m.position.set(x, altura(x, z), z);
    f.m.scale.set(8 + R() * 22, 160 + R() * 320, 1);
    f.idade = 0; f.vida = 2.5 + R() * 3.5; f.forca = 0.25 + R() * 0.35;
  };

  lugar.appendChild(renderer.domElement);
  const ajustar = () => {
    const { width, height } = lugar.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camara.aspect = width / height;
    // A nave enche o ecrã: cabe na altura e quase toda na largura (no telemóvel pode sair um pouco dos lados).
    const tg = Math.tan((15 * Math.PI) / 180);
    const dist = Math.max(178 / tg, (camara.aspect < 1 ? 185 : 300) / (tg * camara.aspect));
    camara.position.set(-dist * 0.1, alvo.y + dist * 0.1, dist);
    camara.lookAt(alvo);
    camara.updateProjectionMatrix();
  };
  new ResizeObserver(ajustar).observe(lugar);
  ajustar();

  // Queda: começa quando a faixa aparece no ecrã; depois fica cravada.
  const QUEDA = 0.85;
  // Sem queda: a nave já está cravada quando a cena aparece, e o fumo já vai alto.
  let inicio = -1e6, visivel = false, a = null, ultimo = null, impacto = true;
  const fora = new THREE.Vector3(-520, 1500, -300);
  const ease = (k) => k * k * k;
  const desenhar = (agora) => {
    const t = inicio === null ? 0 : (agora - inicio) / 1000;
    const desde = t - QUEDA; // tempo depois do impacto
    if (semMovimento || desde >= 0) {
      nave.position.copy(POUSO.pos); nave.rotation.copy(POUSO.rot);
    } else {
      const k = ease(Math.max(0, t) / QUEDA);
      nave.position.lerpVectors(fora, POUSO.pos, k);
      nave.rotation.set(POUSO.rot.x - (1 - k) * 0.9, POUSO.rot.y + (1 - k) * 1.6, POUSO.rot.z);
    }
    const d = semMovimento ? 99 : desde;
    const golpe = d >= 0 ? Math.exp(-d * 4.5) : 0;
    // tremor da câmara no impacto
    camara.position.y += golpe * Math.sin(agora * 0.09) * 9;
    camara.lookAt(alvo);
    // pedras saltam e assentam
    for (const p of pedras) {
      if (d < 0) { p.m.visible = false; continue; }
      p.m.visible = true;
      const k = Math.min(1, d / 0.9), salto = Math.sin(k * Math.PI) * (1 - k) * 140 * (260 / (p.r + 60));
      p.m.position.set(p.final.x * (0.4 + 0.6 * Math.min(1, d / 0.5)), p.final.y + salto, p.final.z * (0.4 + 0.6 * Math.min(1, d / 0.5)));
    }
    // fendas e núcleo a brilhar, com respiração lenta
    const resp = 0.78 + 0.22 * Math.sin(agora * 0.0021) + 0.06 * Math.sin(agora * 0.013);
    const aceso = d < 0 ? 0 : Math.min(1, d / 0.35);
    matChao.emissiveIntensity = aceso * (0.9 * resp + golpe * 2.5);
    matCentro.emissiveIntensity = 0.5 + 0.6 * resp + golpe * 2;
    brasa.intensity = aceso * (4000 * resp + golpe * 16000);
    const dt = ultimo === null ? 0 : Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
    const ativo = d >= 0;
    // no impacto: nuvem de poeira para os lados e um grande jato de faíscas
    if (ativo && !impacto) {
      impacto = true;
      for (const f of fumos) if (f.extra) nascerFumo(f, null, true);
      for (let i = 0; i < 70; i++) lancarFaisca(true, (R() - 0.5) * 80, (R() - 0.5) * 60);
    }
    // fumo: cada fonte solta baforadas a um ritmo que oscila, para nunca parecer em série
    if (ativo) for (const fo of FONTES) {
      fo.acum += dt * fo.ritmo * (0.7 + 0.6 * ruido(agora / 1400, fo.x));
      while (fo.acum >= 1) { fo.acum -= 1; soltarFumo(fo); }
    }
    for (const f of fumos) if (f.vivo) atualizarFumo(f, dt);
    // faíscas contínuas + jatos ao acaso
    if (ativo) {
      for (let i = 0, n = Math.random() < dt * 28 ? 1 : 0; i < n; i++) lancarFaisca(false);
      if (Math.random() < dt * 18) lancarFaisca(false);
      esperaJato -= dt;
      if (esperaJato <= 0) { jato(14 + ((R() * 16) | 0)); esperaJato = 2.2 + R() * 4.5; }
    }
    for (let i = 0; i < NF; i++) {
      const f = faiscas[i];
      let brilhoF = 0;
      if (f.vida > 0 && f.idade < f.vida) {
        f.idade += dt;
        f.v.y -= f.g * dt;
        f.v.x += Math.sin(f.idade * 3 + f.semente) * 30 * dt;
        f.p.addScaledVector(f.v, dt);
        const k = f.idade / f.vida;
        brilhoF = (1 - k) * (1 - k) * (0.7 + 0.3 * Math.sin(f.idade * 25 + f.semente));
        if (f.p.y < -20) brilhoF = 0;
      }
      fPos[i * 3] = f.p.x; fPos[i * 3 + 1] = brilhoF > 0 ? f.p.y : -999; fPos[i * 3 + 2] = f.p.z;
      fCor[i * 3] = brilhoF; fCor[i * 3 + 1] = brilhoF * 0.52; fCor[i * 3 + 2] = brilhoF * 0.2;
    }
    gF.attributes.position.needsUpdate = true; gF.attributes.color.needsUpdate = true;
    // raios
    let clarao = 0;
    if (ativo) {
      esperaRaio -= dt;
      if (esperaRaio <= 0) {
        const livres = raios.filter((r) => r.idade >= r.vida);
        const n = Math.min(livres.length, R() < 0.25 ? 2 : 1);
        for (let i = 0; i < n; i++) lancarRaio(livres[i]);
        esperaRaio = R() < 0.3 ? 0.12 + R() * 0.2 : 0.7 + R() * 2.4;
      }
    }
    for (const r of raios) {
      if (r.idade >= r.vida) { r.nucleo.visible = r.halo.visible = false; continue; }
      r.idade += dt; r.prox += dt;
      if (r.prox > 0.055) { r.prox = 0; desenharRaio(r); }
      const k = r.idade / r.vida, pisca = (0.55 + 0.45 * Math.random()) * (1 - k * k);
      r.nucleo.visible = r.halo.visible = true;
      r.nucleo.material.opacity = pisca; r.halo.material.opacity = pisca * 0.4;
      clarao = Math.max(clarao, pisca);
    }
    brasa.intensity += clarao * 9000;
    matChao.emissiveIntensity += clarao * 0.6;
    // feixes de luz
    for (const f of feixes) {
      if (!ativo) { f.m.material.opacity = 0; continue; }
      if (f.idade >= f.vida) { f.espera -= dt; f.m.material.opacity = 0; if (f.espera <= 0) { nascerFeixe(f); f.espera = 0.5 + R() * 3; } continue; }
      f.idade += dt;
      const k = f.idade / f.vida;
      f.m.material.opacity = f.forca * suaveK(0, 0.3, k) * (1 - suaveK(0.55, 1, k)) * (0.85 + 0.15 * Math.sin(agora * 0.008 + f.vida * 7));
      f.m.rotation.y = Math.atan2(camara.position.x - f.m.position.x, camara.position.z - f.m.position.z);
    }
    renderer.render(cena, camara);
    camara.position.y -= golpe * Math.sin(agora * 0.09) * 9;
    a = visivel && !semMovimento ? requestAnimationFrame(desenhar) : null;
  };

  new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting && !document.hidden;
    if (visivel && !a && !semMovimento) a = requestAnimationFrame(desenhar);
  }, { threshold: [0, 0.3, 0.6] }).observe(lugar);
  document.addEventListener("visibilitychange", () => {
    visivel = !document.hidden && lugar.getBoundingClientRect().top < innerHeight;
    if (visivel && !a && !semMovimento) a = requestAnimationFrame(desenhar);
  });

  // fumo já formado: simula uns segundos antes do primeiro desenho
  for (let i = 0; i < 300; i++) {
    for (const fo of FONTES) { fo.acum += (1 / 30) * fo.ritmo * (0.7 + 0.6 * ruido(i / 40, fo.x)); while (fo.acum >= 1) { fo.acum -= 1; soltarFumo(fo); } }
    for (const f of fumos) if (f.vivo) atualizarFumo(f, 1 / 30);
  }
  desenhar(performance.now());
  lugar.classList.add("lp-queda--pronta");
}
