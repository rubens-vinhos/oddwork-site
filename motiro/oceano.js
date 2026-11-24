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
uniform vec3 SOL; uniform float nuvem; uniform float chuva; uniform float mar; uniform float raio; uniform float vento; uniform float morro; uniform vec3 LUA; uniform float fase; uniform vec2 raioX; uniform vec4 canoa;

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
  // céu encoberto: em vez de lavar tudo de cinzento, camadas azuladas com neblina na base
  float cinza = clamp(nuvem*.7 + chuva*.6, 0., 1.);
  vec3 frio = mix(vec3(.10,.13,.17), vec3(.36,.43,.50), DIA*(1. - chuva*.45));
  // serra ao longe
  float hf = .012 + .03*noise(vec2(a*5., 1.)) + .01*noise(vec2(a*17., 3.));
  if (y < hf) {
    vec3 serra = mix(vec3(.16,.05,.12), vec3(.30,.40,.46), DIA);
    serra = mix(serra, frio*1.05, cinza);
    float nevoa = smoothstep(hf, hf*.15, y);   // mais clara junto à água
    serra = mix(serra, neb, nevoa*(.25 + cinza*.35));
    c = mix(c, serra, mix(.8, .62, chuva));
  }
  // o morro onde o sol se põe
  float cm = morro;
  float hn = .004 + .05*exp(-pow((a-cm)/.11, 2.)) + .02*exp(-pow((a+.32)/.2, 2.)) + .006*noise(vec2(a*40., 5.));
  if (y < hn) {
    vec3 m = mix(vec3(.045,.018,.05), vec3(.07,.13,.09), DIA);
    vec3 mCinza = mix(vec3(.035,.045,.06), vec3(.10,.15,.15), DIA*(1. - chuva*.4));
    m = mix(m, mCinza, cinza);
    float mata = noise(vec2(a*260., y*900.))*.5 + noise(vec2(a*70., y*240.))*.5;
    m *= .8 + .4*mata*(.4 + DIA*.6);
    m += vec3(1.,.45,.12)*pow(d, 30.)*.35*OCASO*smoothstep(hn-.004, hn, y)*(1.-nuvem*.8);
    // borda de luz fria no topo e neblina a subir da água
    m += frio*.25*smoothstep(hn - .006, hn, y)*cinza;
    float nevoa = smoothstep(hn*.55, 0., y);
    m = mix(m, neb, nevoa*(.15 + chuva*.4) + DIA*.08);
    c = m;
  }
  // a cidade
  float zona = smoothstep(-.52,-.46,a)*smoothstep(.0,-.08,a) + smoothstep(.3,.36,a)*smoothstep(.62,.5,a)*.7;
  float id = floor(a*170.);
  float hb = (.003 + .012*hash(vec2(id, 1.)) + step(.88, hash(vec2(id, 7.)))*.02) * zona;
  if (y < hb) {
    vec3 predio = mix(vec3(.03,.014,.04), vec3(.42,.44,.47)*(.6+.4*hash(vec2(id,3.))), DIA);
    predio = mix(predio, mix(vec3(.04,.05,.065), vec3(.2,.24,.28), DIA*(1. - chuva*.5))*(.7 + .5*hash(vec2(id,3.))), cinza);
    predio += frio*.3*smoothstep(hb - .0015, hb, y)*cinza;   // topo apanha a luz do céu
    float acesa = max(NOITE, cinza*.85);
    float jan = step(mix(.93, .74, acesa), hash(vec2(floor(a*700.), floor(y*1400.))));
    predio += vec3(1.,.68,.32)*jan*mix(.55, 1.4, acesa)*(1. - DIA*(.92 - cinza*.82));
    c = mix(predio, neb, chuva*.22 + DIA*.08);
  }
  return c;
}

// relâmpago: um traço que desce da nuvem até ao horizonte, com um ramo
float bx(float y, float sd){
  return .05*(noise(vec2(y*12. + sd*7., sd)) - .5)*2. + .018*(noise(vec2(y*55. + sd*3., 1.)) - .5)*2. + .006*(noise(vec2(y*190., sd + 2.)) - .5)*2.;
}
float desenhoRaio(vec3 rd){
  float a = atan(rd.x, rd.z) - raioX.x;
  float y = rd.y, sd = raioX.y;
  float topo = .4;
  if (y > topo || y < -.002) return 0.;
  float lado = sd > .5 ? 1. : -1.;
  float x = bx(y, sd) + (topo - y)*.06*lado;
  float d = abs(a - x);
  float v = exp(-d*1500.)*1.8 + exp(-d*240.)*.35 + exp(-d*45.)*.07;
  float yb = topo - .1;
  if (y < yb && y > yb - .16) {
    float xb = bx(yb, sd) + (topo - yb)*.06*lado - (yb - y)*.5*lado + bx(y*1.6, sd + 5.)*.5;
    float db = abs(a - xb);
    v += (exp(-db*1700.)*1.1 + exp(-db*260.)*.18) * smoothstep(yb - .16, yb - .03, y);
  }
  return v * smoothstep(topo, topo - .06, y);
}

