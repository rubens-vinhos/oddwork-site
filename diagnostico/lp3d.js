// Logo da Oddwork em 3D no topo da landing page.
// Computador e telemóvel, desde que haja WebGL; carrega a biblioteca depois da página estar pronta.
// Sem WebGL fica o símbolo plano que já está no HTML.
// O lugar do logo serve de referência para centrar; o 3D só aparece se tiver data-logo3d.
const lugar = document.querySelector(".lp-logo3d");
const telemovel = matchMedia("(max-width: 900px)").matches;
const semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;

function temWebGL() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; }
}

// Alinha o logo pelo centro real do texto (título + frase), não da coluna:
// as linhas do título são mais curtas do que a coluna.
function centrarNoTexto() {
  if (!lugar || !matchMedia("(min-width: 901px)").matches) { if (lugar) lugar.style.removeProperty("--desvio"); document.querySelector(".lp-hero__exemplos")?.style.removeProperty("--desvio"); return; }
  const r = document.createRange();
  let esq = Infinity, dir = -Infinity;
  for (const el of document.querySelectorAll(".lp-hero h1 [data-var], .lp-hero .hero__lead")) {
    if (!el.offsetParent) continue;
    r.selectNodeContents(el);
    for (const q of r.getClientRects()) { esq = Math.min(esq, q.left); dir = Math.max(dir, q.right); }
  }
  if (!isFinite(esq)) return;
  const caixa = lugar.getBoundingClientRect();
  lugar.style.setProperty("--desvio", `${Math.round((esq + dir) / 2 - (caixa.left + caixa.right) / 2)}px`);
  // o botão "Ver exemplos" fica centrado no mesmo eixo do texto e do logo
  const ex = document.querySelector(".lp-hero__exemplos");
  if (ex) ex.style.setProperty("--desvio", lugar.style.getPropertyValue("--desvio"));
}
// A nave caída do topo (no computador) começa sempre abaixo do botão "Ver exemplos".
function posicionarNave() {
  const cena = document.querySelector(".lp-queda--hero"), ex = document.querySelector(".lp-hero__exemplos");
  if (!cena || !ex) return;
  if (!matchMedia("(min-width: 901px)").matches) { cena.style.removeProperty("top"); cena.style.removeProperty("height"); cena.style.removeProperty("--corte"); return; }
  // A cena ocupa o espaço entre o botão e o fundo do topo: a nave encolhe para caber inteira.
  const caixa = cena.parentElement.getBoundingClientRect();
  const fundo = Math.min(caixa.height, innerHeight - caixa.top) + 40;
  const exFundo = ex.getBoundingClientRect().bottom - caixa.top;
  const altura = Math.max(360, (fundo - exFundo - 6) / 0.88);
  cena.style.top = Math.round(fundo - altura) + "px";
  cena.style.height = Math.round(altura) + "px";
  // Só desvanece o chão quando a cena chega ao fim do topo (em ecrãs baixos fica toda à vista).
  cena.style.setProperty("--corte", Math.round(fundo - caixa.height) + "px");
}
document.fonts.ready.then(posicionarNave);
addEventListener("resize", posicionarNave, { passive: true });

if (lugar) {
  lugar.style.removeProperty("--desvio");
  document.fonts.ready.then(centrarNoTexto);
  addEventListener("resize", () => { lugar.style.removeProperty("--desvio"); centrarNoTexto(); }, { passive: true });
}

if (lugar && lugar.hasAttribute("data-logo3d") && temWebGL()) {
  const iniciar = () => import("/assets/vendor/three.module.min.js").then(arrancar).catch(() => {});
  if ("requestIdleCallback" in window) requestIdleCallback(iniciar, { timeout: 1500 });
  else setTimeout(iniciar, 400);
}

