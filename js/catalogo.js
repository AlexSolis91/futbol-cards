import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "../js/firebase-config.js";
import { PAISES, POSICIONES, BONIF_VALS, ESTRATEGIAS_OF, ESTRATEGIAS_DEF,
         calcularRareza, rarezaCSS, buildCardHTML } from "../js/card-utils.js";
import { ajustarCantidadBloques, leerTalentos } from "../js/talentos-ui.js";
import { MAX_VERSIONES, renderVersiones, leerVersiones, leerVersionIndividual } from "../js/versiones-ui.js";

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const CANTIDAD_TALENTOS_FIJA = 5;

let todosLosJugadores = [];

// ---------- Toast ----------
const toast = document.getElementById("toast");
function mostrarToast(msg, esError = false) {
  toast.textContent = msg;
  toast.classList.toggle("error", esError);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

// ---------- Poblar selects ----------
function poblarSelects() {
  const fPos = document.getElementById("f-posicion");
  POSICIONES.forEach(p => {
    const o = document.createElement("option");
    o.value = p.value; o.textContent = p.label;
    fPos.appendChild(o);
  });

  const fNac = document.getElementById("f-nacion");
  PAISES.forEach(([nombre]) => {
    const o = document.createElement("option");
    o.value = nombre; o.textContent = nombre;
    fNac.appendChild(o);
  });

  const editNac = document.getElementById("edit-nacionalidad");
  PAISES.forEach(([nombre]) => {
    const o = document.createElement("option");
    o.value = nombre; o.textContent = nombre;
    editNac.appendChild(o);
  });

  [...ESTRATEGIAS_OF, ...ESTRATEGIAS_DEF].forEach(({ id }) => {
    const s = document.getElementById(`edit-${id}`);
    BONIF_VALS.forEach(v => {
      const o = document.createElement("option");
      o.value = v; o.textContent = v > 0 ? `+${v}` : `${v}`;
      if (v === 0) o.selected = true;
      s.appendChild(o);
    });
    actualizarColorBonif(s);
    s.addEventListener("change", () => actualizarColorBonif(s));
  });
}

function actualizarColorBonif(sel) {
  const v = parseInt(sel.value);
  sel.classList.remove("positivo","negativo","neutro");
  sel.classList.add(v > 0 ? "positivo" : v < 0 ? "negativo" : "neutro");
}

poblarSelects();

// ---------- Versiones (modal de edición) ----------
const editVersionesContainer = document.getElementById("edit-versiones-container");

editVersionesContainer.addEventListener("input", e => {
  const block = e.target.closest(".version-block");
  if (!block) return;
  const idx = Number(block.dataset.index);
  if (idx === editPreviewVersionIndex) actualizarEditPreview();
});

// ---------- Talentos (modal de edición, siempre 5 fijos) ----------
const editTalentosContainer = document.getElementById("edit-talentos-container");

// ---------- Preview con flechas (modal de edición) ----------
let editPreviewVersionIndex = 0;

const editPreviewCard       = document.getElementById("edit-preview-card");
const editPreviewRating     = document.getElementById("edit-preview-rating");
const editPreviewPhoto      = document.getElementById("edit-preview-photo");
const editPreviewName       = document.getElementById("edit-preview-name");
const editPreviewPosition   = document.getElementById("edit-preview-position");
const editPreviewRareza     = document.getElementById("edit-preview-rareza");
const editPreviewVersionLbl = document.getElementById("edit-preview-version-label");
const editBtnPrev           = document.getElementById("edit-preview-prev");
const editBtnNext           = document.getElementById("edit-preview-next");

function actualizarEditPreview() {
  const nombreGlobal = document.getElementById("edit-nombre").value || "Nombre del jugador";
  const v = leerVersionIndividual(editVersionesContainer, editPreviewVersionIndex) || {};

  const etiqueta = v.etiqueta ? ` (${v.etiqueta})` : "";
  editPreviewVersionLbl.textContent = `Versión ${editPreviewVersionIndex + 1}${etiqueta}`;

  const posicion   = v.posicionNatural || "POS";
  const valoracion = v.valoracionNatural || "--";
  const rareza     = calcularRareza(v.valoracionNatural);

  editPreviewName.textContent     = nombreGlobal;
  editPreviewPosition.textContent = posicion;
  editPreviewRating.textContent   = valoracion;
  editPreviewRareza.textContent   = rareza;
  editPreviewCard.className       = `player-card ${rarezaCSS(rareza)}`;

  if (v.imagenURL) {
    editPreviewPhoto.outerHTML = `<img id="edit-preview-photo" class="card-img" src="${v.imagenURL}" alt="${nombreGlobal}" onerror="this.outerHTML='<div class=card-img-placeholder id=edit-preview-photo>Sin foto</div>'" />`;
  } else {
    const existing = document.getElementById("edit-preview-photo");
    if (existing.tagName === "IMG") {
      existing.outerHTML = `<div class="card-img-placeholder" id="edit-preview-photo">Sin foto</div>`;
    }
  }

  editBtnPrev.disabled = editPreviewVersionIndex === 0;
  editBtnNext.disabled = editPreviewVersionIndex === MAX_VERSIONES - 1;
}

editBtnPrev.addEventListener("click", () => {
  if (editPreviewVersionIndex > 0) { editPreviewVersionIndex--; actualizarEditPreview(); }
});
editBtnNext.addEventListener("click", () => {
  if (editPreviewVersionIndex < MAX_VERSIONES - 1) { editPreviewVersionIndex++; actualizarEditPreview(); }
});
document.getElementById("edit-nombre").addEventListener("input", actualizarEditPreview);

// ---------- Login ----------
document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth,
      document.getElementById("login-email").value,
      document.getElementById("login-pass").value);
  } catch {
    document.getElementById("login-error").textContent = "Correo o contraseña incorrectos.";
  }
});
document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    cargarJugadores();
  } else {
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
  }
});

