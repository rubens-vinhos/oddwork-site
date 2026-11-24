// Vista do Saco da Fazenda (Itajaí) em tempo real: hora do dia pela posição real do sol,
// nuvens, chuva, trovoada e agitação do mar pelos dados atuais (Open-Meteo, sem chave).
// Para testar: ?tempo=limpo|nublado|chuva|tempestade|agitado e ?hora=18:40 (hora de Itajaí).
const LAT = -26.915, LON = -48.66;
const canvas = document.querySelector("[data-oceano]");
const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });

const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
const fs = `
precision highp float;
uniform vec2 res; uniform float t; uniform float pitch; uniform float foco;
uniform vec3 SOL; uniform float nuvem; uniform float chuva; uniform float mar; uniform float raio; uniform float vento; uniform float morro;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }

float DIA, OCASO, NOITE;

// gradiente base do céu (sem sol nem nuvens)
vec3 paleta(float y){
  vec3 dia = mix(vec3(.62,.72,.84), vec3(.12,.30,.64), smoothstep(0.,.5,y));
  vec3 oc = mix(vec3(1.25,.34,.07), vec3(.75,.15,.22), smoothstep(0.,.08,y));
  oc = mix(oc, vec3(.30,.10,.34), smoothstep(.05,.24,y));
  oc = mix(oc, vec3(.03,.035,.12), smoothstep(.2,.7,y));
  vec3 noi = mix(vec3(.05,.035,.06), vec3(.004,.007,.022), smoothstep(0.,.25,y));
  vec3 c = noi*NOITE + oc*OCASO + dia*DIA;
  float lum = dot(c, vec3(.3,.55,.15));
  vec3 tinto = lum*vec3(.82,.94,1.14) + c*.28;
  tinto *= mix(1., .4, chuva*chuva);
  float abre = mix(.4, 1., smoothstep(0., .16, y));
  c = mix(c, tinto, clamp(nuvem*nuvem*.7 + chuva*.35, 0., 1.)*abre);
  return c;
}

// Horizonte do Saco da Fazenda: serra ao longe, o morro onde o sol se põe e a cidade à beira d'água.
vec3 terra(vec3 rd, vec3 c, float d){
  float a = atan(rd.x, rd.z);
  float y = rd.y;
  vec3 neb = paleta(0.);
  float hf = .012 + .03*noise(vec2(a*5., 1.)) + .01*noise(vec2(a*17., 3.));
  vec3 serra = mix(vec3(.16,.05,.12), vec3(.30,.40,.46), DIA);
  if (y < hf) c = mix(c, serra, mix(.72, .35, chuva));
  float cm = morro;
  float hn = .004 + .05*exp(-pow((a-cm)/.11, 2.)) + .02*exp(-pow((a+.32)/.2, 2.)) + .006*noise(vec2(a*40., 5.));
  if (y < hn) {
    c = mix(vec3(.045,.018,.05), vec3(.07,.13,.09), DIA);
    c += vec3(1.,.45,.12)*pow(d, 30.)*.35*OCASO*smoothstep(hn-.004, hn, y)*(1.-nuvem*.8);
    c = mix(c, neb, chuva*.4 + DIA*.15);
  }
  float zona = smoothstep(-.52,-.46,a)*smoothstep(.0,-.08,a) + smoothstep(.3,.36,a)*smoothstep(.62,.5,a)*.7;
  float id = floor(a*170.);
  float hb = (.003 + .012*hash(vec2(id, 1.)) + step(.88, hash(vec2(id, 7.)))*.02) * zona;
  if (y < hb) {
    vec3 predio = mix(vec3(.03,.014,.04), vec3(.42,.44,.47)*(.6+.4*hash(vec2(id,3.))), DIA);
    float jan = step(mix(.93, .78, NOITE), hash(vec2(floor(a*700.), floor(y*1400.))));
    predio += vec3(1.,.68,.32)*jan*mix(.55, 1.4, NOITE)*(1.-DIA*(.9 - chuva*.65 - nuvem*.2));
    c = mix(predio, neb, chuva*.35 + DIA*.12);
  }
  return c;
}

vec3 ceu(vec3 rd){
  float y = max(rd.y, 0.);
  vec3 c = paleta(y);
  float d = max(dot(rd, SOL), 0.);
  float visSol = smoothstep(-.03, .01, SOL.y) * (1. - nuvem*.85) * (1. - chuva*.9);
  float brilho = smoothstep(-.03, .01, SOL.y) * (1. - nuvem*.5) * (1. - chuva*.55);
  vec3 tom = mix(vec3(1.,.55,.18), vec3(1.,.92,.75), DIA);
  c += vec3(1.,.38,.08)*pow(d, 10.)*.45*OCASO*brilho + tom*pow(d, 90.)*1.4*visSol + tom*pow(d, 8.)*.25*DIA*brilho;
  c += vec3(1.,.82,.55)*smoothstep(.99935,.9996,d)*7.*visSol;
  if (rd.y > 0.) {
    vec2 st = vec2(atan(rd.x, rd.z)*260., rd.y*420.);
    float hs = hash(floor(st));
    float est = step(.994, hs)*smoothstep(.45,.0,length(fract(st)-.5))*(.6+.4*sin(t*2.+hs*40.));
    c += vec3(.9,.92,1.)*est*NOITE*(1.-nuvem)*(1.-chuva)*smoothstep(.02,.12,rd.y)*1.5;
    vec2 cp = rd.xz/(rd.y+.05)*.85 + vec2(t*(.006 + vento*.02), 0.);
    float n = fbm(cp*vec2(1.,2.8));
    float cobre = mix(.46, .12, nuvem);
    float nv = smoothstep(cobre, cobre + mix(.34, .45, nuvem), n) * smoothstep(.005,.05,rd.y) * (1.-smoothstep(.3,.65,rd.y)*(1.-nuvem));
    float luzOc = pow(d,2.)*.9 + .25*(1.-smoothstep(0.,.25,rd.y));
    vec3 cOc = mix(vec3(.10,.05,.14), vec3(1.6,.55,.28), luzOc);
    cOc = mix(cOc, vec3(1.2,.35,.45), smoothstep(.08,.3,rd.y)*.35);
    vec3 cDia = mix(vec3(.40,.46,.56), vec3(.98,.97,.95), smoothstep(.3,.8,n) + pow(d,4.)*.3);
    vec3 cNoi = vec3(.035,.03,.045) + vec3(.06,.03,.02)*(1.-smoothstep(0.,.2,rd.y));
    vec3 cn = cNoi*NOITE + cOc*OCASO + cDia*DIA;
    float n2 = fbm(cp*2.2 + 3.7);
    cn *= mix(.72, 1.18, smoothstep(.3, .75, n2));
    cn += tom*pow(d, 5.)*.45*brilho*(DIA + OCASO);
    cn *= mix(1., .45, chuva*chuva);
    c = mix(c, cn, nv*mix(.85, .95, nuvem));
  }
  c += vec3(.75,.78,1.)*raio*(.5 + .5*step(0., rd.y));
  if (rd.y < .1) c = terra(rd, c, d);
  return c;
}

float altura(vec2 p){
  float h = 0., a = mix(.13, .95, mar*mar), f = .2;
  vec2 d = normalize(vec2(.9,.45));
  mat2 r = mat2(.8,-.6,.6,.8);
  float vel = mix(.55, 1.1, mar);
  for(int i=0;i<6;i++){
    float x = dot(d,p)*f + t*sqrt(f*9.8)*vel;
    float w = .5+.5*sin(x + noise(p*f*.7)*2.);
    h += a*w*w;
    d = r*d; f *= 1.82; a *= .5;
  }
  h += mix(.025, .08, mar)*fbm(p*1.2 + vec2(t*.2, t*.08));
  return h;
}

float aneis(vec2 g, float s){
  vec2 id = floor(g), f = fract(g);
  float rnd = hash(id + s);
  float ph = fract(t*1.4 + rnd);
  vec2 c = vec2(hash(id + 3.1 + s), hash(id + 7.3 + s))*.6 + .2;
  float r = length(f - c);
  return smoothstep(.035, 0., abs(r - ph*.32)) * (1. - ph) * step(.35, hash(id + 11. + s + floor(t*1.4 + rnd)));
}

float chuvaTela(vec2 fc){
  float s = 0.;
  vec2 uv0 = fc/res.y;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float colunas = 90. + fi*55.;
    float linhas = 7. + fi*3.;
    vec2 q = uv0*vec2(colunas, linhas);
    q.x += uv0.y*colunas*(.08 + vento*.22);
    q.y += t*(13. + fi*4.);
    vec2 id = floor(q); vec2 f = fract(q);
    float h = hash(id + fi*13.);
    float ox = (hash(id + fi*5.1) - .5)*.6;
    float traco = smoothstep(.07, 0., abs(f.x - .5 - ox))
      * smoothstep(0., .08, f.y) * smoothstep(.55, .1, f.y);
    s += step(1. - chuva*.42, h) * traco * (.8 - fi*.16) * (.5 + .5*hash(id + 2.7));
  }
  return s;
}

vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*res)/res.y;
  float e = SOL.y;
  DIA = smoothstep(.04, .26, e);
  NOITE = 1. - smoothstep(-.17, -.03, e);
  OCASO = max(1. - DIA - NOITE, 0.);
  vec3 ro = vec3(0., 1.6, t*.6);
  vec3 rd = normalize(vec3(uv.x, uv.y + pitch, foco));
  vec3 col;
  float luzGeral = DIA + OCASO*.5 + NOITE*.08;
  if (rd.y >= 0.) {
    col = ceu(rd);
  } else {
    float dist = -ro.y/rd.y;
    vec3 p = ro + rd*dist;
    float e2 = .03 + dist*.004;
    float k = exp(-dist*.012);
    float hx = altura(p.xz+vec2(e2,0.)) - altura(p.xz-vec2(e2,0.));
    float hz = altura(p.xz+vec2(0.,e2)) - altura(p.xz-vec2(0.,e2));
    float forca = mix(1.2, 2.2, mar);
    vec3 n = normalize(vec3(-hx/(2.*e2)*k*forca, 1., -hz/(2.*e2)*k*forca));
    vec3 rf = reflect(rd, n); rf.y = abs(rf.y);
    float fres = .02 + .98*pow(1.-max(dot(n,-rd),0.), 5.);
    vec3 fundo = mix(vec3(.015,.015,.045), vec3(.05,.12,.13), DIA) + vec3(.12,.04,.05)*max(dot(n, SOL),0.)*OCASO;
    float hgt = altura(p.xz);
    float crista = smoothstep(.55,.9, hgt) * k;
    fundo += vec3(.10,.08,.12)*crista*(1.-mar);
    col = mix(fundo, ceu(rf)*.8, fres);
    float A = mix(.13, .95, mar*mar);
    float espuma = smoothstep(A*.95, A*1.35, hgt + .25*A*fbm(p.xz*.8 + t*.4)) * smoothstep(.25, .7, mar) * mix(.4, 1., k);
    col = mix(col, vec3(.9,.93,.95)*(.2 + luzGeral*.8), espuma*.85);
    float visSol = smoothstep(-.03, .01, SOL.y) * (1. - nuvem*.85) * (1. - chuva*.9);
    float rug = mix(60., 900., 1.-k);
    float sp = pow(max(dot(rf, SOL),0.), rug);
    col += mix(vec3(1.,.62,.28), vec3(1.,.95,.85), DIA)*sp*mix(4.,18.,1.-k)*visSol;
    float an = (aneis(p.xz*1.6, 0.) + aneis(p.xz*2.3 + 5.7, 9.)) * k;
    col += vec3(.8,.85,.9)*an*chuva*(.12 + luzGeral*.5);
    float neb = 1.-exp(-dist*(.008 + chuva*.05 + nuvem*.006));
    col = mix(col, paleta(.01), neb*mix(.45, .75, chuva));
  }
  col = mix(col, paleta(.05), chuva*.18*(1.-smoothstep(0., .25, abs(rd.y))));
  col = mix(col, paleta(.1)*.9, chuva*.12);
  col += vec3(.78,.82,.9)*chuvaTela(gl_FragCoord.xy)*chuva*(.22 + luzGeral*.5);
  col += raio*.12;
  col = aces(col*mix(.62, .7, DIA));
  col = pow(col, vec3(1.08));
  col = mix(vec3(dot(col, vec3(.299,.587,.114))), col, .9);
  col = pow(col, vec3(1./2.2));
  col = mix(col, col*col*(3.-2.*col), .3 + .25*max(nuvem, chuva));
  col += (hash(gl_FragCoord.xy + fract(t)*91.) - .5)*.022;
  float v = smoothstep(1.25,.35,length((gl_FragCoord.xy/res - .5)*vec2(1.1,1.)));
  col *= mix(.78, 1., v);
  gl_FragColor = vec4(col,1.);
}`;

