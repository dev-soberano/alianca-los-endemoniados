// ============================================================================
// 1. CONFIGURAÇÕES GLOBAIS E LINKS DO BANCO DE DADOS
// ============================================================================
const FIREBASE_URL = "https://cybersoberano-default-rtdb.firebaseio.com";
const IMGBB_API_KEY = "8bf2a05fe7578df492f6bdb4f10f9925";

// FUNÇÃO PARA CRIAR CARD HTML
function criarCardHtml(id, item) {
  const isVip = item.tipo === "grupo-vip";
  const tagExibicao = item.tipo.replace("-", " ").toUpperCase();
  const logado = localStorage.getItem("adm_logado") === "true";
  return `
    <div class="group-card ${isVip ? 'vip-card' : ''}" data-id="${id}">
      <div class="card-banner">
        <img src="${item.imagem}" alt="${item.nome}" draggable="false" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400';">
        ${isVip ? '<span class="card-badge-vip">★ VIP</span>' : ''}
        <span class="card-badge-categoria">${tagExibicao}</span>
      </div>
      <div class="card-corpo">
        <h3 class="card-titulo" title="${item.nome}">${item.nome}</h3>
        <a href="${item.link}" target="_blank" class="card-botao-entrar">
          ${isVip ? 'ACESSAR VIP' : 'ENTRAR NO LINK'}
        </a>
        <button class="btn-deletar-card-adm" onclick="removerLinkDoFirebase('${id}')" style="display:${logado ? 'block' : 'none'};">EXCLUIR LINK</button>
      </div>
    </div>
  `;
}

// BUSCA OS DADOS DO FIREBASE E APLICA ANIMAÇÃO DE NOVO GRUPO
function carregarLinksDoFirebase() {
  fetch(`${FIREBASE_URL}/links.json`)
    .then(res => res.json())
    .then(dados => {
      const containers = {
        "grupo-vip": document.getElementById("gradeVips"),
        "grupo-geral": document.getElementById("gradeNormais"),
        "canal-wa": document.getElementById("gradeCanaisWA"),
        "tg-grupo": document.getElementById("gradeTelegramGrupos"),
        "tg-canal": document.getElementById("gradeTelegramCanais")
      };

      const buffers = {};
      Object.keys(containers).forEach(tipo => { buffers[tipo] = ""; });

      let totalContador = 0;
      if (dados) {
        Object.keys(dados).forEach(id => {
          const item = dados[id];
          if (buffers[item.tipo] !== undefined) {
            buffers[item.tipo] += criarCardHtml(id, item);
            totalContador++;
          }
        });
      }

      Object.keys(containers).forEach(tipo => {
        const el = containers[tipo];
        if (el) el.innerHTML = buffers[tipo];
      });

      const totalTxt = document.getElementById("count-total");
      if (totalTxt) totalTxt.innerText = totalContador;

      verificarStatusPainelAdm();
      atualizarTodosCarrosseis();

      const idParaAnimar = localStorage.getItem("idParaAnimar");
      if (idParaAnimar) {
        const card = document.querySelector(`[data-id="${idParaAnimar}"]`);
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.classList.add("novo-grupo-destaque");
          setTimeout(() => card.classList.remove("novo-grupo-destaque"), 4000);
        }
        localStorage.removeItem("idParaAnimar");
      }
    })
    .catch(err => console.error("Erro ao puxar dados do Firebase:", err));
}

