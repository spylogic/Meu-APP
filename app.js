// ---------------------------------------------------------------------------
// App "Meus Projetos" — painel único pra ver os projetos de hardware.
// Vanilla JS, sem build, pra rodar direto do GitHub Pages como os outros
// projetos. Roteamento simples por hash (#/, #/p/<id>).
// ---------------------------------------------------------------------------

const app = document.getElementById("app");
let intervaloAtual = null;

// --- utilidades -------------------------------------------------------

function porId(id) {
  return PROJETOS.find((p) => p.id === id);
}

function salvarCache(id, dados) {
  try {
    localStorage.setItem(
      "cache:" + id,
      JSON.stringify({ dados, salvoEm: Date.now() })
    );
  } catch (e) {
    /* localStorage pode falhar (modo privado etc.) — segue sem cache */
  }
}

function lerCache(id) {
  try {
    const bruto = localStorage.getItem("cache:" + id);
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) {
    return null;
  }
}

// Normaliza campo "atualizado_em" que pode vir em segundos ou milissegundos
function paraEpochMs(valor) {
  if (!valor) return 0;
  return valor > 1e12 ? valor : valor * 1000;
}

function formatarHaQuanto(ms) {
  if (!ms) return "sem dados";
  const diffSeg = Math.floor((Date.now() - ms) / 1000);
  if (diffSeg < 5) return "agora mesmo";
  if (diffSeg < 60) return `há ${diffSeg}s`;
  const diffMin = Math.floor(diffSeg / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  return `há ${Math.floor(diffH / 24)}d`;
}

// ok / warn / danger / muted a partir da idade do dado
function statusPorFrescor(ms) {
  if (!ms) return "muted";
  const diffMin = (Date.now() - ms) / 60000;
  if (diffMin < 5) return "ok";
  if (diffMin < 30) return "warn";
  return "danger";
}

async function buscarJson(url, timeoutMs = 8000) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controlador.signal, cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

async function escreverFirebase(url, valor) {
  const resp = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(valor),
  });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  return resp.json();
}

function pararAtualizacaoAutomatica() {
  if (intervaloAtual) {
    clearInterval(intervaloAtual);
    intervaloAtual = null;
  }
}

// --- roteador -----------------------------------------------------------

function rotaAtual() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (!hash) return { tela: "home" };
  const partes = hash.split("/");
  if (partes[0] === "p" && partes[1]) return { tela: "projeto", id: partes[1] };
  return { tela: "home" };
}

