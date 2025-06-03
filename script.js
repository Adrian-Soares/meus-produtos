// script.js

/* ========================================================================
   1. LÓGICA DO APLICATIVO (CRUD, tabela e notificações)
   ======================================================================== */

// Chave usada no localStorage para armazenar a lista de produtos
const STORAGE_KEY = "produtos-loja";

// Lê e retorna a lista de produtos (array) do localStorage
function carregarProdutos() {
  const dados = localStorage.getItem(STORAGE_KEY);
  return dados ? JSON.parse(dados) : [];
}

// Grava (array) de volta no localStorage
function salvarProdutos(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

// Gera ID único simples (timestamp)
function gerarId() {
  return Date.now().toString();
}

// Formata uma data ISO “YYYY-MM-DD” para “DD/MM/AAAA”
function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Retorna quantos dias faltam (pode ser negativo se já venceu)
function diasParaVencimento(dataISO) {
  const hoje = new Date();
  const dataVence = new Date(dataISO + "T00:00:00");
  const diffMs = dataVence - hoje;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Retorna “Vencido”, “PertoDeVencer” (≤ 7 dias) ou “OK”
function calcularStatus(dataISO) {
  const dias = diasParaVencimento(dataISO);
  if (dias < 0) return "Vencido";
  if (dias <= 7) return "PertoDeVencer";
  return "OK";
}

// Exibe notificação de desktop (se o usuário já deu permissão)
// Se ainda não pediu, solicita permissão e, se aceita, dispara a notificação
function notificar(titulo, corpo) {
  if (!("Notification" in window)) return; // se o navegador não suporta
  if (Notification.permission === "granted") {
    new Notification(titulo, { body: corpo });
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then(perm => {
      if (perm === "granted") {
        new Notification(titulo, { body: corpo });
      }
    });
  }
}

// Marca, em memória, que determinado produto já teve notificação disparada
function marcarComoNotificado(lista, id) {
  return lista.map(item => {
    if (item.id === id) {
      return { ...item, notificado: true };
    }
    return item;
  });
}

/**
 * Monta (ou atualiza) a tabela de produtos na página, destacando cores
 * e disparando notificação para quem está “PertoDeVencer” e ainda não foi notificado.
 */
function montarTabela() {
  let lista = carregarProdutos();
  const tbody = document.querySelector("#tabela-produtos tbody");
  tbody.innerHTML = ""; // limpa antes de preencher

  let contVencendo = 0;
  let contVencidos = 0;

  lista.forEach(p => {
    const status = calcularStatus(p.dataValidade);
    if (status === "PertoDeVencer") contVencendo++;
    if (status === "Vencido") contVencidos++;

    // Cria a linha da tabela
    const tr = document.createElement("tr");
    tr.classList.add(status);
    tr.innerHTML = `
      <td>${p.nome}</td>
      <td>${p.quantidade}</td>
      <td>${formatarData(p.dataValidade)}</td>
      <td>${status === "PertoDeVencer" ? "Perto de vencer" : status}</td>
      <td>
        <button class="btn-editar" data-id="${p.id}">✏️</button>
        <button class="btn-excluir" data-id="${p.id}">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);

    // Se estiver “PertoDeVencer” e ainda não notificado, dispara notificação e marca
    if (status === "PertoDeVencer" && !p.notificado) {
      notificar(
        "🐱 Produto perto do vencimento",
        `O produto "${p.nome}" vence em ${formatarData(p.dataValidade)}.`
      );
      lista = marcarComoNotificado(lista, p.id);
    }
  });

  // Atualiza contadores no cabeçalho
  document.getElementById("avisoVencendo").textContent = contVencendo;
  document.getElementById("avisoVencido").textContent = contVencidos;

  // Salva a lista (para registrar quem já foi notificado)
  salvarProdutos(lista);

  // Configura botões de excluir e editar
  document.querySelectorAll(".btn-excluir").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (confirm("Deseja realmente excluir este produto?")) {
        const novaLista = carregarProdutos().filter(item => item.id !== id);
        salvarProdutos(novaLista);
        montarTabela();
      }
    });
  });

  document.querySelectorAll(".btn-editar").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      window.location.href = `novo.html?id=${id}`;
    });
  });
}

// Configura o botão “+ Novo Produto” para redirecionar à página de cadastro
function configurarBotaoNovo() {
  const btnNovo = document.getElementById("btn-novo");
  if (btnNovo) {
    btnNovo.addEventListener("click", () => {
      window.location.href = "novo.html";
    });
  }
}

/* ========================================================================
   2. LÓGICA DO INTRO OVERLAY (SPLASH SCREEN)
   ======================================================================== */

/**
 * Controla a sequência de animações do overlay de introdução:
 *  - Executa animação de escala do gatinho (2s)
 *  - Exibe legenda (fade-in após 1.2s)
 *  - Aguarda 2.5s no total, então aciona fade-out do overlay (0.8s)
 *  - Ao fim do fade-out, esconde o overlay e inicia a aplicação
 */
function controlarIntro() {
  const overlay = document.getElementById("intro-overlay");
  if (!overlay) {
    // Se não houver overlay (por segurança), inicia direto
    iniciarApp();
    return;
  }

  // Após 2.5s (tempo do gatinho + legenda), adiciona classe 'fade-out'
  setTimeout(() => {
    overlay.classList.add("fade-out");
  }, 2500);

  // Quando a animação 'overlayFadeOut' terminar, esconde e chama iniciarApp()
  overlay.addEventListener("animationend", (e) => {
    if (e.animationName === "overlayFadeOut") {
      overlay.style.display = "none";
      iniciarApp();
    }
  });
}

/**
 * Função que centraliza a inicialização do aplicativo:
 *  - Monta tabela
 *  - Solicita permissão de notificações
 *  - Configura checagem periódica (setInterval)
 *  - Configura botão “+ Novo Produto”
 */
function iniciarApp() {
  montarTabela();

  // Solicita permissão de Notification se ainda não tiver sido negada
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  // Agendamos nova checagem a cada 30 minutos (30 × 60 × 1000 ms)
  setInterval(() => {
    montarTabela();
  }, 30 * 60 * 1000);

  // Configura o botão de adicionar novo
  configurarBotaoNovo();
}

/* ========================================================================
   3. PONTO DE ENTRADA
   ======================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  controlarIntro();
});
