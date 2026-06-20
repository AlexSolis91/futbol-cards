// ============================================================
// REGISTRO.JS — Lógica de la Ficha de Registro de Jugador
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, query,
  orderBy, limit, deleteDoc, doc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "../js/firebase-config.js";

import { PAISES, BONIF_VALS, ESTRATEGIAS_OF, ESTRATEGIAS_DEF,
         flagEmoji, paisACodigo, rarezaCSS, calcularRareza } from "../js/card-utils.js";
import { ajustarCantidadBloques, leerTalentos } from "../js/talentos-ui.js";
import { MAX_VERSIONES, renderVersiones, leerVersiones, leerVersionIndividual } from "../js/versiones-ui.js";

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const CANTIDAD_TALENTOS_FIJA = 5;

// ---------- Poblar selects de nivel jugador ----------
function poblarSelects() {
  const nacionalidad = document.getElementById("nacionalidad");
  PAISES.forEach(([nombre]) => {
    const o = document.createElement("option");
    o.value = nombre; o.textContent = nombre;
    nacionalidad.appendChild(o);
  });

  [...ESTRATEGIAS_OF, ...ESTRATEGIAS_DEF].forEach(({ id }) => {
    const sel = document.getElementById(id);
    BONIF_VALS.forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v > 0 ? `+${v}` : `${v}`;
      if (v === 0) o.selected = true;
      sel.appendChild(o);
    });
    actualizarColorBonif(sel);
    sel.addEventListener("change", () => actualizarColorBonif(sel));
  });
}

function actualizarColorBonif(sel) {
  const v = parseInt(sel.value);
  sel.classList.remove("positivo","negativo","neutro");
  if (v > 0) sel.classList.add("positivo");
  else if (v < 0) sel.classList.add("negativo");
  else sel.classList.add("neutro");
}

poblarSelects();

// ---------- Versiones ----------
const versionesContainer = document.getElementById("versiones-container");
renderVersiones(versionesContainer);

// Cuando cambia cualquier campo dentro de una versión, refrescamos
// la preview si esa versión es la que se está mostrando ahora mismo
versionesContainer.addEventListener("input", e => {
  const block = e.target.closest(".version-block");
  if (!block) return;
  const idx = Number(block.dataset.index);
  if (idx === previewVersionIndex) actualizarPreview();
});

// ---------- Talentos (siempre 5, fijos) ----------
const talentosContainer = document.getElementById("talentos-container");
ajustarCantidadBloques(talentosContainer, CANTIDAD_TALENTOS_FIJA);

// ---------- Preview con flechas de versión ----------
let previewVersionIndex = 0;

const previewCard       = document.getElementById("preview-card");
const previewRating     = document.getElementById("preview-rating");
const previewPhoto      = document.getElementById("preview-photo");
const previewName       = document.getElementById("preview-name");
const previewPosition   = document.getElementById("preview-position");
const previewRareza     = document.getElementById("preview-rareza");
const previewVersionLbl = document.getElementById("preview-version-label");
const btnPrev           = document.getElementById("preview-prev");
const btnNext           = document.getElementById("preview-next");

function actualizarPreview() {
  const nombreGlobal = document.getElementById("nombre").value || "Nombre del jugador";
  const v = leerVersionIndividual(versionesContainer, previewVersionIndex) || {};

  previewVersionLbl.textContent = `Versión ${previewVersionIndex + 1}`;

  const posicion   = v.posicionNatural || "POS";
  const valoracion = v.valoracionNatural || "--";
  const rareza     = calcularRareza(v.valoracionNatural);

  previewName.textContent     = nombreGlobal;
  previewPosition.textContent = posicion;
  previewRating.textContent   = valoracion;
  previewRareza.textContent   = rareza;
  previewCard.className       = `player-card ${rarezaCSS(rareza)}`;

  if (v.imagenURL) {
    previewPhoto.innerHTML = `<img src="${v.imagenURL}" alt="${nombreGlobal}" onerror="this.parentElement.innerHTML='Sin foto'" />`;
  } else {
    previewPhoto.innerHTML = "Sin foto";
  }

  btnPrev.disabled = previewVersionIndex === 0;
  btnNext.disabled = previewVersionIndex === MAX_VERSIONES - 1;
}

btnPrev.addEventListener("click", () => {
  if (previewVersionIndex > 0) { previewVersionIndex--; actualizarPreview(); }
});
btnNext.addEventListener("click", () => {
  if (previewVersionIndex < MAX_VERSIONES - 1) { previewVersionIndex++; actualizarPreview(); }
});
document.getElementById("nombre").addEventListener("input", actualizarPreview);