// ============================================================================
// 2. SISTEMA DE CONTROLE DE VISITANTES REAIS
// ============================================================================
function gerenciarEstatisticasReais() {
  const hojeStr = new Date().toISOString().slice(0, 10);
  const idSessaoUnica = Math.random().toString(36).substring(2, 9);

  fetch(`${FIREBASE_URL}/estatisticas/visitas_totais.json`)
    .then(res => res.json())
    .then(total => {
      let novoTotal = (parseInt(total) || 0) + 1;
      fetch(`${FIREBASE_URL}/estatisticas/visitas_totais.json`, { method: "PUT", body: novoTotal });
      const el = document.getElementById("count-visitas-total");
      if (el) el.innerText = novoTotal.toLocaleString("pt-BR");
    });

  fetch(`${FIREBASE_URL}/estatisticas/dias/${hojeStr}.json`)
    .then(res => res.json())
    .then(totalDia => {
      let novoTotalDia = (parseInt(totalDia) || 0) + 1;
      fetch(`${FIREBASE_URL}/estatisticas/dias/${hojeStr}.json`, { method: "PUT", body: novoTotalDia });
      const el = document.getElementById("count-visitas-hoje");
      if (el) el.innerText = novoTotalDia.toLocaleString("pt-BR");
    });

  const refOnline = `${FIREBASE_URL}/online/${idSessaoUnica}.json`;
  const enviarPulso = () => { fetch(refOnline, { method: "PUT", body: JSON.stringify({ lastSeen: Date.now() }) }); };
  enviarPulso();
  setInterval(enviarPulso, 15000);

  setInterval(() => {
    fetch(`${FIREBASE_URL}/online.json`)
      .then(res => res.json())
      .then(data => {
        if (!data) return;
        const agora = Date.now();
        let ativos = 0;
        Object.keys(data).forEach(id => {
          if (agora - data[id].lastSeen > 60000) {
            fetch(`${FIREBASE_URL}/online/${id}.json`, { method: "DELETE" });
          } else { ativos++; }
        });
        const el = document.getElementById("count-online");
        if (el) el.innerText = ativos;
      });
  }, 10000);
}

// ============================================================================
// 3. PLAYER DE ÁUDIO
// ============================================================================
function inicializarPlayerMusica() {
  const audio = document.getElementById("musicAudio");
  const btnDesktop = document.getElementById("musicBtn");
  const btnMobile = document.getElementById("musicBtnMobile");
  const statusTexto = document.getElementById("playerStatus");
  const fabIcon = document.getElementById("fabIcon");
  const disco = document.getElementById("playerDisco");
  const btnEntrar = document.getElementById("btnEntrarSite");
  const intro = document.getElementById("introOverlay");

  const atualizarUI = () => {
    const tocando = !audio.paused;
    if (statusTexto) {
      statusTexto.innerText = tocando ? "Tocando" : "Pausado";
      statusTexto.style.color = tocando ? "#00e676" : "";
    }
    if (fabIcon) fabIcon.innerText = tocando ? "⏸️" : "🎵";
    if (disco) tocando ? disco.classList.add("playing") : disco.classList.remove("playing");
  };

  const toggleAudio = () => {
    if (audio.paused) { audio.play().catch(() => {}); } else { audio.pause(); }
  };

  if (btnDesktop) btnDesktop.onclick = toggleAudio;
  if (btnMobile) btnMobile.onclick = toggleAudio;
  if (audio) {
    audio.onplay = atualizarUI;
    audio.onpause = atualizarUI;
  }

  if (btnEntrar) {
    btnEntrar.onclick = () => {
      intro.classList.add("ocultar");
      audio.play().catch(() => {});
    };
  }
}

