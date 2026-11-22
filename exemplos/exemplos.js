// Página de exemplos: quatro negócios, cada um com a conversa no WhatsApp, o que fica automático e o painel.
// Tudo fictício (nomes, horários), só para mostrar como funciona.
(function () {
  var EX = {
    clinica: {
      negocio: "Clínica",
      titulo: "Clínica médica ou dentária",
      chat: [
        ["eles", "Olá Ana. Lembrete: a tua consulta é amanhã, terça, às 10:30. Responde 1 para confirmar ou 2 para remarcar."],
        ["eu", "1"],
        ["eles", "Confirmado ✓ Até amanhã."]
      ],
      pontos: ["Marcação online a qualquer hora", "Lembrete no WhatsApp na véspera", "Quem desmarca liberta a vaga para a lista de espera"],
      painelTitulo: "Hoje",
      painel: [["09:00", "Consulta", "Confirmada", "ok"], ["10:30", "Ana", "Confirmada", "ok"], ["11:15", "Vaga libertada", "Lista de espera avisada", "aviso"]]
    },
    estetica: {
      negocio: "Estúdio de estética",
      titulo: "Clínica de estética",
      chat: [
        ["eles", "Olá Rita. A tua sessão é sexta às 15:00. Responde 1 para confirmar ou 2 para remarcar."],
        ["eu", "2"],
        ["eles", "Sem problema. Tenho sábado às 11:00 ou segunda às 17:30. Qual preferes?"],
        ["eu", "Sábado"],
        ["eles", "Feito: sábado às 11:00 ✓"]
      ],
      pontos: ["Remarcar sem telefonemas", "Horários livres preenchidos pela lista de espera", "A agenda de cada profissional no painel"],
      painelTitulo: "Sábado",
      painel: [["10:00", "Marta", "Confirmada", "ok"], ["11:00", "Rita", "Remarcada", "ok"], ["12:30", "Livre", "À espera de marcação", "livre"]]
    },
    academia: {
      negocio: "Academia",
      titulo: "Academia ou estúdio",
      chat: [
        ["eles", "Olá Pedro. A mensalidade deste mês já está disponível. Podes pagar aqui: pagar.exemplo/123"],
        ["eu", "Pago ✓"],
        ["eles", "Recebemos o pagamento. Obrigado e bons treinos."]
      ],
      pontos: ["Cobrança da mensalidade com link de pagamento", "Lembrete automático se ficar por pagar", "No painel vês quem já pagou e quem falta"],
      painelTitulo: "Mensalidades",
      painel: [["Pedro", "Plano mensal", "Paga", "ok"], ["Inês", "Plano mensal", "Paga", "ok"], ["Tiago", "Plano trimestral", "Lembrete enviado", "aviso"]]
    },
    ensino: {
      negocio: "Escola de línguas",
      titulo: "Ensino (escola ou professor)",
      chat: [
        ["eles", "Olá Marta. A aula de inglês da Sofia passou para quinta às 18:00. Responde 1 para confirmar."],
        ["eu", "1"],
        ["eles", "Confirmado ✓ Até quinta."]
      ],
      pontos: ["Turmas e horários num só sítio", "Avisos de mudanças a alunos e pais pelo WhatsApp", "Mensalidades e relatório no fim do mês"],
      painelTitulo: "Quinta",
      painel: [["17:00", "Turma A1", "8 alunos", "ok"], ["18:00", "Sofia", "Aula remarcada", "ok"], ["19:00", "Turma B2", "1 lugar livre", "livre"]]
    }
  };

  var semMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var palco = document.getElementById("ex-palco");
  var abas = [].slice.call(document.querySelectorAll("[data-aba]"));
  var marca = document.querySelector(".ex-abas__marca");
  var $ = function (k) { return palco.querySelector('[data-ex="' + k + '"]'); };
  var corrida = 0;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function espera(ms) { return new Promise(function (r) { setTimeout(r, semMovimento ? 0 : ms); }); }

  // A conversa aparece mensagem a mensagem; do lado deles, primeiro os três pontinhos.
  async function conversa(lista, minha) {
    var chat = $("chat");
    chat.textContent = "";
    await espera(350);
    for (var i = 0; i < lista.length; i++) {
      if (minha !== corrida) return;
      var m = lista[i];
      if (m[0] === "eles") {
        var a = el("li", "ex-msg ex-msg--eles ex-msg--escreve");
        a.appendChild(el("span", "ex-pontinhos")).innerHTML = "<i></i><i></i><i></i>";
        chat.appendChild(a);
        await espera(650 + Math.min(900, m[1].length * 9));
        if (minha !== corrida) return;
        a.classList.remove("ex-msg--escreve");
        a.textContent = m[1];
      } else {
        await espera(500);
        if (minha !== corrida) return;
        chat.appendChild(el("li", "ex-msg ex-msg--eu", m[1]));
      }
      await espera(260);
    }
  }

  function mostrar(chave, primeira) {
    var d = EX[chave], minha = ++corrida;
    abas.forEach(function (b) {
      var sim = b.dataset.aba === chave;
      b.setAttribute("aria-selected", sim ? "true" : "false");
      b.tabIndex = sim ? 0 : -1;
      if (sim) { palco.setAttribute("aria-labelledby", b.id); moverMarca(b); }
    });
    var trocar = function () {
      $("negocio").textContent = d.negocio;
      $("titulo").textContent = d.titulo;
      $("painel-titulo").textContent = d.painelTitulo;
      var pts = $("pontos"); pts.textContent = "";
      d.pontos.forEach(function (p, i) { var li = el("li", null, p); li.style.setProperty("--i", i); pts.appendChild(li); });
      var pn = $("painel"); pn.textContent = "";
      d.painel.forEach(function (r, i) {
        var li = el("li", "ex-linha ex-linha--" + r[3]); li.style.setProperty("--i", i);
        li.append(el("b", null, r[0]), el("span", null, r[1]), el("em", null, r[2]));
        pn.appendChild(li);
      });
      conversa(d.chat, minha);
    };
    if (primeira || semMovimento) { trocar(); palco.classList.add("ex-palco--entra"); return; }
    palco.classList.remove("ex-palco--entra");
    palco.classList.add("ex-palco--sai");
    setTimeout(function () {
      if (minha !== corrida) return;
      palco.classList.remove("ex-palco--sai");
      trocar();
      void palco.offsetWidth;
      palco.classList.add("ex-palco--entra");
    }, 260);
  }

  // A pílula de vidro desliza para a aba escolhida.
  function moverMarca(b) {
    marca.style.width = b.offsetWidth + "px";
    marca.style.transform = "translateX(" + b.offsetLeft + "px)";
  }
  addEventListener("resize", function () { var b = document.querySelector('[data-aba][aria-selected="true"]'); if (b) moverMarca(b); });

  abas.forEach(function (b, i) {
    b.addEventListener("click", function () { if (b.getAttribute("aria-selected") !== "true") mostrar(b.dataset.aba); });
    b.addEventListener("keydown", function (e) {
      var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!n) return;
      var p = abas[(i + n + abas.length) % abas.length];
      p.focus(); mostrar(p.dataset.aba);
    });
  });

  // Abre no negócio pedido (?n=academia), senão em Clínica.
  var pedido = new URLSearchParams(location.search).get("n");
  var inicial = EX[pedido] ? pedido : "clinica";
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { var b = document.querySelector('[data-aba="' + inicial + '"]'); moverMarca(b); });
  mostrar(inicial, true);
})();