actualizarPreview();

// ---------- Toast ----------
const toast = document.getElementById("toast");
function mostrarToast(msg, esError = false) {
  toast.textContent = msg;
  toast.classList.toggle("error", esError);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

// ---------- Login ----------
const loginScreen = document.getElementById("login-screen");
const appEl       = document.getElementById("app");
const loginForm   = document.getElementById("login-form");
const loginError  = document.getElementById("login-error");

loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("login-email").value,
      document.getElementById("login-pass").value
    );
  } catch {
    loginError.textContent = "Correo o contraseña incorrectos.";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, user => {
  if (user) {
    loginScreen.classList.add("hidden");
    appEl.classList.remove("hidden");
    cargarRecientes();
  } else {
    loginScreen.classList.remove("hidden");
    appEl.classList.add("hidden");
  }
});

// ---------- Guardar jugador ----------
document.getElementById("form-jugador").addEventListener("submit", async e => {
  e.preventDefault();
  const formError = document.getElementById("form-error");
  formError.textContent = "";

  const versiones = leerVersiones(versionesContainer);
  const versionPrincipal = versiones.find(v => v.posicionNatural && v.valoracionNatural);

  const jugador = {
    nombre:       document.getElementById("nombre").value.trim(),
    nacionalidad: document.getElementById("nacionalidad").value,
    versiones,
    estrategiasOfensivas: {
      contraataque: Number(document.getElementById("bof_contraataque").value),
      posesion:     Number(document.getElementById("bof_posesion").value),
      presionAlta:  Number(document.getElementById("bof_presion").value),
      juegoDirecto: Number(document.getElementById("bof_directo").value),
    },
    estrategiasDefensivas: {
      bloqueBajo:    Number(document.getElementById("bdef_bloquebajo").value),
      bloqueAlto:    Number(document.getElementById("bdef_bloquealto").value),
      zona:          Number(document.getElementById("bdef_zona").value),
      marcajeHombre: Number(document.getElementById("bdef_marcaje").value),
    },
    talentos: leerTalentos(talentosContainer),
    fechaCreacion: serverTimestamp(),
  };

  if (!jugador.nombre || !jugador.nacionalidad || !versionPrincipal) {
    formError.textContent = "Completa al menos el nombre, nacionalidad y la Versión 1 (posición + valoración).";
    return;
  }

  try {
    await addDoc(collection(db, "jugadores_global"), jugador);
    mostrarToast(`${jugador.nombre} guardado correctamente`);
    document.getElementById("form-jugador").reset();
    renderVersiones(versionesContainer);
    previewVersionIndex = 0;
    actualizarPreview();
    cargarRecientes();
  } catch (err) {
    console.error(err);
    formError.textContent = "No se pudo guardar. Revisa la consola.";
    mostrarToast("Error al guardar", true);
  }
});

// ---------- Jugadores recientes ----------
function mejorVersion(jugador) {
  const versiones = (jugador.versiones || []).filter(v => v && v.valoracionNatural);
  if (versiones.length === 0) return null;
  return versiones.reduce((best, v) => v.valoracionNatural > best.valoracionNatural ? v : best, versiones[0]);
}

async function cargarRecientes() {
  const list = document.getElementById("recent-list");
  list.innerHTML = "Cargando...";
  try {
    const q = query(collection(db,"jugadores_global"), orderBy("fechaCreacion","desc"), limit(10));
    const snap = await getDocs(q);
    if (snap.empty) {
      list.innerHTML = `<p style="color:var(--ink-muted);">Todavía no hay jugadores registrados.</p>`;
      return;
    }
    list.innerHTML = "";
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const v = mejorVersion(d);
      const codigo = paisACodigo(d.nacionalidad);
      const row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = `
        <span class="row-rating">${v ? v.valoracionNatural : "--"}</span>
        <span class="row-flag">${codigo ? flagEmoji(codigo) : "🏳️"}</span>
        <span class="row-name">${d.nombre}</span>
        <span class="row-pos">${v ? v.posicionNatural : ""}</span>
        <button class="delete-btn" data-id="${docSnap.id}">Eliminar</button>
      `;
      list.appendChild(row);
    });
    list.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar este jugador?")) return;
        await deleteDoc(doc(db,"jugadores_global", btn.dataset.id));
        cargarRecientes();
      });
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = `<p style="color:var(--danger);">Error al cargar jugadores.</p>`;
  }
}