function compila(tipo, src){ const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, compila(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, compila(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog); gl.useProgram(prog);
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = (n) => gl.getUniformLocation(prog, n);
const u = Object.fromEntries(["res","t","pitch","foco","SOL","nuvem","chuva","mar","raio","vento","morro"].map((n) => [n, U(n)]));

let sunX = .22;
function ajusta(){
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
  const asp = w/h;
  gl.uniform2f(u.res, canvas.width, canvas.height);
  gl.uniform1f(u.pitch, asp < 1 ? .05 : .1);
  gl.uniform1f(u.foco, asp < 1 ? .62 : 1.5);
  sunX = asp < 1 ? .1 : .22;
  gl.uniform1f(u.morro, sunX + .1);
}
new ResizeObserver(ajusta).observe(canvas); ajusta();

// ---------- posição real do sol em Itajaí ----------
const R = Math.PI/180;
function sol(ms){
  const d = ms/86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + .98560028*d)*R, q = 280.459 + .98564736*d;
  const L = (q + 1.915*Math.sin(g) + .020*Math.sin(2*g))*R;
  const ob = (23.439 - .00000036*d)*R;
  const ra = Math.atan2(Math.cos(ob)*Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(ob)*Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908*d) % 24 + 24) % 24;
  const H = (gmst*15 + LON)*R - ra;
  const la = LAT*R;
  const elev = Math.asin(Math.sin(la)*Math.sin(dec) + Math.cos(la)*Math.cos(dec)*Math.cos(H));
  const az = Math.atan2(-Math.sin(H)*Math.cos(dec), Math.sin(dec)*Math.cos(la) - Math.cos(dec)*Math.sin(la)*Math.cos(H));
  const poente = 2*Math.PI - Math.acos(Math.max(-1, Math.min(1, Math.sin(dec)/Math.cos(la))));
  return { elev, az, poente };
}