// ---------- Cargar y renderizar ----------
async function cargarJugadores() {
  const grid = document.getElementById("cards-grid");
  grid.innerHTML = "<p style='color:var(--ink-muted)'>Cargando...</p>";
  try {
    const snap = await getDocs(collection(db, "jugadores_global"));
    todosLosJugadores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Orden descendente por la mejor versión de cada jugador
    todosLosJugadores.sort((a, b) => {
      const va = mejorVersion(a)?.valoracionNatural || 0;
      const vb = mejorVersion(b)?.valoracionNatural || 0;
      return vb - va;
    });
    aplicarFiltros();
  } catch(err) {
    console.error(err);
    grid.innerHTML = "<p style='color:var(--danger)'>Error al cargar.</p>";
  }
}

function mejorVersion(jugador) {
  const versiones = (jugador.versiones || []).filter(v => v && v.valoracionNatural);
  if (versiones.length === 0) return null;
  return versiones.reduce((best, v) => v.valoracionNatural > best.valoracionNatural ? v : best, versiones[0]);
}

function jugadorTieneVersionConPosicion(jugador, pos) {
  return (jugador.versiones || []).some(v => v && (
    v.posicionNatural === pos || v.posicionSecundaria === pos || v.posicionTerciaria === pos
  ));
}

function jugadorTieneVersionConRareza(jugador, rareza) {
  return (jugador.versiones || []).some(v => v && v.valoracionNatural && calcularRareza(v.valoracionNatural) === rareza);
}

function aplicarFiltros() {
  const pos    = document.getElementById("f-posicion").value;
  const nacion = document.getElementById("f-nacion").value;
  const rareza = document.getElementById("f-rareza").value;
  const buscar = document.getElementById("f-buscar").value.toLowerCase().trim();

  const filtrados = todosLosJugadores.filter(j => {
    if (pos    && !jugadorTieneVersionConPosicion(j, pos)) return false;
    if (nacion && j.nacionalidad !== nacion) return false;
    if (rareza && !jugadorTieneVersionConRareza(j, rareza)) return false;
    if (buscar && !j.nombre.toLowerCase().includes(buscar)) return false;
    return true;
  });

  renderGrid(filtrados);
}

function renderGrid(jugadores) {
  const grid = document.getElementById("cards-grid");
  document.getElementById("cards-count").textContent =
    `${jugadores.length} jugador${jugadores.length !== 1 ? "es" : ""} encontrado${jugadores.length !== 1 ? "s" : ""}`;

  if (jugadores.length === 0) {
    grid.innerHTML = "<p style='color:var(--ink-muted)'>No hay jugadores con esos filtros.</p>";
    return;
  }

  grid.innerHTML = jugadores.map(j => {
    const v = mejorVersion(j);
    return buildCardHTML({
      id: j.id,
      nombre: j.nombre,
      imagenURL: v ? v.imagenURL : null,
      posicionNatural: v ? v.posicionNatural : "",
      valoracionNatural: v ? v.valoracionNatural : null,
    });
  }).join("");

  grid.querySelectorAll(".player-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const jugador = todosLosJugadores.find(j => j.id === id);
      if (jugador) abrirModal(jugador);
    });
  });
}

