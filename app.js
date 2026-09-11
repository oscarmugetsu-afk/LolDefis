import { firebaseConfig, challengeId } from "./firebase-config.js";
import { CHAMPION_ROLES } from "./champion-roles.js";

const FALLBACK_DDRAGON_VERSION = "16.17.1";
const STORAGE_KEY = "lol-challenge-state-v1";
const IDENTITY_KEY = "lol-challenge-identity";

const state = {
  champions: [],
  progress: {},
  priorPlayed: {},
  players: { p1: "Joueur 1", p2: "Joueur 2" },
  filters: { search: "", role: "ALL", status: "ALL", sort: "AZ" },
  storageMode: "loading",
  saveChampion: null,
  savePriorPlayed: null,
  savePlayers: null
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const els = {
  grid: $("#championGrid"),
  template: $("#championCardTemplate"),
  empty: $("#emptyState"),
  search: $("#searchInput"),
  status: $("#statusFilter"),
  sort: $("#sortSelect"),
  visibleCount: $("#visibleCount"),
  settings: $("#settingsDialog"),
  settingsButton: $("#settingsButton"),
  saveSettings: $("#saveSettings"),
  p1Input: $("#player1Input"),
  p2Input: $("#player2Input"),
  syncBadge: $("#syncBadge"),
  syncText: $("#syncText"),
  storageNotice: $("#storageNotice")
};

function firebaseConfigured() {
  return firebaseConfig?.apiKey &&
    !Object.values(firebaseConfig).some(v => typeof v === "string" && v.includes("YOUR_"));
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.progress = saved.progress || {};
    state.priorPlayed = saved.priorPlayed || {};
    state.players = { ...state.players, ...(saved.players || {}) };
  } catch (error) {
    console.warn("Impossible de lire le stockage local", error);
  }
}

function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    progress: state.progress,
    priorPlayed: state.priorPlayed,
    players: state.players
  }));
}

function setStorageStatus(mode, text) {
  state.storageMode = mode;
  els.syncBadge.className = `sync-badge sync-badge--${mode}`;
  els.syncText.textContent = text;

  if (mode === "online") {
    els.storageNotice.classList.add("is-online");
    els.storageNotice.textContent = "Firebase est connecté : les changements sont synchronisés en temps réel entre vos appareils.";
  } else {
    els.storageNotice.classList.remove("is-online");
    els.storageNotice.textContent = "Le site fonctionne en stockage local sur cet appareil. Configure Firebase pour synchroniser la progression entre vos deux appareils.";
  }
}

async function setupStorage() {
  readLocalState();

  if (!firebaseConfigured()) {
    state.saveChampion = async (championId, player, checked) => {
      state.progress[championId] ||= {};
      state.progress[championId][player] = checked;
      persistLocal();
    };
    state.savePriorPlayed = async (championId, player, checked) => {
      state.priorPlayed[championId] ||= {};
      state.priorPlayed[championId][player] = checked;
      persistLocal();
    };
    state.savePlayers = async () => persistLocal();
    setStorageStatus("local", "Mode local");
    return;
  }

  try {
    const [
      { initializeApp },
      { getAuth, signInAnonymously },
      { getFirestore, doc, setDoc, updateDoc, onSnapshot }
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js")
    ]);

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    await signInAnonymously(auth);

    const db = getFirestore(app);
    const challengeRef = doc(db, "challenges", challengeId);

    await setDoc(challengeRef, {
      players: state.players,
      progress: state.progress,
      priorPlayed: state.priorPlayed
    }, { merge: true });

    state.saveChampion = async (championId, player, checked) => {
      // Les IDs Riot n'ont pas de point, donc ce chemin Firestore est sûr.
      await updateDoc(challengeRef, {
        [`progress.${championId}.${player}`]: checked
      });
    };

    state.savePriorPlayed = async (championId, player, checked) => {
      await updateDoc(challengeRef, {
        [`priorPlayed.${championId}.${player}`]: checked
      });
    };

    state.savePlayers = async () => {
      await updateDoc(challengeRef, { players: state.players });
    };

    onSnapshot(challengeRef, snapshot => {
      const data = snapshot.data();
      if (!data) return;
      state.players = { ...state.players, ...(data.players || {}) };
      state.progress = data.progress || {};
      state.priorPlayed = data.priorPlayed || {};
      renderAll();
    }, error => {
      console.error(error);
      setStorageStatus("error", "Erreur de synchro");
    });

    setStorageStatus("online", "Synchronisé");
  } catch (error) {
    console.error("Firebase indisponible, bascule en mode local :", error);
    state.saveChampion = async (championId, player, checked) => {
      state.progress[championId] ||= {};
      state.progress[championId][player] = checked;
      persistLocal();
    };
    state.savePriorPlayed = async (championId, player, checked) => {
      state.priorPlayed[championId] ||= {};
      state.priorPlayed[championId][player] = checked;
      persistLocal();
    };
    state.savePlayers = async () => persistLocal();
    setStorageStatus("error", "Firebase indisponible");
  }
}