// ============================================================================
// 4. ENGINE DO PAINEL ADMINISTRATIVO
// ============================================================================
function inicializarPainelControleAdm() {
  const formLogin = document.getElementById("formLoginAdm");
  const formCadastro = document.getElementById("formCadastroLink");
  const btnPublicar = document.getElementById("btnPublicarLink");

  formLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const senhaDigitada = document.getElementById("campoSenhaAdm").value;
    const btnEntrar = formLogin.querySelector("button[type='submit']");
    if (btnEntrar) { btnEntrar.disabled = true; btnEntrar.innerText = "Verificando…"; }
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: senhaDigitada })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("adm_logado", "true");
        verificarStatusPainelAdm();
        carregarPendentesAdm();
        formLogin.reset();
      } else {
        alert("Senha incorreta!");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao verificar senha. Tente novamente.");
    } finally {
      if (btnEntrar) { btnEntrar.disabled = false; btnEntrar.innerText = "Entrar"; }
    }
  });

  // ---- BOTÃO "BUSCAR" (puxa nome e imagem automaticamente pelo link) ----
  const btnBuscar = document.getElementById("btnBuscarDados");
  btnBuscar?.addEventListener("click", async () => {
    const link = document.getElementById("admLinkGrupo").value.trim();
    if (!link) { alert("Cole o link do grupo primeiro."); return; }

    btnBuscar.disabled = true;
    btnBuscar.innerText = "Buscando...";

    try {
      const res = await fetch(`/api/whatsapp-meta?link=${encodeURIComponent(link)}`);
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Não foi possível buscar os dados."); return; }

      document.getElementById("admNomeGrupo").value = data.nome || "";
      document.getElementById("admImgGrupoUrl").value = data.imagem || "";

      const preview = document.getElementById("previewBuscaGrupo");
      if (data.imagem && preview) {
        document.getElementById("previewImgGrupo").src = data.imagem;
        document.getElementById("previewNomeGrupo").innerText = data.nome;
        preview.style.display = "block";
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao buscar dados do grupo.");
    } finally {
      btnBuscar.disabled = false;
      btnBuscar.innerText = "🔍 Buscar";
    }
  });

  // ---- PUBLICAR (usa imagem buscada automaticamente OU upload manual) ----
  formCadastro?.addEventListener("submit", (e) => {
    e.preventDefault();
    const arquivoImagem = document.getElementById("admImgGrupo").files[0];
    const imagemUrlAutomatica = document.getElementById("admImgGrupoUrl").value;

    btnPublicar.innerText = "ENVIANDO...";
    btnPublicar.disabled = true;

    const publicar = (urlImagemFinal) => {
      const novo = {
        nome: document.getElementById("admNomeGrupo").value,
        link: document.getElementById("admLinkGrupo").value,
        imagem: urlImagemFinal,
        tipo: document.getElementById("admSessaoGrupo").value
      };
      return fetch(`${FIREBASE_URL}/links.json`, { method: "POST", body: JSON.stringify(novo) })
        .then(res => res.json())
        .then(data => {
          localStorage.setItem("idParaAnimar", data.name);

          formCadastro.reset();
          document.getElementById("admImgGrupoUrl").value = "";
          const preview = document.getElementById("previewBuscaGrupo");
          if (preview) preview.style.display = "none";
          const modal = document.getElementById("modalAdmin");
          if (modal) modal.style.display = "none";

          carregarLinksDoFirebase();
        });
    };

    if (arquivoImagem) {
      const formData = new FormData();
      formData.append("image", arquivoImagem);
      fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData })
        .then(res => res.json())
        .then(r => publicar(r.data.url))
        .catch(err => {
          console.error(err);
          alert("Erro ao publicar: " + err);
        })
        .finally(() => {
          btnPublicar.innerText = "PUBLICAR NO SITE";
          btnPublicar.disabled = false;
        });
    } else if (imagemUrlAutomatica) {
      publicar(imagemUrlAutomatica)
        .catch(err => {
          console.error(err);
          alert("Erro ao publicar: " + err);
        })
        .finally(() => {
          btnPublicar.innerText = "PUBLICAR NO SITE";
          btnPublicar.disabled = false;
        });
    } else {
      alert("Cole o link e clique em Buscar, ou selecione uma imagem manualmente.");
      btnPublicar.innerText = "PUBLICAR NO SITE";
      btnPublicar.disabled = false;
    }
  });
}

function removerLinkDoFirebase(id) {
  if (confirm("Excluir este link?")) {
    fetch(`${FIREBASE_URL}/links/${id}.json`, { method: "DELETE" }).then(() => carregarLinksDoFirebase());
  }
}

function verificarStatusPainelAdm() {
  const logado = localStorage.getItem("adm_logado") === "true";
  document.querySelectorAll(".btn-deletar-card-adm").forEach(b => b.style.display = logado ? "block" : "none");
  const area = document.getElementById("areaRestritaAdm");
  const login = document.getElementById("formLoginAdm");
  if (area) area.style.display = logado ? "block" : "none";
  if (login) login.style.display = logado ? "none" : "block";
}

// ============================================================================
// 4.1 SISTEMA DE APROVAÇÃO DE GRUPOS PENDENTES (enviados por visitantes)
// ============================================================================
function criarPendenteHtml(id, item) {
  return `
    <div class="pendente-card" data-pendente-id="${id}">
      <img src="${item.imagem || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400'}"
        alt="${item.nome}" class="pendente-img"
        onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400';">
      <div class="pendente-info">
        <p class="pendente-nome" title="${item.nome}">${item.nome}</p>
        <a href="${item.link}" target="_blank" class="pendente-link">${item.link}</a>
        ${item.descricao ? `<p class="pendente-desc">${item.descricao}</p>` : ""}
      </div>
      <div class="pendente-acoes">
        <button class="btn-aprovar" onclick="aprovarPendente('${id}')">✅ Aprovar</button>
        <button class="btn-recusar" onclick="recusarPendente('${id}')">❌ Recusar</button>
      </div>
    </div>
  `;
}