function navegar() {
  pararAtualizacaoAutomatica();
  const rota = rotaAtual();
  if (rota.tela === "home") {
    renderHome();
  } else {
    const projeto = porId(rota.id);
    if (!projeto) {
      renderHome();
      return;
    }
    renderProjeto(projeto);
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", navegar);
window.addEventListener("DOMContentLoaded", navegar);

// --- tela inicial ---------------------------------------------------------

function renderHome() {
  app.innerHTML = `
    <header class="topo">
      <h1>Meus Projetos</h1>
    </header>
    <div class="grade-projetos" id="grade-projetos"></div>
  `;
  const grade = document.getElementById("grade-projetos");

  PROJETOS.forEach((projeto) => {
    const card = document.createElement("a");
    card.href = `#/p/${projeto.id}`;
    card.className = "card-projeto";
    card.innerHTML = `
      <div class="icone">${projeto.icone}</div>
      <div class="info">
        <div class="nome">${projeto.nome}</div>
        <div class="status-linha" id="status-${projeto.id}">
          <span class="bolinha muted"></span> verificando…
        </div>
      </div>
      <div class="seta">›</div>
    `;
    grade.appendChild(card);
    atualizarStatusCard(projeto);
  });
}

async function atualizarStatusCard(projeto) {
  const linha = document.getElementById(`status-${projeto.id}`);
  if (!linha) return;

  if (projeto.tipo === "status-estatico") {
    linha.innerHTML = `<span class="bolinha ok"></span> ${projeto.itens.length} placa(s) em acompanhamento`;
    return;
  }

  const ativo = !!projeto.firebaseBase && projeto.ativo !== false;
  if (!ativo) {
    linha.innerHTML = `<span class="bolinha muted"></span> em breve`;
    return;
  }

  try {
    const dados = await buscarJson(`${projeto.firebaseBase}/${projeto.caminho}/${projeto.campoAtualizadoEm}.json`);
    const ms = paraEpochMs(dados);
    const status = statusPorFrescor(ms);
    linha.innerHTML = `<span class="bolinha ${status}"></span> ${formatarHaQuanto(ms)}`;
  } catch (e) {
    linha.innerHTML = `<span class="bolinha danger"></span> sem conexão`;
  }
}

// --- tela de projeto: roteamento por tipo ---------------------------------

function renderProjeto(projeto) {
  app.innerHTML = `
    <header class="topo">
      <button class="voltar" onclick="location.hash = ''">‹</button>
      <h1>${projeto.icone} ${projeto.nome}</h1>
    </header>
    <div id="conteudo-projeto"></div>
  `;

  if (projeto.tipo === "automotivo") {
    iniciarTelaAutomotivo(projeto);
  } else if (projeto.tipo === "irrigacao") {
    renderIrrigacao(projeto);
  } else if (projeto.tipo === "status-estatico") {
    renderStatusEstatico(projeto);
  }
}

// --- tela: automotivo (dados ao vivo) --------------------------------------

function iniciarTelaAutomotivo(projeto) {
  const carregar = () => carregarDadosAutomotivo(projeto);
  carregar();
  intervaloAtual = setInterval(carregar, INTERVALO_ATUALIZACAO);
}

async function carregarDadosAutomotivo(projeto) {
  const container = document.getElementById("conteudo-projeto");
  try {
    const dados = await buscarJson(`${projeto.firebaseBase}/${projeto.caminho}.json`);
    salvarCache(projeto.id, dados);
    renderDadosAutomotivo(projeto, dados, false);
  } catch (e) {
    const cache = lerCache(projeto.id);
    if (cache) {
      renderDadosAutomotivo(projeto, cache.dados, true, cache.salvoEm);
    } else if (container) {
      container.innerHTML = `<div class="aviso"><strong>Sem conexão</strong><br>Não consegui buscar os dados agora e ainda não há nada em cache neste aparelho.</div>`;
    }
  }
}

function renderDadosAutomotivo(projeto, dados, offline, salvoEm) {
  const container = document.getElementById("conteudo-projeto");
  if (!container) return;

  const arref = dados.arrefecimento || {};
  const combustivel = dados.combustivel || {};
  const oleo = dados.oleo || {};
  const vibracao = dados.vibracao || {};
  const atualizadoEm = offline ? salvoEm : paraEpochMs(dados[projeto.campoAtualizadoEm]);

  const tempMotor = arref.temp_motor_c;
  const tempStatus = classificar(tempMotor, projeto.limites.tempMotor, true);

  const combPct = combustivel.nivel_pct;
  const combStatus = classificar(combPct, projeto.limites.combustivel, false);

  const pontosVibracao = ["planetaria", "cambio", "diferencial", "carter", "cabecote"];
  const nomesVibracao = {
    planetaria: "Planetária",
    cambio: "Câmbio",
    diferencial: "Diferencial",
    carter: "Cárter",
    cabecote: "Cabeçote",
  };

  container.innerHTML = `
    ${offline ? `<div class="aviso" style="margin-bottom:16px;">📡 Sem conexão agora — mostrando o último dado recebido.</div>` : ""}

    <div class="secao-titulo">Motor</div>
    <div class="grade-metricas">
      <div class="metrica">
        <div class="rotulo">Temp. do motor</div>
        <div class="valor ${tempStatus}">${formatarNumero(tempMotor)}<span class="unidade">°C</span></div>
      </div>
      <div class="metrica">
        <div class="rotulo">Arrefecimento</div>
        <div class="valor ${arref.nivel_ok ? "ok" : "danger"}">${arref.nivel_ok === undefined ? "—" : arref.nivel_ok ? "Nível OK" : "Nível baixo"}</div>
      </div>
      <div class="metrica">
        <div class="rotulo">Combustível</div>
        <div class="valor ${combStatus}">${formatarNumero(combPct)}<span class="unidade">%</span></div>
      </div>
      <div class="metrica">
        <div class="rotulo">Óleo (nível/temp)</div>
        <div class="valor muted">${oleo.disponivel ? "OK" : "Sensor pendente"}</div>
      </div>
    </div>

    <div class="secao-titulo">Vibração (5 pontos)</div>
    <div class="grade-chips">
      ${pontosVibracao
        .map((chave) => {
          const ponto = vibracao[chave] || {};
          const online = !!ponto.online;
          return `<div class="chip"><span class="bolinha ${online ? "ok" : "muted"}"></span> ${nomesVibracao[chave]}</div>`;
        })
        .join("")}
    </div>

    <div class="rodape-atualizacao">Última leitura: ${formatarHaQuanto(atualizadoEm)}</div>
  `;
}

function classificar(valor, limites, maiorEhPior) {
  if (valor === undefined || valor === null) return "muted";
  if (!limites) return "";
  const { atencao, critico } = limites;
  if (maiorEhPior) {
    if (valor >= critico) return "danger";
    if (valor >= atencao) return "warn";
    return "ok";
  } else {
    if (valor <= critico) return "danger";
    if (valor <= atencao) return "warn";
    return "ok";
  }
}

function formatarNumero(v) {
  if (v === undefined || v === null) return "—";
  return typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : v;
}

// --- tela: irrigação (em breve / ao vivo quando configurado) --------------

function renderIrrigacao(projeto) {
  const container = document.getElementById("conteudo-projeto");
  const ligado = projeto.ativo && projeto.firebaseBase;

  if (!ligado) {
    container.innerHTML = `
      <div class="aviso">
        <strong>Em breve</strong><br>
        Essa tela já está pronta no app — falta só apontar pro projeto Firebase
        da irrigação. Assim que o ESP01 estiver gravando os dados, me passa a
        URL do banco que eu ligo isso aqui (nível da caixa, temperatura/umidade,
        sensor de água e os controles da bomba com os 2 horários programáveis).
      </div>
    `;
    return;
  }

  // Quando ativo=true e firebaseBase preenchido, carrega os dados de verdade.
  const carregar = () => carregarDadosIrrigacao(projeto);
  carregar();
  intervaloAtual = setInterval(carregar, INTERVALO_ATUALIZACAO);
}

async function carregarDadosIrrigacao(projeto) {
  const container = document.getElementById("conteudo-projeto");
  try {
    const dados = await buscarJson(`${projeto.firebaseBase}/${projeto.caminho}.json`);
    salvarCache(projeto.id, dados);
    renderDadosIrrigacao(projeto, dados, false);
  } catch (e) {
    const cache = lerCache(projeto.id);
    if (cache) {
      renderDadosIrrigacao(projeto, cache.dados, true, cache.salvoEm);
    } else if (container) {
      container.innerHTML = `<div class="aviso"><strong>Sem conexão</strong><br>Não consegui buscar os dados agora.</div>`;
    }
  }
}

function renderDadosIrrigacao(projeto, dados, offline, salvoEm) {
  const container = document.getElementById("conteudo-projeto");
  if (!container) return;

  const caixa = dados.caixa || {};
  const ambiente = dados.ambiente || {};
  const reservatorio = dados.reservatorio || {};
  const bomba = dados.bomba || {};
  const atualizadoEm = offline ? salvoEm : paraEpochMs(dados[projeto.campoAtualizadoEm]);

  container.innerHTML = `
    ${offline ? `<div class="aviso" style="margin-bottom:16px;">📡 Sem conexão agora — mostrando o último dado recebido.</div>` : ""}

    <div class="secao-titulo">Caixa d'água</div>
    <div class="grade-metricas">
      <div class="metrica">
        <div class="rotulo">Nível</div>
        <div class="valor ${caixa.nivel_pct !== undefined ? (caixa.nivel_pct < 20 ? "danger" : caixa.nivel_pct < 40 ? "warn" : "ok") : "muted"}">${formatarNumero(caixa.nivel_pct)}<span class="unidade">%</span></div>
      </div>
      <div class="metrica">
        <div class="rotulo">Água no reservatório</div>
        <div class="valor ${reservatorio.agua_detectada ? "ok" : "warn"}">${reservatorio.agua_detectada === undefined ? "—" : reservatorio.agua_detectada ? "Detectada" : "Ausente"}</div>
      </div>
      <div class="metrica">
        <div class="rotulo">Temperatura</div>
        <div class="valor">${formatarNumero(ambiente.temp_c)}<span class="unidade">°C</span></div>
      </div>
      <div class="metrica">
        <div class="rotulo">Umidade</div>
        <div class="valor">${formatarNumero(ambiente.umidade_pct)}<span class="unidade">%</span></div>
      </div>
    </div>

    <div class="secao-titulo">Bomba</div>
    <button class="botao-acao" id="btn-bomba" ${offline ? "disabled" : ""}>
      ${bomba.estado ? "Desligar bomba" : "Ligar bomba"}
    </button>

    <div class="rodape-atualizacao">Última leitura: ${formatarHaQuanto(atualizadoEm)}</div>
  `;

  const botao = document.getElementById("btn-bomba");
  if (botao && !offline) {
    botao.addEventListener("click", async () => {
      botao.disabled = true;
      try {
        await escreverFirebase(
          `${projeto.firebaseBase}/${projeto.caminho}/bomba/comando_manual.json`,
          !bomba.estado
        );
      } catch (e) {
        alert("Não consegui enviar o comando. Tente de novo.");
      } finally {
        botao.disabled = false;
      }
    });
  }
}

// --- tela: status estático (PCB) -------------------------------------------

function renderStatusEstatico(projeto) {
  const container = document.getElementById("conteudo-projeto");
  container.innerHTML = `
    <div class="lista-status">
      ${projeto.itens
        .map(
          (item) => `
        <div class="item-status">
          <div class="nome">${item.nome}</div>
          <div class="status">${item.status}</div>
          ${item.detalhe ? `<div class="detalhe">${item.detalhe}</div>` : ""}
        </div>
      `
        )
        .join("")}
    </div>
  `;
}