// Mesma forma do símbolo em SVG (viewBox -420..420): uma pá com 4 peças, repetida 3 vezes.
const PA = [
  [[-8, -78], [-34, -82], [-60, -198], [-42, -332], [-8, -376]],
  [[8, -78], [34, -82], [60, -198], [42, -332], [8, -376]],
  [[-50, -92], [-76, -212], [-118, -136], [-100, -102]],
  [[50, -92], [76, -212], [118, -136], [100, -102]],
];

function arrancar(THREE) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, telemovel ? 1.75 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const cena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(28, 1, 10, 6000);
  camara.position.set(0, 0, 1650);

  // Luzes: chave branca, luz de recorte laranja (cor da marca) e um enchimento azul-noite.
  cena.add(new THREE.HemisphereLight(0xffffff, 0x1c2540, 1.1));
  const chave = new THREE.DirectionalLight(0xffffff, 2.6);
  chave.position.set(600, 900, 1200);
  cena.add(chave);
  const recorte = new THREE.DirectionalLight(0xf26a21, 3.2);
  recorte.position.set(-900, -500, -300);
  cena.add(recorte);
  const enchimento = new THREE.PointLight(0xf26a21, 1.6, 0, 0);
  enchimento.position.set(0, 0, 700);
  cena.add(enchimento);

  const matPa = new THREE.MeshPhysicalMaterial({ color: 0xf4f5f9, metalness: 0.15, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25 });
  const matCentro = new THREE.MeshPhysicalMaterial({ color: 0xf26a21, emissive: 0xf26a21, emissiveIntensity: 0.35, metalness: 0.1, roughness: 0.3, clearcoat: 1 });

  const extrusao = { depth: 56, bevelEnabled: true, bevelThickness: 10, bevelSize: 7, bevelOffset: 0, bevelSegments: 4, curveSegments: 1 };
  const simbolo = new THREE.Group();
  for (let r = 0; r < 3; r++) {
    const a = (r * 2 * Math.PI) / 3;
    const c = Math.cos(a), s = Math.sin(a);
    for (const peca of PA) {
      // SVG tem o y para baixo; rodamos como o <use transform="rotate()"> e invertemos o y.
      const pts = peca.map(([x, y]) => new THREE.Vector2(x * c - y * s, -(x * s + y * c)));
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), extrusao);
      geo.translate(0, 0, -28);
      simbolo.add(new THREE.Mesh(geo, matPa));
    }
  }
  const centro = new THREE.Mesh(new THREE.CylinderGeometry(52, 52, 96, 64), matCentro);
  centro.rotation.x = Math.PI / 2;
  simbolo.add(centro);

  const inclinacao = new THREE.Group();
  inclinacao.add(simbolo);
  cena.add(inclinacao);

  lugar.appendChild(renderer.domElement);

  const ajustar = () => {
    const { width, height } = lugar.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camara.aspect = width / height;
    camara.updateProjectionMatrix();
  };
  new ResizeObserver(ajustar).observe(lugar);
  ajustar();

  // Gira sozinho, com uma inclinação fixa e pequena; não reage ao rato.
  let visivel = true, a = null;
  const relogio = new THREE.Clock();
  const desenhar = () => {
    const t = relogio.getElapsedTime();
    simbolo.rotation.z = -t * 0.35;
    inclinacao.rotation.set(-0.3, Math.sin(t * 0.6) * 0.14, 0);
    inclinacao.position.y = Math.sin(t * 1.1) * 14;
    renderer.render(cena, camara);
    a = visivel && !semMovimento ? requestAnimationFrame(desenhar) : null;
  };

  // Pára quando sai do ecrã ou o separador fica escondido.
  new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting && !document.hidden;
    if (visivel && !a && !semMovimento) a = requestAnimationFrame(desenhar);
  }).observe(lugar);
  document.addEventListener("visibilitychange", () => {
    visivel = !document.hidden;
    if (visivel && !a && !semMovimento) a = requestAnimationFrame(desenhar);
  });

  desenhar();
  lugar.classList.add("lp-logo3d--pronto");
}