function carregarPendentesAdm() {
  fetch(`${FIREBASE_URL}/pendentes.json`)
    .then(res => res.json())
    .then(dados => {
      const lista = document.getElementById("listaPendentesAdm");
      const contadorTitulo = document.getElementById("contadorPendentesTitulo");
      const badge = document.getElementById("badgePendentes");

      const ids = dados ? Object.keys(dados) : [];

      if (contadorTitulo) contadorTitulo.innerText = `(${ids.length})`;

      if (badge) {
        if (ids.length > 0) {
          badge.innerText = ids.length;
          badge.style.display = "inline-flex";
        } else {
          badge.style.display = "none";
        }
      }

      if (!lista) return;

      if (ids.length === 0) {
        lista.innerHTML = `<p class="pendentes-vazio" id="pendentesVazioMsg">Nenhum grupo pendente no momento.</p>`;
        return;
      }

      lista.innerHTML = ids.map(id => criarPendenteHtml(id, dados[id])).join("");
    })
    .catch(err => console.error("Erro ao carregar pendentes:", err));
}

async function aprovarPendente(id) {
  if (!confirm("Aprovar este grupo e publicá-lo em Grupos Parceiros?")) return;

  const card = document.querySelector(`[data-pendente-id="${id}"]`);
  if (card) card.style.opacity = "0.5";

  try {
    const res = await fetch(`${FIREBASE_URL}/pendentes/${id}.json`);
    const item = await res.json();
    if (!item) { alert("Este grupo pendente já não existe mais."); carregarPendentesAdm(); return; }

    let imagemFinal = item.imagem;
    if (imagemFinal) {
      try {
        const imgRes = await fetch(imagemFinal);
        const blob = await imgRes.blob();
        const formData = new FormData();
        formData.append("image", blob);
        const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: "POST",
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData?.data?.url) imagemFinal = uploadData.data.url;
      } catch (imgErr) {
        console.error("Erro ao reenviar imagem pro imgbb, mantendo original:", imgErr);
      }
    }

    const novoGrupo = {
      nome: item.nome,
      link: item.link,
      imagem: imagemFinal,
      tipo: "grupo-geral"
    };

    const publicarRes = await fetch(`${FIREBASE_URL}/links.json`, { method: "POST", body: JSON.stringify(novoGrupo) });
    const publicarData = await publicarRes.json();

    await fetch(`${FIREBASE_URL}/pendentes/${id}.json`, { method: "DELETE" });

    localStorage.setItem("idParaAnimar", publicarData.name);

    carregarLinksDoFirebase();
    carregarPendentesAdm();
  } catch (err) {
    console.error(err);
    alert("Erro ao aprovar o grupo. Tente novamente.");
    if (card) card.style.opacity = "1";
  }
}

function recusarPendente(id) {
  if (!confirm("Recusar e excluir este grupo pendente?")) return;
  fetch(`${FIREBASE_URL}/pendentes/${id}.json`, { method: "DELETE" })
    .then(() => carregarPendentesAdm())
    .catch(err => console.error("Erro ao recusar pendente:", err));
}

// ============================================================================
// 5. ENGINE DO SISTEMA DE COMPARTILHAMENTO
// ============================================================================
function inicializarSistemaCompartilhar() {
  const btnTrigger = document.getElementById('btnShareTrigger');
  const menu = document.getElementById('shareMenu');
  btnTrigger?.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('show'); });

  const url = window.location.href;
  document.getElementById('shareWA')?.setAttribute('href', `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`);
  document.getElementById('shareTG')?.setAttribute('href', `https://t.me/share/url?url=${encodeURIComponent(url)}`);

  document.getElementById('btnCopyLink')?.addEventListener('click', function() {
    navigator.clipboard.writeText(url).then(() => {
      const original = this.innerText;
      this.innerText = "✅ Copiado!";
      setTimeout(() => this.innerText = original, 1500);
    });
  });
}

document.addEventListener("click", (e) => {
  const menu = document.getElementById('shareMenu');
  const trigger = document.getElementById('btnShareTrigger');
  if (menu && menu.classList.contains('show') && !menu.contains(e.target) && e.target !== trigger) {
    menu.classList.remove('show');
  }
});