async function loadChampions() {
  let version = FALLBACK_DDRAGON_VERSION;

  try {
    const versionsResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    if (versionsResponse.ok) {
      const versions = await versionsResponse.json();
      version = versions[0] || version;
    }
  } catch {
    // Le fallback reste utilisé.
  }

  try {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`);
    if (!response.ok) throw new Error("Data Dragon indisponible");

    const payload = await response.json();
    state.champions = Object.values(payload.data).map(champion => ({
      id: champion.id,
      name: champion.name,
      image: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.image.full}`,
      roles: CHAMPION_ROLES[champion.id] || []
    }));

    state.champions.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  } catch (error) {
    console.error(error);
    els.grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div>!</div>
        <h2>Impossible de charger les champions</h2>
        <p>Vérifie ta connexion Internet puis recharge la page.</p>
      </div>`;
  }
}

function progressFor(id) {
  return {
    p1: Boolean(state.progress[id]?.p1),
    p2: Boolean(state.progress[id]?.p2)
  };
}

function priorPlayedFor(id) {
  return {
    p1: Boolean(state.priorPlayed[id]?.p1),
    p2: Boolean(state.priorPlayed[id]?.p2)
  };
}

function filteredChampions() {
  const needle = state.filters.search.trim().toLocaleLowerCase("fr");

  const list = state.champions.filter(champion => {
    if (needle && !champion.name.toLocaleLowerCase("fr").includes(needle)) return false;
    if (state.filters.role !== "ALL" && !champion.roles.includes(state.filters.role)) return false;

    const p = progressFor(champion.id);
    const completedCount = Number(p.p1) + Number(p.p2);

    switch (state.filters.status) {
      case "NONE": return completedCount === 0;
      case "P1_MISSING": return !p.p1;
      case "P2_MISSING": return !p.p2;
      case "ONE_DONE": return completedCount === 1;
      case "BOTH": return completedCount === 2;
      case "NEVER_P1": return !priorPlayedFor(champion.id).p1;
      case "NEVER_P2": return !priorPlayedFor(champion.id).p2;
      case "NEVER_BOTH": {
        const prior = priorPlayedFor(champion.id);
        return !prior.p1 && !prior.p2;
      }
      default: return true;
    }
  });

  return list.sort((a, b) => {
    const aP = progressFor(a.id);
    const bP = progressFor(b.id);
    const aScore = Number(aP.p1) + Number(aP.p2);
    const bScore = Number(bP.p1) + Number(bP.p2);

    if (state.filters.sort === "ZA") return b.name.localeCompare(a.name, "fr");
    if (state.filters.sort === "PROGRESS_ASC") return aScore - bScore || a.name.localeCompare(b.name, "fr");
    if (state.filters.sort === "PROGRESS_DESC") return bScore - aScore || a.name.localeCompare(b.name, "fr");
    if (state.filters.sort === "NEVER_FIRST") {
      const aPrior = priorPlayedFor(a.id);
      const bPrior = priorPlayedFor(b.id);
      const aPriorScore = Number(aPrior.p1) + Number(aPrior.p2);
      const bPriorScore = Number(bPrior.p1) + Number(bPrior.p2);
      return aPriorScore - bPriorScore || a.name.localeCompare(b.name, "fr");
    }
    return a.name.localeCompare(b.name, "fr");
  });
}

function renderGrid() {
  if (!state.champions.length) return;

  const champions = filteredChampions();
  const fragment = document.createDocumentFragment();

  champions.forEach(champion => {
    const node = els.template.content.cloneNode(true);
    const card = $(".champion-card", node);
    const img = $(".champion-card__image", node);
    const p = progressFor(champion.id);
    const score = Number(p.p1) + Number(p.p2);

    card.dataset.id = champion.id;
    card.classList.toggle("has-progress", score > 0);
    card.classList.toggle("is-complete", score === 2);

    img.src = champion.image;
    img.alt = champion.name;
    img.addEventListener("error", () => {
      img.removeAttribute("src");
      img.alt = `${champion.name} — image indisponible`;
    }, { once: true });

    $(".champion-card__name", node).textContent = champion.name;
    $(".champion-card__score", node).textContent = `${score}/2`;

    const rolesWrap = $(".champion-card__roles", node);
    (champion.roles.length ? champion.roles : ["AUTRE"]).forEach(role => {
      const pill = document.createElement("span");
      pill.className = "role-pill";
      pill.textContent = role === "SUPPORT" ? "SUPP" : role;
      rolesWrap.appendChild(pill);
    });

    const p1Button = $('.player-check[data-player="p1"]', node);
    const p2Button = $('.player-check[data-player="p2"]', node);
    p1Button.classList.toggle("is-checked", p.p1);
    p2Button.classList.toggle("is-checked", p.p2);
    $(".player-check__name", p1Button).textContent = state.players.p1;
    $(".player-check__name", p2Button).textContent = state.players.p2;

    const prior = priorPlayedFor(champion.id);
    const priorP1 = $('.prior-check[data-player="p1"]', node);
    const priorP2 = $('.prior-check[data-player="p2"]', node);
    priorP1.classList.toggle("is-checked", prior.p1);
    priorP2.classList.toggle("is-checked", prior.p2);
    $(".prior-check__name", priorP1).textContent = state.players.p1;
    $(".prior-check__name", priorP2).textContent = state.players.p2;

    fragment.appendChild(node);
  });

  els.grid.replaceChildren(fragment);
  els.visibleCount.textContent = champions.length;
  els.empty.hidden = champions.length !== 0;
}

function renderStats() {
  const total = state.champions.length;
  const p1 = state.champions.filter(c => progressFor(c.id).p1).length;
  const p2 = state.champions.filter(c => progressFor(c.id).p2).length;
  const both = state.champions.filter(c => {
    const p = progressFor(c.id);
    return p.p1 && p.p2;
  }).length;

  $("#championTotal").textContent = total;
  $$(".totalMirror").forEach(el => el.textContent = total);
  $("#globalCompleted").textContent = both;

  $("#player1Name").textContent = state.players.p1;
  $("#player2Name").textContent = state.players.p2;
  $("#player1Count").textContent = p1;
  $("#player2Count").textContent = p2;

  const p1Pct = total ? Math.round(p1 / total * 100) : 0;
  const p2Pct = total ? Math.round(p2 / total * 100) : 0;
  $("#player1Percent").textContent = `${p1Pct}%`;
  $("#player2Percent").textContent = `${p2Pct}%`;
  $("#player1Remaining").textContent = `${Math.max(total - p1, 0)} restants`;
  $("#player2Remaining").textContent = `${Math.max(total - p2, 0)} restants`;
  $("#player1Bar").style.width = `${p1Pct}%`;
  $("#player2Bar").style.width = `${p2Pct}%`;
}

function renderSettings() {
  els.p1Input.value = state.players.p1;
  els.p2Input.value = state.players.p2;
  $("#identityP1").textContent = state.players.p1;
  $("#identityP2").textContent = state.players.p2;

  const identity = localStorage.getItem(IDENTITY_KEY) || "p1";
  const radio = $(`input[name="identity"][value="${identity}"]`);
  if (radio) radio.checked = true;
}

function renderAll() {
  renderStats();
  renderGrid();
  renderSettings();
}

async function toggleChampion(championId, player, button) {
  const previous = Boolean(state.progress[championId]?.[player]);
  state.progress[championId] ||= {};
  state.progress[championId][player] = !previous;

  // Réponse visuelle immédiate.
  renderAll();

  try {
    await state.saveChampion?.(championId, player, !previous);
  } catch (error) {
    console.error(error);
    // On annule visuellement si l'écriture distante a échoué.
    state.progress[championId][player] = previous;
    renderAll();
    setStorageStatus("error", "Écriture impossible");
  }
}

async function togglePriorPlayed(championId, player) {
  const previous = Boolean(state.priorPlayed[championId]?.[player]);
  state.priorPlayed[championId] ||= {};
  state.priorPlayed[championId][player] = !previous;
  renderAll();

  try {
    await state.savePriorPlayed?.(championId, player, !previous);
  } catch (error) {
    console.error(error);
    state.priorPlayed[championId][player] = previous;
    renderAll();
    setStorageStatus("error", "Écriture impossible");
  }
}

function resetFilters() {
  state.filters = { search: "", role: "ALL", status: "ALL", sort: "AZ" };
  els.search.value = "";
  els.status.value = "ALL";
  els.sort.value = "AZ";
  $$("#roleFilters .filter-button").forEach(b => b.classList.toggle("is-active", b.dataset.role === "ALL"));
  renderGrid();
}

function bindEvents() {
  els.search.addEventListener("input", e => {
    state.filters.search = e.target.value;
    renderGrid();
  });

  $("#roleFilters").addEventListener("click", e => {
    const button = e.target.closest(".filter-button");
    if (!button) return;
    state.filters.role = button.dataset.role;
    $$("#roleFilters .filter-button").forEach(b => b.classList.toggle("is-active", b === button));
    renderGrid();
  });

  els.status.addEventListener("change", e => {
    state.filters.status = e.target.value;
    renderGrid();
  });

  els.sort.addEventListener("change", e => {
    state.filters.sort = e.target.value;
    renderGrid();
  });

  els.grid.addEventListener("click", e => {
    const card = e.target.closest(".champion-card");
    if (!card) return;

    const priorButton = e.target.closest(".prior-check");
    if (priorButton) {
      togglePriorPlayed(card.dataset.id, priorButton.dataset.player);
      return;
    }

    const button = e.target.closest(".player-check");
    if (!button) return;
    toggleChampion(card.dataset.id, button.dataset.player, button);
  });

  $("#resetFilters").addEventListener("click", resetFilters);
  $("#emptyReset").addEventListener("click", resetFilters);

  els.settingsButton.addEventListener("click", () => {
    renderSettings();
    els.settings.showModal();
  });

  els.saveSettings.addEventListener("click", async () => {
    const p1 = els.p1Input.value.trim() || "Joueur 1";
    const p2 = els.p2Input.value.trim() || "Joueur 2";
    state.players = { p1, p2 };

    const identity = $('input[name="identity"]:checked')?.value || "p1";
    localStorage.setItem(IDENTITY_KEY, identity);

    try {
      await state.savePlayers?.();
      renderAll();
      els.settings.close();
    } catch (error) {
      console.error(error);
      setStorageStatus("error", "Sauvegarde impossible");
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
      e.preventDefault();
      els.search.focus();
    }
    if (e.key === "Escape" && els.settings.open) els.settings.close();
  });

  // Double clic sur l'image = coche rapidement "mon" joueur.
  els.grid.addEventListener("dblclick", e => {
    const card = e.target.closest(".champion-card");
    if (!card || e.target.closest(".player-check")) return;
    const identity = localStorage.getItem(IDENTITY_KEY) || "p1";
    toggleChampion(card.dataset.id, identity);
  });
}

async function boot() {
  bindEvents();
  await setupStorage();
  await loadChampions();
  renderAll();
}

boot();