vec3 ceu(vec3 rd){
  float y = max(rd.y, 0.);
  vec3 c = paleta(y);
  float d = max(dot(rd, SOL), 0.);
  float visSol = smoothstep(-.03, .01, SOL.y) * (1. - nuvem*.85) * (1. - chuva*.6);
  float brilho = smoothstep(-.03, .01, SOL.y) * (1. - nuvem*.5) * (1. - chuva*.55);
  vec3 tom = mix(vec3(1.,.55,.18), vec3(1.,.92,.75), DIA);
  c += vec3(1.,.38,.08)*pow(d, 10.)*.45*OCASO*brilho + tom*pow(d, 90.)*.75*visSol + tom*pow(d, 8.)*.25*DIA*brilho;
  c += mix(vec3(1.,.6,.3), vec3(1.,.85,.6), DIA)*smoothstep(.99935,.9996,d)*mix(1.7, 5., DIA)*visSol;   // disco do sol sem estourar
  // lua (fase real; no hemisfério sul a crescente acende do lado esquerdo)
  float visLua = (NOITE + OCASO*.35*smoothstep(.04, .12, fase)*smoothstep(.42, .28, fase)) * (1. - chuva*.95) * (1. - nuvem*.92);
  if (visLua > .001) {
    float dm = dot(rd, LUA);
    float raioLua = .021;
    vec3 dir = normalize(cross(vec3(0.,1.,0.), LUA)); vec3 cim = cross(LUA, dir);
    vec2 q = vec2(dot(rd, dir), dot(rd, cim))/raioLua;
    float ilum = (1. - cos(fase*6.2832))*.5;
    c += vec3(.75,.8,.95)*(pow(max(dm,0.), 900.)*.25 + pow(max(dm,0.), 90.)*.06)*ilum*visLua*(1.-nuvem*.6);
    float r2 = dot(q, q);
    if (r2 < 1. && dm > 0.) {
      vec3 n = vec3(q, sqrt(1. - r2));
      float ang = fase*6.2832;
      vec3 Ls = normalize(vec3(-sin(ang), 0., -cos(ang)));
      float luz = smoothstep(-.04, .12, dot(n, Ls));
      float mares = fbm(q*2.6 + 4.) ;
      vec3 sup = vec3(1.,.97,.9)*mix(.62, 1., smoothstep(.35, .7, mares));
      vec3 cl = sup*luz*1.35 + vec3(.05,.06,.09);
      float borda = smoothstep(1., .9, r2);
      c = mix(c, cl, borda*visLua);
    }
  }
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
  float aR = atan(rd.x, rd.z) - raioX.x;
  float claro = mix(1., .35, DIA);
  c += vec3(.62,.64,.9)*raio*claro*(.12 + .18*step(0., rd.y)) + vec3(.7,.72,1.)*raio*claro*exp(-abs(aR)*4.)*smoothstep(0., .25, rd.y)*(.6 + 1.2*exp(-abs(rd.y - .42)*9.));
  c += vec3(.85,.88,1.)*desenhoRaio(rd)*min(raio, 1.)*3.;
  if (rd.y < .1) c = terra(rd, c, d);
  // cortinas de chuva ao longe, a andar com o vento
  if (chuva > .01 && rd.y < .22) {
    float an = atan(rd.x, rd.z);
    float faixa = fbm(vec2(an*6. - t*(.03 + vento*.05), 1.3));
    float fios = noise(vec2(an*380. + rd.y*40.*vento, rd.y*9. + t*2.5));
    float cort = smoothstep(.42, .72, faixa) * (1. - smoothstep(.02, .22, rd.y)) * chuva;
    c = mix(c, c*.72 + paleta(.1)*.18, cort*.65);
    c += vec3(.7,.75,.85)*cort*fios*.06*(.3 + DIA);
  }
  return c;
}

