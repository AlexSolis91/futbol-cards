import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, orderBy, query }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "../js/firebase-config.js";
import { PAISES, POSICIONES, RAREZAS, BONIF_VALS, ESTRATEGIAS_OF, ESTRATEGIAS_DEF,
         flagEmoji, paisACodigo, rarezaCSS, buildCardHTML } from "../js/card-utils.js";
import { RAREZA_TALENTOS, renderTalentos, ajustarCantidadBloques, leerTalentos } from "../js/talentos-ui.js";

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let todosLosJugadores = [];

// ---------- Toast ----------
const toast = document.getElementById("toast");
function mostrarToast(msg, esError = false) {
  toast.textContent = msg;
  toast.classList.toggle("error", esError);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

// ---------- Poblar filtros y selects ----------
function poblarSelects() {
  // Filtro posición
  const fPos = document.getElementById("f-posicion");
  POSICIONES.forEach(p => {
    const o = document.createElement("option");
    o.value = p.value; o.textContent = p.label;
    fPos.appendChild(o);
  });

  // Filtro nación
  const fNac = document.getElementById("f-nacion");
  PAISES.forEach(([nombre]) => {
    const o = document.createElement("option");
    o.value = nombre; o.textContent = nombre;
    fNac.appendChild(o);
  });

  // Edit selects de nación
  const editNac = document.getElementById("edit-nacionalidad");
  PAISES.forEach(([nombre]) => {
    const o = document.createElement("option");
    o.value = nombre; o.textContent = nombre;
    editNac.appendChild(o);
  });

  // Edit selects de posición
  ["edit-posNat","edit-posSec","edit-posTer"].forEach(id => {
    const s = document.getElementById(id);
    POSICIONES.forEach(p => {
      const o = document.createElement("option");
      o.value = p.value; o.textContent = p.label;
      s.appendChild(o);
    });
  });

  // Bonif selects en modal
  [...ESTRATEGIAS_OF, ...ESTRATEGIAS_DEF].forEach(({ id, key }) => {
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

// Toggle valoraciones secundarias en modal
function enlazarToggle(selectId, inputId) {
  const s = document.getElementById(selectId);
  const i = document.getElementById(inputId);
  s.addEventListener("change", () => {
    i.disabled = s.value === "";
    if (s.value === "") i.value = "";
  });
}
enlazarToggle("edit-posSec","edit-valSec");
enlazarToggle("edit-posTer","edit-valTer");

poblarSelects();

// ---------- Talentos (modal de edición) ----------
const editTalentosContainer = document.getElementById("edit-talentos-container");
document.getElementById("edit-rareza").addEventListener("change", () => {
  const rareza = document.getElementById("edit-rareza").value;
  const cantidad = RAREZA_TALENTOS[rareza] || 1;
  ajustarCantidadBloques(editTalentosContainer, cantidad);
});

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
    const q = query(collection(db, "jugadores_global"), orderBy("valoracionNatural","desc"));
    const snap = await getDocs(q);
    todosLosJugadores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    aplicarFiltros();
  } catch(err) {
    console.error(err);
    grid.innerHTML = "<p style='color:var(--danger)'>Error al cargar.</p>";
  }
}

function aplicarFiltros() {
  const pos    = document.getElementById("f-posicion").value;
  const nacion = document.getElementById("f-nacion").value;
  const rareza = document.getElementById("f-rareza").value;
  const buscar = document.getElementById("f-buscar").value.toLowerCase().trim();

  const filtrados = todosLosJugadores.filter(j => {
    if (pos    && j.posicionNatural !== pos) return false;
    if (nacion && j.nacionalidad    !== nacion) return false;
    if (rareza && j.rareza          !== rareza) return false;
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

  grid.innerHTML = jugadores.map(j => buildCardHTML(j)).join("");

  grid.querySelectorAll(".player-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const jugador = todosLosJugadores.find(j => j.id === id);
      if (jugador) abrirModal(jugador);
    });
  });
}

// ---------- Filtros ----------
["f-posicion","f-nacion","f-rareza","f-rareza"].forEach(id =>
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
  document.getElementById("edit-id").value          = j.id;
  document.getElementById("edit-nombre").value      = j.nombre;
  document.getElementById("edit-nacionalidad").value= j.nacionalidad;
  document.getElementById("edit-rareza").value      = j.rareza;
  document.getElementById("edit-imagenURL").value   = j.imagenURL || "";
  document.getElementById("edit-posNat").value      = j.posicionNatural;
  document.getElementById("edit-valNat").value      = j.valoracionNatural;

  const posSec = j.posicionSecundaria || "";
  document.getElementById("edit-posSec").value = posSec;
  document.getElementById("edit-valSec").disabled = !posSec;
  document.getElementById("edit-valSec").value = posSec ? (j.valoracionSecundaria || "") : "";

  const posTer = j.posicionTerciaria || "";
  document.getElementById("edit-posTer").value = posTer;
  document.getElementById("edit-valTer").disabled = !posTer;
  document.getElementById("edit-valTer").value = posTer ? (j.valoracionTerciaria || "") : "";

  // Estrategias ofensivas
  const of = j.estrategiasOfensivas || {};
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

  // Talentos: render según rareza, precargando los ya guardados
  const cantidadTalentos = RAREZA_TALENTOS[j.rareza] || 1;
  renderTalentos(editTalentosContainer, cantidadTalentos, j.talentos || []);

  document.getElementById("edit-error").textContent = "";
  document.getElementById("modal-overlay").classList.remove("hidden");
}

document.getElementById("modal-close").addEventListener("click", cerrarModal);
document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) cerrarModal();
});
function cerrarModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

// ---------- Guardar cambios ----------
document.getElementById("form-editar").addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("edit-id").value;
  const posSec = document.getElementById("edit-posSec").value;
  const posTer = document.getElementById("edit-posTer").value;

  const datos = {
    nombre:              document.getElementById("edit-nombre").value.trim(),
    nacionalidad:        document.getElementById("edit-nacionalidad").value,
    rareza:              document.getElementById("edit-rareza").value,
    imagenURL:           document.getElementById("edit-imagenURL").value.trim() || null,
    posicionNatural:     document.getElementById("edit-posNat").value,
    valoracionNatural:   Number(document.getElementById("edit-valNat").value),
    posicionSecundaria:  posSec || null,
    valoracionSecundaria: posSec ? Number(document.getElementById("edit-valSec").value) : null,
    posicionTerciaria:   posTer || null,
    valoracionTerciaria: posTer ? Number(document.getElementById("edit-valTer").value) : null,
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
    // Actualizar localmente
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