const params = new URLSearchParams(location.search);
let horaTeste = params.get("hora") ? params.get("hora").split(":").reduce((h, m) => +h + m/60) : null;
let modo = params.get("tempo");
function agoraMs(){
  if (horaTeste == null) return Date.now();
  const hoje = new Date(Date.now() - 3*3600e3);
  return Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 3) + horaTeste*3600e3;
}

// ---------- tempo real ----------
const alvo = { nuvem: .2, chuva: 0, mar: .2, vento: .1, tempestade: false };
const atual = { ...alvo };
const NOMES = { 0:"Céu limpo", 1:"Quase limpo", 2:"Parcialmente nublado", 3:"Nublado", 45:"Neblina", 48:"Neblina",
  51:"Garoa", 53:"Garoa", 55:"Garoa forte", 56:"Garoa", 57:"Garoa", 61:"Chuva fraca", 63:"Chuva", 65:"Chuva forte",
  66:"Chuva", 67:"Chuva forte", 80:"Pancadas de chuva", 81:"Pancadas de chuva", 82:"Chuva forte", 95:"Trovoada", 96:"Trovoada", 99:"Trovoada" };
const selo = document.querySelector("[data-agora]");

function aplica(w){
  const c = w.weather_code;
  const chove = (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
  alvo.nuvem = Math.min(1, (w.cloud_cover ?? 30)/100);
  alvo.chuva = !chove ? 0 : c <= 57 ? .3 : Math.min(1, .45 + (w.precipitation || 0)/6);
  alvo.vento = Math.min(1, (w.wind_speed_10m || 0)/45);
  alvo.tempestade = c >= 95;
  if (alvo.tempestade) alvo.chuva = Math.max(alvo.chuva, .85);
}
function rotulo(w){
  if (!selo) return;
  let txt = `Itajaí agora · ${Math.round(w.temperature_2m)}° · ${NOMES[w.weather_code] || "—"}`;
  if (alvo.mar > .5) txt += " · mar agitado";
  selo.textContent = txt;
  selo.hidden = false;
}
async function buscaTempo(){
  try {
    const [r1, r2] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m&timezone=America%2FSao_Paulo`).then((r) => r.json()),
      fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=-26.92&longitude=-48.60&current=wave_height`).then((r) => r.json()).catch(() => null),
    ]);
    const w = r1.current;
    ultimo = { ...w };
    if (manual) return;
    aplica(w);
    const onda = r2?.current?.wave_height;
    alvo.mar = Math.max(onda != null ? Math.min(1, Math.max(0, (onda - .4)/1.6)) : 0, alvo.vento*.8);
    simulacao();
    ultimo = { ...w };
    rotulo(modo ? { ...w, weather_code: { limpo: 0, nublado: 3, chuva: 63, tempestade: 95, agitado: 2 }[modo] ?? w.weather_code } : w);
  } catch (e) { simulacao(); }
}
// modos de teste pela URL
let ultimo = null, manual = false;
function simulacao(){
  const m = modo;
  if (!m) return;
  Object.assign(alvo, { limpo: { nuvem: .15, chuva: 0, mar: .15, vento: .1, tempestade: false },
    nublado: { nuvem: .95, chuva: 0, mar: .25, vento: .3, tempestade: false },
    chuva: { nuvem: 1, chuva: .75, mar: .4, vento: .4, tempestade: false },
    tempestade: { nuvem: 1, chuva: 1, mar: .85, vento: .8, tempestade: true },
    agitado: { nuvem: .5, chuva: 0, mar: 1, vento: .9, tempestade: false } }[m] || {});
}
simulacao(); Object.assign(atual, alvo);
buscaTempo();
setInterval(buscaTempo, 10*60*1000);