float detalhe = 1.;
float altura(vec2 p){
  float h = 0., a = mix(.13, .95, mar*mar), f = .2;
  vec2 d = normalize(vec2(.9,.45));
  mat2 r = mat2(.8,-.6,.6,.8);
  float vel = mix(.55, 1.1, mar);
  for(int i=0;i<6;i++){
    float x = dot(d,p)*f + t*sqrt(f*9.8)*vel;
    float w = .5+.5*sin(x + noise(p*f*.7)*2.);
    // ondas reais: cristas afiadas e vales largos, mais afiadas quanto mais agitado
    h += a*pow(w, i < 2 ? mix(2., 3.6, mar) : 2.)*(i < 2 ? 1. : detalhe);
    d = r*d; f *= 1.82; a *= .5;
  }
  h += detalhe*mix(.025, .08, mar)*fbm(p*1.2 + vec2(t*.2, t*.08));
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
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float perto = 1. - fi/4.;
    float colunas = mix(260., 38., perto);
    float linhas = mix(16., 2.6, perto);
    vec2 q = uv0*vec2(colunas, linhas);
    q.x += uv0.y*colunas*(.06 + vento*.2);
    q.y += t*mix(22., 3.2, perto);
    vec2 id = floor(q); vec2 f = fract(q);
    float h = hash(id + fi*13.);
    float ox = (hash(id + fi*5.1) - .5)*.6;
    float larg = mix(.04, .11, perto);
    float traco = smoothstep(larg, 0., abs(f.x - .5 - ox))
      * smoothstep(0., .1, f.y) * smoothstep(mix(.6, .9, perto), .15, f.y);
    float dens = mix(.55, .07, perto);
    s += step(1. - chuva*dens, h) * traco * mix(.5, .26, perto) * (.5 + .5*hash(id + 2.7));
  }
  return s;
}

// gotas no vidro: pequenas lentes que deformam a vista
vec3 vidro(vec2 uv){
  vec2 desvio = vec2(0.); float m = 0.;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 g = uv*mix(7., 15., fi) + fi*3.7;
    vec2 id = floor(g); vec2 f = fract(g) - .5;
    float h = hash(id + 9.1 + fi);
    if (h < chuva*.55) {
      vec2 c0 = (vec2(hash(id + 1.3), hash(id + 2.9)) - .5)*.5;
      float desl = fract(t*.04*hash(id + 4.4) + h*7.);
      c0.y += (smoothstep(.6, 1., desl) - .5)*.0;
      float r = mix(.1, .3, hash(id + 3.7));
      vec2 v = (f - c0)/r;
      float l = length(v*vec2(1., .9));
      float mi = smoothstep(1., .82, l);
      desvio += v*r*mi;
      m = max(m, mi);
    }
  }
  return vec3(desvio, m);
}

vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }

// ---------- canoa havaiana (OC6) em 3D, desenhada por distâncias ----------
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
float sdElip(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.)/k1; }
vec3 cC, cH, cZ; float cBob, cIncl, cRol, cPx;
float rAlc, rSobe, rTh, rLean;
void preparaCanoa(vec3 ro){
  float dc = canoa.w, ca = canoa.x;
  cC = vec3(sin(ca)*dc, 0., ro.z + cos(ca)*dc);
  float giro = -canoa.y*.42;                     // de três-quartos, a vir ligeiramente na nossa direção
  cH = canoa.y*vec3(cos(ca + giro), 0., -sin(ca + giro));
  cZ = vec3(cH.z, 0., -cH.x);
  cBob = .04*sin(t*1.3) + mar*.14*sin(t*.85 + 1.);
  cIncl = (.004 + mar*.02)*sin(t*.85);
  cRol = (.01 + mar*.05)*sin(t*1.1 + .5);
  cPx = dc/(res.y*foco);
  float ph = fract(t*1.05);
  rAlc = ph < .55 ? 1. - ph/.55 : smoothstep(.55, 1., ph);
  rSobe = ph < .55 ? 0. : sin(3.1416*(ph - .55)/.45)*.3;
  rTh = mix(-.35, .6, rAlc);
  rLean = .1 + .3*rAlc;
}
vec3 paraCanoa(vec3 P){
  vec3 d = P - cC;
  vec3 q = vec3(dot(d, cH), d.y - cBob, dot(d, cZ));
  q.y -= q.x*cIncl + q.z*cRol;
  return q;
}
// devolve distância e material: 1 casco, 2 ama, 3 iako, 4 camisola, 5 pele, 6 remo
vec2 mapaCanoa(vec3 p){
  float fino = cPx*.45;
  float ax = abs(p.x);
  vec3 ph = p; ph.y -= .3*pow(clamp(ax/6.9, 0., 1.), 3.);
  float casco = max(sdElip(ph - vec3(0., .04, 0.), vec3(6.9, .5, .27)), ph.y - .3);
  vec2 r = vec2(casco, 1.);
  float ama = sdElip(p - vec3(-.3, .02, 1.9), vec3(3., .13, .13));
  if (ama < r.x) r = vec2(ama, 2.);
  float iako = min(min(sdCap(p, vec3(1.7, .3, 0.), vec3(1.7, .46, 1.), max(.045, fino)), sdCap(p, vec3(1.7, .46, 1.), vec3(1.6, .1, 1.9), max(.04, fino))),
                   min(sdCap(p, vec3(-2.2, .3, 0.), vec3(-2.2, .46, 1.), max(.045, fino)), sdCap(p, vec3(-2.2, .46, 1.), vec3(-2.3, .1, 1.9), max(.04, fino))));
  if (iako < r.x) r = vec2(iako, 3.);
  if (p.y > -.2 && p.y < 2. && abs(p.z) < 1.7 && ax < 5.6) {
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float x0 = 4.3 - fi*1.72;
      float lado = mod(fi, 2.) < .5 ? 1. : -1.;
      // cada remador com um atraso mínimo, como gente a sério
      float ph = fract(t*1.05 - fi*.012);
      float alc = ph < .55 ? 1. - ph/.55 : smoothstep(.55, 1., ph);
      float sobe = ph < .55 ? 0. : sin(3.1416*(ph - .55)/.45)*.3;
      float th = mix(-.35, .6, alc);
      float lean = .1 + .3*alc;
      vec3 L = vec3(sin(lean), cos(lean), 0.);
      float rot = lado*(.25*alc - .1);                       // o tronco roda para o lado do remo
      vec3 Lz = vec3(-sin(rot)*.0, 0., 1.);
      vec3 anca = vec3(x0, .1, 0.);
      vec3 cintura = anca + L*.22;
      vec3 ombro = anca + L*.62;
      // tronco: mais estreito na cintura, largo nos ombros
      vec3 pa = p - anca, ba = ombro - anca;
      float hh = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.);
      vec3 qq = pa - ba*hh;
      qq.z *= mix(1.05, .72, hh);                            // ombros largos
      float tronco = length(qq) - mix(.15, .14, hh);
      vec3 oE = ombro + vec3(sin(rot)*.08, -.03, .2), oD = ombro + vec3(-sin(rot)*.08, -.03, -.2);
      tronco = min(tronco, sdCap(p, oE, oD, .085));
      if (tronco < r.x) r = vec2(tronco, 4. + fi*.01);
      float pescoco = sdCap(p, ombro, ombro + L*.12, max(.055, fino));
      vec3 cabC = ombro + L*.26 + vec3(.02, 0., 0.);
      float cab = length((p - cabC)*vec3(1., .92, 1.08)) - .115;
      float cabelo = max(length(p - cabC - vec3(-.025, .03, 0.)) - .118, -(dot(p - cabC, normalize(vec3(.75, -.45, 0.))) + .02));
      if (cabelo < r.x) r = vec2(cabelo, 7.);
      // remo: mão de baixo perto da água, mão de cima no punho em T
      vec3 D = normalize(vec3(sin(th), -cos(th), lado*.3));
      vec3 B = ombro + vec3(.3 + .32*alc, -.16 + sobe*.4, lado*.36);
      vec3 T = B - D*.58 + vec3(0., 0., -lado*.12);
      vec3 E = B + D*1.0;
      vec3 sB = lado > 0. ? oE : oD, sT = lado > 0. ? oD : oE;
      vec3 cB = mix(sB, B, .5) + vec3(-.06, -.1, lado*.06);   // cotovelos
      vec3 cT = mix(sT, T, .5) + vec3(-.04, -.06, -lado*.08);
      float bracos = min(min(sdCap(p, sB, cB, max(.058, fino)), sdCap(p, cB, B, max(.048, fino))),
                         min(sdCap(p, sT, cT, max(.058, fino)), sdCap(p, cT, T, max(.048, fino))));
      float pele = min(min(cab, pescoco), bracos);
      if (pele < r.x) r = vec2(pele, 5. + fi*.01);
      float remo = min(sdCap(p, T, E, max(.02, fino)), sdCap(p, B + D*.6, E, max(.08, fino)));
      remo = min(remo, sdCap(p, T - vec3(.07, 0., 0.), T + vec3(.07, 0., 0.), max(.025, fino)));
      if (remo < r.x) r = vec2(remo, 6.);
    }
  }
  return r;
}
vec3 normalCanoa(vec3 p){
  vec2 e = vec2(.012, -.012);
  return normalize(e.xyy*mapaCanoa(p + e.xyy).x + e.yyx*mapaCanoa(p + e.yyx).x + e.yxy*mapaCanoa(p + e.yxy).x + e.xxx*mapaCanoa(p + e.xxx).x);
}
// traça um raio (em coordenadas do mundo) contra a canoa; devolve cor e cobertura, e a distância em tC
vec4 canoaCor(vec3 ro, vec3 rd, out float tC){
  tC = 1e9;
  vec3 oc = ro - (cC + vec3(0., .5, 0.));
  float b = dot(oc, rd), c = dot(oc, oc) - 64.;
  float h = b*b - c;
  if (h < 0.) return vec4(0.);
  h = sqrt(h);
  float t0 = max(-b - h, 0.), t1 = -b + h;
  float tt = t0, dmin = 1e9, tmin = t0; float mat = 0.; bool bateu = false;
  for (int i = 0; i < 72; i++) {
    vec2 m = mapaCanoa(paraCanoa(ro + rd*tt));
    if (m.x < dmin) { dmin = m.x; tmin = tt; mat = m.y; }
    if (m.x < .002*tt*.05 + .003) { bateu = true; break; }
    tt += max(m.x*.8, .01);
    if (tt > t1) break;
  }
  float pxAng = 1./(res.y*foco);
  float cob = bateu ? 1. : 1. - smoothstep(0., pxAng*tmin*1.1, dmin);
  if (cob <= 0.) return vec4(0.);
  tC = tmin;
  vec3 pw = ro + rd*tmin;
  vec3 q = paraCanoa(pw);
  vec3 nl = normalCanoa(q);
  vec3 n = normalize(nl.x*cH + nl.y*vec3(0., 1., 0.) + nl.z*cZ);
  float quem = fract(mat)*100.;                         // índice do remador
  vec3 alb;
  if (mat < 1.5) alb = vec3(.86,.85,.82);
  else if (mat < 2.5) alb = vec3(.05,.05,.06);
  else if (mat < 3.5) alb = vec3(.12,.12,.13);
  else if (mat < 4.5) alb = mod(quem + .5, 3.) < 1. ? vec3(.2,.06,.32) : mod(quem + .5, 3.) < 2. ? vec3(.035,.035,.045) : vec3(.07,.1,.17);   // lycra roxa, preta, azul-escura
  else if (mat < 5.5) alb = mix(vec3(.52,.34,.22), vec3(.3,.18,.11), fract(quem*.37 + .2));               // tons de pele
  else if (mat < 6.5) alb = vec3(.03,.03,.035);
  else alb = vec3(.025,.02,.018);                                                                         // cabelo
  if (mat < 1.5) alb = mix(alb, vec3(1.,.55,.1), smoothstep(.2, .26, q.y)*.85);   // faixa laranja na borda
  float visSolC = smoothstep(-.03, .02, SOL.y)*(1. - nuvem*.75)*(1. - chuva*.85);
  vec3 corSol = mix(vec3(1.,.55,.25), vec3(1.,.96,.88), DIA)*mix(.6, 2.2, DIA)*visSolC;
  float dif = max(dot(n, SOL), 0.);
  vec3 ceuL = paleta(.35)*(.55 + .45*n.y);
  vec3 agua = paleta(.02)*.35*max(-n.y, 0.);
  float oclu = mat > 3.5 ? .55 + .45*smoothstep(.2, 1.1, q.y) : 1.;   // corpos mais escuros junto ao casco
  vec3 cor = alb*(corSol*dif*1.15 + ceuL*.42*oclu + agua);
  cor += corSol*pow(max(dot(reflect(rd, n), SOL), 0.), 24.)*(mat < 1.5 || mat > 5.5 ? .35 : .05);
  cor += paleta(.05)*pow(1. - max(dot(n, -rd), 0.), 4.)*.15;                          // contorno de luz
  float neb = (1. - exp(-tmin*(.008 + chuva*.05 + nuvem*.006)))*mix(.45, .62, chuva);
  cor = mix(cor, paleta(.01)*mix(1., .8, chuva), neb);
  return vec4(cor, cob);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*res)/res.y;
  vec3 gv = vec3(0.);
  uv += gv.xy*.09;
  float e = SOL.y;
  DIA = smoothstep(.04, .26, e);
  NOITE = 1. - smoothstep(-.17, -.03, e);
  OCASO = max(1. - DIA - NOITE, 0.);
  vec3 ro = vec3(0., 1.6, t*.6);
  if (canoa.z > .001) preparaCanoa(ro);
  vec3 rd = normalize(vec3(uv.x, uv.y + pitch, foco));
  vec3 col;
  float luzGeral = DIA + OCASO*.5 + NOITE*.08;
  if (rd.y >= 0.) {
    col = ceu(rd);
  } else {
    float dist = -ro.y/rd.y;
    vec3 p = ro + rd*dist;
    detalhe = exp(-dist*.035);
    // mar agitado: as ondas sobem de verdade (refina o ponto onde o olhar bate na água)
    if (mar > .25) {
      float A0 = mix(.13, .95, mar*mar);
      float perto = exp(-dist*.05);
      for (int j = 0; j < 4; j++) {
        float hh = (altura(p.xz) - A0*.45)*smoothstep(.25, .6, mar)*perto;
        dist = mix(dist, (ro.y - hh)/-rd.y, .65);
        p = ro + rd*dist;
      }
    }
    float e2 = .03 + dist*.004;
    float k = exp(-dist*.012);
    float hx = altura(p.xz+vec2(e2,0.)) - altura(p.xz-vec2(e2,0.));
    float hz = altura(p.xz+vec2(0.,e2)) - altura(p.xz-vec2(0.,e2));
    float forca = mix(1.2, 2.3, mar)*mix(.5, 1., detalhe);
    vec3 n = normalize(vec3(-hx/(2.*e2)*k*forca, 1., -hz/(2.*e2)*k*forca));
    vec3 rf = reflect(rd, n); rf.y = max(abs(rf.y), .075*smoothstep(.2, .5, mar)); rf = normalize(rf);
    float fres = .02 + .98*pow(1.-max(dot(n,-rd),0.), 5.);
    vec3 fundo = mix(vec3(.015,.015,.045), vec3(.05,.12,.13), DIA) + vec3(.12,.04,.05)*max(dot(n, SOL),0.)*OCASO;
    float hgt = altura(p.xz);
    float crista = smoothstep(.55,.9, hgt) * k;
    fundo += vec3(.10,.08,.12)*crista*(1.-mar);
    col = mix(fundo, ceu(rf)*.8, fres);
    float A = mix(.13, .95, mar*mar);
    // luz a atravessar a crista: o verde-água das ondas
    float corpo = smoothstep(A*.5, A*1.1, hgt);
    col += mix(vec3(.02,.09,.08), vec3(.05,.2,.17), DIA)*corpo*(DIA*.9 + OCASO*.35 + .05)*smoothstep(.2, .7, mar)*k*(1. - fres);
    // espuma: renda fina no topo das cristas, a desfazer-se
    float renda = fbm(p.xz*vec2(2.4, .9) + t*vec2(.25, .1));
    float espuma = smoothstep(A*1., A*1.3, hgt + .35*A*(renda - .5));
    espuma *= smoothstep(.32, .62, fbm(p.xz*5.5 - t*.35)) * .7 + .3*smoothstep(A*1.2, A*1.45, hgt);
    espuma *= smoothstep(.3, .75, mar) * mix(.1, 1., smoothstep(.2, .85, detalhe));
    col = mix(col, vec3(.86,.9,.92)*(.14 + luzGeral*.7), clamp(espuma, 0., 1.)*.8);
    float visSol = smoothstep(-.03, .01, SOL.y) * (1. - nuvem*.85) * (1. - chuva*.9);
    float rug = mix(60., 900., 1.-k);
    float sp = pow(max(dot(rf, SOL),0.), rug);
    col += mix(vec3(1.,.58,.26), vec3(1.,.95,.85), DIA)*sp*mix(4.,18.,1.-k)*mix(.45, 1., DIA)*visSol;
    float spL = pow(max(dot(rf, LUA),0.), rug*.8);
    col += vec3(.75,.82,1.)*spL*mix(1.2, 5., 1.-k)*(1. - cos(fase*6.2832))*.5*NOITE*(1.-nuvem*.8)*(1.-chuva);
    float an = (aneis(p.xz*1.6, 0.) + aneis(p.xz*2.3 + 5.7, 9.)) * k;
    col += vec3(.8,.85,.9)*an*chuva*(.12 + luzGeral*.5);
    if (canoa.z > .001) {
      vec3 qc = paraCanoa(p);
      if (abs(qc.x) < 30. && abs(qc.z) < 8.) {
        // reflexo: o mesmo raio visto pela câmara espelhada na água, tremido pelas ondas
        float tR;
        vec4 rc = canoaCor(vec3(ro.x, -ro.y, ro.z), normalize(vec3(rd.x + n.x*.05, -rd.y, rd.z + n.z*.05)), tR);
        col = mix(col, rc.rgb*.75, rc.w*.6*(1. - mar*.45)*canoa.z);
        // espuma onde o casco e o ama tocam a água
        float bc = length(vec2(qc.x/6.9, qc.z/.3)) - 1.;
        float ba = length(vec2((qc.x + .3)/3., (qc.z - 1.9)/.15)) - 1.;
        float esp = smoothstep(.08, 0., abs(bc)*2.) + smoothstep(.12, 0., abs(ba))*.6;
        // rasto em V atrás da popa
        float atras = -qc.x - 6.6;
        float v = atras > 0. ? smoothstep(.35 + atras*.03, 0., abs(abs(qc.z - .1) - atras*.16))*exp(-atras*.07) : 0.;
        esp += v*(.5 + .5*fbm(qc.xz*3. + t*.5));
        col = mix(col, vec3(.86,.9,.92)*(.18 + luzGeral*.7), clamp(esp, 0., 1.)*.55*canoa.z*k);
      }
    }
    float neb = 1.-exp(-dist*(.008 + chuva*.05 + nuvem*.006));
    col = mix(col, paleta(.01)*mix(1., .8, chuva), neb*mix(.45, .62, chuva));
  }
  // canoa a atravessar a baía
  if (canoa.z > .001) {
    float tC;
    vec4 cc = canoaCor(ro, rd, tC);
    float tW = rd.y < 0. ? -ro.y/rd.y : 1e9;
    if (cc.w > 0. && tC < tW) col = mix(col, cc.rgb, cc.w*canoa.z);
  }
  col = mix(col, paleta(.05), chuva*.18*(1.-smoothstep(0., .25, abs(rd.y))));
  col = mix(col, paleta(.1)*.9, chuva*.1);
  float fundoLum = dot(col, vec3(.3,.6,.1));
  col += vec3(.8,.85,.95)*chuvaTela(gl_FragCoord.xy)*chuva*(.08 + fundoLum*.75 + raio*.5);
  col *= 1. - gv.z*.06;
  col += vec3(.9,.95,1.)*gv.z*smoothstep(.0, .5, -gv.y - gv.x*.3)*.05*(.4 + fundoLum);
  col += raio*.03*mix(1., .4, DIA);
  // tempestade: luz mais baixa e dramática, horizonte mais claro
  float pesado = smoothstep(.8, 1., chuva);
  col *= mix(1., mix(.58, .85, smoothstep(-.05, .1, -rd.y + .05)), pesado);
  // céu encoberto de dia: menos lavado, mais cinema — topo e água mais fundos, luz fria, horizonte aberto
  float cz = clamp(nuvem*.6 + chuva*.7, 0., 1.)*(1. - OCASO*.7)*(1. - NOITE*.5)*(1. - pesado*.6);
  float topo = smoothstep(.04, .45, rd.y), agua = smoothstep(.0, -.25, rd.y);
  col *= mix(1., .8 - topo*.22 - agua*.14, cz);
  col = mix(col, col*vec3(.9,1.,1.08), cz*.7);
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
const u = Object.fromEntries(["res","t","pitch","foco","SOL","nuvem","chuva","mar","raio","vento","morro","LUA","fase","raioX","canoa"].map((n) => [n, U(n)]));

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
  const l = asp < 1 ? [-.12, .42, 1] : [.34, .2, 1];
  const n = Math.hypot(...l);
  gl.uniform3f(u.LUA, l[0]/n, l[1]/n, l[2]/n);
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
// fase da lua: 0 nova, .5 cheia (mês sinódico a partir de uma lua nova conhecida)
function faseReal(ms){ const jd = ms/86400000 + 2440587.5; return (((jd - 2451550.26)/29.530588853) % 1 + 1) % 1; }
let faseTeste = null;
// TEMPO_REAL = true volta a seguir a hora e o tempo de Itajaí (versão guardada em oceano-tempo-real.js)
const TEMPO_REAL = false;
const HORA_POENTE = 18 + 45/60;                              // sempre o pôr do sol, com o sol a pousar atrás do morro
let horaTeste = !TEMPO_REAL && !params.get("hora") ? HORA_POENTE : params.get("hora") ? params.get("hora").split(":").reduce((h, m) => +h + m/60) : null;
let modo = params.get("tempo");
function agoraMs(){
  if (horaTeste == null) return Date.now();
  if (!TEMPO_REAL) return Date.UTC(2026, 10, 24, 3) + horaTeste*3600e3;   // dia fixo: o pôr do sol fica sempre igual
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
    if (!TEMPO_REAL) {                                       // pôr do sol fixo: do tempo real só entram a chuva e o mar
      alvo.tempestade = false;
      alvo.nuvem = alvo.chuva > 0 ? .45 : .15;
    }
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
if (!TEMPO_REAL) {                                         // abre logo no pôr do sol limpo; a chuva entra quando chegarem os dados
  Object.assign(alvo, { nuvem: .15, chuva: 0, mar: .15, vento: .1, tempestade: false });
  Object.assign(atual, alvo);
}
buscaTempo();
setInterval(buscaTempo, 10*60*1000);

// ---------- relâmpagos ----------
let raio = 0, proxRaio = 0, raioPos = [0, 0], pisca = [];
function relampago(ms){
  if (!atual.tempestade) { raio *= .85; return; }
  if (ms > proxRaio) {
    raioPos = [-.08 + Math.random()*.5, Math.random()];
    pisca = [[ms, 1.4], [ms + 70, .15], [ms + 130, 1.2], [ms + 210, .3], [ms + 300, .9]];
    proxRaio = ms + 4000 + Math.random()*8000;
  }
  while (pisca.length && ms >= pisca[0][0]) raio = pisca.shift()[1];
  raio *= .9;
}

const t0 = performance.now();
let visivel = true;
new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(canvas);
// ---------- canoas a atravessar: uma de cada vez, com o mar vazio entre elas ----------
const CANOA_LIGADA = true;
const can = { ativo: false, a: 0, s: 1, ate: 0, vis: 0, primeira: true };
function canoaPasso(ms, dt, elev){
  const asp = canvas.width/canvas.height, foco = asp < 1 ? .62 : 1.5;
  const dc = asp < 1 ? 30 : 44;
  const meia = Math.atan(asp*.5/foco) + 9/dc;
  const pode = CANOA_LIGADA && elev > -.06 && !atual.tempestade;           // de dia e no nascer/pôr do sol, nunca com trovoada
  if (!can.ativo) {
    if (pode && ms > can.ate) {
      can.ativo = true; can.s = -1;   // sempre da direita para a esquerda
      can.a = -can.s*meia;   // entra sempre pela borda do ecrã
      can.primeira = false;
    }
  } else {
    can.a += can.s*(2.4/dc)*dt;                               // ~2,4 m/s, velocidade real de uma OC6
    if (can.a*can.s > meia) { can.ativo = false; can.ate = ms + 5000; }
  }
  can.vis += ((can.ativo && pode ? 1 : 0) - can.vis)*(1 - Math.exp(-dt*1.5));
  gl.uniform4f(u.canoa, can.a, can.s, can.vis, dc);
}

(function frame(){
  if (visivel){
    const ms = performance.now();
    const agora = performance.now(), dt = Math.min(.25, (agora - (frame.ult || agora))/1000); frame.ult = agora;
    const passo = 1 - Math.exp(-dt*1.2);   // ~2 s para mudar de tempo, igual em qualquer ecrã
    for (const k of ["nuvem","chuva","mar","vento"]) atual[k] += (alvo[k] - atual[k])*passo;
    atual.tempestade = alvo.tempestade;
    relampago(ms);
    const s = sol(agoraMs());
    let rel = s.az - (s.poente - sunX);
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    gl.uniform3f(u.SOL, Math.sin(rel)*Math.cos(s.elev), Math.sin(s.elev), Math.cos(rel)*Math.cos(s.elev));
    gl.uniform1f(u.nuvem, atual.nuvem); gl.uniform1f(u.chuva, atual.chuva);
    gl.uniform1f(u.fase, faseTeste ?? faseReal(agoraMs()));
    gl.uniform1f(u.mar, atual.mar); gl.uniform1f(u.vento, atual.vento); gl.uniform1f(u.raio, raio); gl.uniform2f(u.raioX, raioPos[0], raioPos[1]);
    canoaPasso(ms, dt, s.elev);
    gl.uniform1f(u.t, (ms - t0)/1000 + 20.);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
})();

// API para o painel de teste (só na maquete)
window.ceuTeste = {
  hora(h){ horaTeste = h; },
  tempo(m){ modo = m; simulacao(); if (ultimo) rotulo({ ...ultimo, weather_code: { limpo: 0, nublado: 3, chuva: 63, tempestade: 95, agitado: 2 }[m] }); },
  real(){ manual = false; faseTeste = null; if (TEMPO_REAL) { horaTeste = null; modo = null; buscaTempo(); } else { horaTeste = HORA_POENTE; modo = null; buscaTempo(); } },
  lua(f){ faseTeste = f; },
  canoa(a, s = 1){ if (!CANOA_LIGADA) return; can.ativo = true; can.a = a; can.s = s; can.vis = 1; },
  fase(){ return faseTeste ?? faseReal(agoraMs()); },
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