// ---------- Filtros ----------
["f-posicion","f-nacion","f-rareza"].forEach(id =>
  document.getElementById(id).addEventListener("change", aplicarFiltros)
);
document.getElementById("f-buscar").addEventListener("input", aplicarFiltros);
document.getElementById("btn-limpiar").addEventListener("click", () => {
  document.getElementById("f-posicion").value = "";
  document.getElementById("f-nacion").value   = "";
  document.getElementById("f-rareza").value   = "";
  document.getElementById("f-buscar").value   = "";
  aplicarFiltros();
});

// ---------- Modal ----------
function abrirModal(j) {
  document.getElementById("edit-id").value           = j.id;
  document.getElementById("edit-nombre").value       = j.nombre;
  document.getElementById("edit-nacionalidad").value = j.nacionalidad;

  // Versiones
  renderVersiones(editVersionesContainer, j.versiones || []);

  // Preview: arranca en la versión de mayor valoración
  const versiones = j.versiones || [];
  let mejorIdx = 0, mejorVal = -1;
  versiones.forEach((v, i) => {
    if (v && v.valoracionNatural > mejorVal) { mejorVal = v.valoracionNatural; mejorIdx = i; }
  });
  editPreviewVersionIndex = mejorIdx;
  actualizarEditPreview();

  // Estrategias
  const of  = j.estrategiasOfensivas  || {};
  const def = j.estrategiasDefensivas || {};
  [
    ["edit-bof_contraataque", of.contraataque],
    ["edit-bof_posesion",     of.posesion],
    ["edit-bof_presion",      of.presionAlta],
    ["edit-bof_directo",      of.juegoDirecto],
    ["edit-bdef_bloquebajo",  def.bloqueBajo],
    ["edit-bdef_bloquealto",  def.bloqueAlto],
    ["edit-bdef_zona",        def.zona],
    ["edit-bdef_marcaje",     def.marcajeHombre],
  ].forEach(([id, val]) => {
    const s = document.getElementById(id);
    s.value = val ?? 0;
    actualizarColorBonif(s);
  });

  // Talentos: siempre 5, precargados
  ajustarCantidadBloques(editTalentosContainer, CANTIDAD_TALENTOS_FIJA, j.talentos || []);

  document.getElementById("edit-error").textContent = "";
  document.getElementById("modal-overlay").classList.remove("hidden");
}

document.getElementById("modal-close").addEventListener("click", cerrarModal);
document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) cerrarModal();
});
function cerrarModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  editTalentosContainer.innerHTML = "";
}

// ---------- Guardar cambios ----------
document.getElementById("form-editar").addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("edit-id").value;

  const datos = {
    nombre:       document.getElementById("edit-nombre").value.trim(),
    nacionalidad: document.getElementById("edit-nacionalidad").value,
    versiones:    leerVersiones(editVersionesContainer),
    estrategiasOfensivas: {
      contraataque: Number(document.getElementById("edit-bof_contraataque").value),
      posesion:     Number(document.getElementById("edit-bof_posesion").value),
      presionAlta:  Number(document.getElementById("edit-bof_presion").value),
      juegoDirecto: Number(document.getElementById("edit-bof_directo").value),
    },
    estrategiasDefensivas: {
      bloqueBajo:    Number(document.getElementById("edit-bdef_bloquebajo").value),
      bloqueAlto:    Number(document.getElementById("edit-bdef_bloquealto").value),
      zona:          Number(document.getElementById("edit-bdef_zona").value),
      marcajeHombre: Number(document.getElementById("edit-bdef_marcaje").value),
    },
    talentos: leerTalentos(editTalentosContainer),
  };

  try {
    await updateDoc(doc(db,"jugadores_global", id), datos);
    const idx = todosLosJugadores.findIndex(j => j.id === id);
    if (idx >= 0) todosLosJugadores[idx] = { id, ...datos };
    cerrarModal();
    aplicarFiltros();
    mostrarToast(`${datos.nombre} actualizado`);
  } catch(err) {
    console.error(err);
    document.getElementById("edit-error").textContent = "Error al guardar.";
    mostrarToast("Error al guardar", true);
  }
});

// ---------- Eliminar ----------
document.getElementById("btn-eliminar").addEventListener("click", async () => {
  const id = document.getElementById("edit-id").value;
  const nombre = document.getElementById("edit-nombre").value;
  if (!confirm(`¿Eliminar a ${nombre} de la base de datos?`)) return;
  try {
    await deleteDoc(doc(db,"jugadores_global", id));
    todosLosJugadores = todosLosJugadores.filter(j => j.id !== id);
    cerrarModal();
    aplicarFiltros();
    mostrarToast(`${nombre} eliminado`);
  } catch(err) {
    console.error(err);
    mostrarToast("Error al eliminar", true);
  }
});