// ---------- relâmpagos ----------
let raio = 0, proxRaio = 0;
function relampago(ms){
  if (!atual.tempestade) { raio *= .9; return; }
  if (ms > proxRaio) { raio = .9 + Math.random()*.6; proxRaio = ms + 3500 + Math.random()*9000; setTimeout(() => { raio = 1.1; }, 140); }
  raio *= .86;
}

const t0 = performance.now();
let visivel = true;
new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(canvas);
(function frame(){
  if (visivel){
    const ms = performance.now();
    for (const k of ["nuvem","chuva","mar","vento"]) atual[k] += (alvo[k] - atual[k])*.02;
    atual.tempestade = alvo.tempestade;
    relampago(ms);
    const s = sol(agoraMs());
    let rel = s.az - (s.poente - sunX);
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    gl.uniform3f(u.SOL, Math.sin(rel)*Math.cos(s.elev), Math.sin(s.elev), Math.cos(rel)*Math.cos(s.elev));
    gl.uniform1f(u.nuvem, atual.nuvem); gl.uniform1f(u.chuva, atual.chuva);
    gl.uniform1f(u.mar, atual.mar); gl.uniform1f(u.vento, atual.vento); gl.uniform1f(u.raio, raio);
    gl.uniform1f(u.t, (ms - t0)/1000 + 20.);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
})();

// API para o painel de teste (só na maquete)
window.ceuTeste = {
  hora(h){ horaTeste = h; },
  tempo(m){ modo = m; simulacao(); if (ultimo) rotulo({ ...ultimo, weather_code: { limpo: 0, nublado: 3, chuva: 63, tempestade: 95, agitado: 2 }[m] }); },
  real(){ horaTeste = null; modo = null; manual = false; buscaTempo(); },
  // controlo fino: nuvem, chuva, mar (0–1) e tempestade (true/false)
  definir(k, v){
    modo = null; manual = true;
    alvo[k] = v;
    if (k === "chuva" && v > .05) alvo.nuvem = Math.max(alvo.nuvem, .75 + v*.25);
    if (k === "tempestade" && v) alvo.chuva = Math.max(alvo.chuva, .85);
    if (selo && ultimo) {
      const nome = alvo.tempestade ? "Trovoada" : alvo.chuva > .65 ? "Chuva forte" : alvo.chuva > .3 ? "Chuva" : alvo.chuva > .05 ? "Chuva fraca"
        : alvo.nuvem > .8 ? "Nublado" : alvo.nuvem > .4 ? "Parcialmente nublado" : "Céu limpo";
      selo.textContent = `Itajaí agora · ${Math.round(ultimo.temperature_2m)}° · ${nome}${alvo.mar > .5 ? " · mar agitado" : ""}`;
    }
    return { ...alvo };
  },
  valores(){ return { ...alvo }; },
  horaItajai(){ const s = new Date(agoraMs() - 3*3600e3); return s.getUTCHours() + s.getUTCMinutes()/60; },
};