// ============================================================================
// 6. ENGINE DO CARROSSEL — SÓ SETAS + SCROLL NATIVO
// ============================================================================
let atualizadoresCarrossel = [];

function inicializarSetasCarrossel() {
  atualizadoresCarrossel = [];

  document.querySelectorAll(".carrossel-container").forEach((container) => {
    if (container.parentElement.classList.contains("carrossel-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "carrossel-wrapper";
    container.parentNode.insertBefore(wrapper, container);
    wrapper.appendChild(container);

    const btnEsq = document.createElement("button");
    btnEsq.type = "button";
    btnEsq.className = "seta-carrossel seta-esquerda";
    btnEsq.innerHTML = "&#10094;";
    btnEsq.setAttribute("aria-label", "Ver grupos anteriores");

    const btnDir = document.createElement("button");
    btnDir.type = "button";
    btnDir.className = "seta-carrossel seta-direita";
    btnDir.innerHTML = "&#10095;";
    btnDir.setAttribute("aria-label", "Ver mais grupos");

    wrapper.appendChild(btnEsq);
    wrapper.appendChild(btnDir);

    const QUANTIDADE_ROLAGEM = 480;

    btnEsq.addEventListener("click", () => {
      container.scrollBy({ left: -QUANTIDADE_ROLAGEM, behavior: "smooth" });
    });
    btnDir.addEventListener("click", () => {
      container.scrollBy({ left: QUANTIDADE_ROLAGEM, behavior: "smooth" });
    });

    container.querySelectorAll("img").forEach(img => img.setAttribute("draggable", "false"));

    const atualizarSetas = () => {
      const temOverflow = container.scrollWidth > container.clientWidth + 5;
      wrapper.classList.toggle("sem-overflow", !temOverflow);
      if (!temOverflow) return;

      const maxScroll = container.scrollWidth - container.clientWidth - 2;
      btnEsq.classList.toggle("seta-desabilitada", container.scrollLeft <= 0);
      btnDir.classList.toggle("seta-desabilitada", container.scrollLeft >= maxScroll);
    };

    container.addEventListener("scroll", atualizarSetas, { passive: true });
    window.addEventListener("resize", atualizarSetas);
    atualizadoresCarrossel.push(atualizarSetas);
  });
}

function atualizarTodosCarrosseis() {
  atualizadoresCarrossel.forEach((fn) => fn());
}

// ============================================================================
// 7. LÓGICA DO VERBAN (ROKKO) - CHECADOR DE BAN DO WHATSAPP
// ============================================================================
function inicializarVerbanRokko() {
  const btnVerificar = document.getElementById('btnVerificarBan');
  if (!btnVerificar) return;

  btnVerificar.addEventListener('click', async () => {
    const inputNumero = document.getElementById('verbanNumero');
    const divResultado = document.getElementById('verbanResultado');
    if (!inputNumero || !divResultado) return;

    const numero = inputNumero.value.trim().replace(/\D/g, '');

    if (numero.length < 10) {
      divResultado.className = 'verban-resultado res-banido';
      divResultado.innerText = 'Digite um número válido com DDD!';
      return;
    }

    divResultado.className = 'verban-resultado';
    divResultado.style.color = '#ccc';
    divResultado.innerText = 'Consultando no WhatsApp...';

    try {
      // Altere o endpoint abaixo conforme sua API/Instância Baileys ou Evolution API
      const response = await fetch(`/api/check-number?phone=55${numero}`);
      const data = await response.json();

      if (data.exists) {
        divResultado.className = 'verban-resultado res-ativo';
        divResultado.innerText = '✅ NÚMERO ATIVO / NORMAL';
      } else {
        divResultado.className = 'verban-resultado res-banido';
        divResultado.innerText = '❌ NÚMERO BANIDO OU NÃO REGISTRADO';
      }
    } catch (error) {
      divResultado.className = 'verban-resultado res-banido';
      divResultado.innerText = 'Erro ao conectar ao servidor de checagem.';
    }
  });
}

// ============================================================================
// INICIALIZAÇÃO GERAL
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  inicializarSetasCarrossel();
  carregarLinksDoFirebase();
  gerenciarEstatisticasReais();
  inicializarPlayerMusica();
  inicializarPainelControleAdm();
  inicializarSistemaCompartilhar();
  carregarPendentesAdm();
  inicializarVerbanRokko();
});