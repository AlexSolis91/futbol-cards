// ============================================================
// REGISTRO.JS — Lógica de la Ficha de Registro de Jugador
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "../js/firebase-config.js";

// ---------- Inicialización ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- Catálogos ----------
const POSICIONES = [
  { value: "GK", label: "GK — Portero" },
  { value: "LD", label: "LD — Lateral Derecho" },
  { value: "LI", label: "LI — Lateral Izquierdo" },
  { value: "DFC", label: "DFC — Defensa Central" },
  { value: "MCD", label: "MCD — Mediocentro Defensivo" },
  { value: "MD", label: "MD — Volante Derecho" },
  { value: "MI", label: "MI — Volante Izquierdo" },
  { value: "MC", label: "MC — Mediocentro" },
  { value: "MCO", label: "MCO — Mediocentro Ofensivo" },
  { value: "ED", label: "ED — Extremo Derecho" },
  { value: "EI", label: "EI — Extremo Izquierdo" },
  { value: "DC", label: "DC — Delantero Centro" },
];

const PAISES = [
  ["Argentina", "AR"], ["Brasil", "BR"], ["Uruguay", "UY"], ["Chile", "CL"],
  ["Colombia", "CO"], ["Paraguay", "PY"], ["Perú", "PE"], ["Ecuador", "EC"],
  ["Venezuela", "VE"], ["Bolivia", "BO"], ["México", "MX"], ["Estados Unidos", "US"],
  ["Canadá", "CA"], ["Costa Rica", "CR"], ["Honduras", "HN"], ["Panamá", "PA"],
  ["Jamaica", "JM"], ["Guatemala", "GT"], ["El Salvador", "SV"], ["España", "ES"],
  ["Portugal", "PT"], ["Francia", "FR"], ["Inglaterra", "GB"], ["Alemania", "DE"],
  ["Italia", "IT"], ["Países Bajos", "NL"], ["Bélgica", "BE"], ["Croacia", "HR"],
  ["Polonia", "PL"], ["Suiza", "CH"], ["Austria", "AT"], ["Dinamarca", "DK"],
  ["Suecia", "SE"], ["Noruega", "NO"], ["Escocia", "GB"], ["Gales", "GB"],
  ["Irlanda", "IE"], ["Rusia", "RU"], ["Ucrania", "UA"], ["Turquía", "TR"],
  ["Grecia", "GR"], ["República Checa", "CZ"], ["Eslovaquia", "SK"], ["Hungría", "HU"],
  ["Rumania", "RO"], ["Serbia", "RS"], ["Bosnia y Herzegovina", "BA"], ["Senegal", "SN"],
  ["Marruecos", "MA"], ["Nigeria", "NG"], ["Ghana", "GH"], ["Camerún", "CM"],
  ["Egipto", "EG"], ["Argelia", "DZ"], ["Túnez", "TN"], ["Costa de Marfil", "CI"],
  ["Mali", "ML"], ["Japón", "JP"], ["Corea del Sur", "KR"], ["Arabia Saudita", "SA"],
  ["Qatar", "QA"], ["Irán", "IR"], ["Australia", "AU"], ["China", "CN"],
  ["Sudáfrica", "ZA"], ["Nueva Zelanda", "NZ"],
];

function flagEmoji(code) {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function paisACodigo(nombrePais) {
  const match = PAISES.find(([nombre]) => nombre === nombrePais);
  return match ? match[1] : null;
}

// ---------- Poblar selects ----------
function poblarSelects() {
  const nacionalidad = document.getElementById("nacionalidad");
  PAISES.forEach(([nombre]) => {
    const opt = document.createElement("option");
    opt.value = nombre;
    opt.textContent = nombre;
    nacionalidad.appendChild(opt);
  });

  ["posicionNatural", "posicionSecundaria", "posicionTerciaria"].forEach((id) => {
    const select = document.getElementById(id);
    POSICIONES.forEach((pos) => {
      const opt = document.createElement("option");
      opt.value = pos.value;
      opt.textContent = pos.label;
      select.appendChild(opt);
    });
  });
}
poblarSelects();

// ---------- Habilitar/deshabilitar valoraciones secundarias ----------
function enlazarToggle(selectId, inputId) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  select.addEventListener("change", () => {
    if (select.value === "") {
      input.disabled = true;
      input.value = "";
    } else {
      input.disabled = false;
    }
    actualizarPreview();
  });
}
enlazarToggle("posicionSecundaria", "valoracionSecundaria");
enlazarToggle("posicionTerciaria", "valoracionTerciaria");

// ---------- Preview en vivo ----------
const previewCard = document.getElementById("preview-card");
const previewRating = document.getElementById("preview-rating");
const previewFlag = document.getElementById("preview-flag");
const previewPhoto = document.getElementById("preview-photo");
const previewName = document.getElementById("preview-name");
const previewPosition = document.getElementById("preview-position");
const previewRareza = document.getElementById("preview-rareza");

const RAREZA_COLOR = {
  Bronce: "var(--rareza-bronce)",
  Plata: "var(--rareza-plata)",
  Oro: "var(--rareza-oro)",
  Leyenda: "var(--rareza-leyenda)",
};

function actualizarPreview() {
  const nombre = document.getElementById("nombre").value || "Nombre del jugador";
  const nacionalidad = document.getElementById("nacionalidad").value;
  const posicion = document.getElementById("posicionNatural").value || "POS";
  const valoracion = document.getElementById("valoracionNatural").value || "--";
  const imagenURL = document.getElementById("imagenURL").value;
  const rareza = document.getElementById("rareza").value;

  previewName.textContent = nombre;
  previewPosition.textContent = posicion;
  previewRating.innerHTML = `${valoracion}<small>OVR</small>`;
  previewRareza.textContent = rareza;
  previewCard.style.borderColor = RAREZA_COLOR[rareza] || "var(--rareza-bronce)";

  const codigo = paisACodigo(nacionalidad);
  previewFlag.textContent = codigo ? flagEmoji(codigo) : "🏳️";

  if (imagenURL) {
    previewPhoto.innerHTML = `<img src="${imagenURL}" alt="${nombre}" onerror="this.parentElement.innerHTML='Imagen no válida'" />`;
  } else {
    previewPhoto.innerHTML = "Sin foto";
  }
}

[
  "nombre", "nacionalidad", "posicionNatural", "valoracionNatural",
  "imagenURL", "rareza",
].forEach((id) => {
  document.getElementById(id).addEventListener("input", actualizarPreview);
  document.getElementById(id).addEventListener("change", actualizarPreview);
});
actualizarPreview();

// ---------- Toast ----------
const toast = document.getElementById("toast");
function mostrarToast(mensaje, esError = false) {
  toast.textContent = mensaje;
  toast.classList.toggle("error", esError);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

// ---------- Login ----------
const loginScreen = document.getElementById("login-screen");
const appEl = document.getElementById("app");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-pass").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    loginError.textContent = "Correo o contraseña incorrectos.";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
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
const formJugador = document.getElementById("form-jugador");
const formError = document.getElementById("form-error");

formJugador.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const jugador = {
    nombre: document.getElementById("nombre").value.trim(),
    nacionalidad: document.getElementById("nacionalidad").value,
    edad: Number(document.getElementById("edad").value) || null,
    imagenURL: document.getElementById("imagenURL").value.trim() || null,
    rareza: document.getElementById("rareza").value,
    posicionNatural: document.getElementById("posicionNatural").value,
    valoracionNatural: Number(document.getElementById("valoracionNatural").value),
    posicionSecundaria: document.getElementById("posicionSecundaria").value || null,
    valoracionSecundaria: Number(document.getElementById("valoracionSecundaria").value) || null,
    posicionTerciaria: document.getElementById("posicionTerciaria").value || null,
    valoracionTerciaria: Number(document.getElementById("valoracionTerciaria").value) || null,
    estrategiaOfensiva: document.getElementById("estrategiaOfensiva").value.trim() || null,
    bonifOfensiva: Number(document.getElementById("bonifOfensiva").value) || null,
    estrategiaDefensiva: document.getElementById("estrategiaDefensiva").value.trim() || null,
    bonifDefensiva: Number(document.getElementById("bonifDefensiva").value) || null,
    fechaCreacion: serverTimestamp(),
  };

  if (!jugador.nombre || !jugador.nacionalidad || !jugador.posicionNatural || !jugador.valoracionNatural) {
    formError.textContent = "Completa al menos nombre, nacionalidad, posición y valoración natural.";
    return;
  }

  try {
    await addDoc(collection(db, "jugadores_global"), jugador);
    mostrarToast(`${jugador.nombre} guardado correctamente`);
    formJugador.reset();
    document.getElementById("valoracionSecundaria").disabled = true;
    document.getElementById("valoracionTerciaria").disabled = true;
    actualizarPreview();
    cargarRecientes();
  } catch (err) {
    console.error(err);
    formError.textContent = "No se pudo guardar el jugador. Revisa la consola.";
    mostrarToast("Error al guardar", true);
  }
});

// ---------- Lista de jugadores recientes ----------
async function cargarRecientes() {
  const recentList = document.getElementById("recent-list");
  recentList.innerHTML = "Cargando...";

  try {
    const q = query(collection(db, "jugadores_global"), orderBy("fechaCreacion", "desc"), limit(10));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      recentList.innerHTML = `<p style="color:var(--ink-muted);">Todavía no hay jugadores registrados.</p>`;
      return;
    }

    recentList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const codigo = paisACodigo(data.nacionalidad);
      const row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = `
        <span class="row-rating">${data.valoracionNatural ?? "--"}</span>
        <span class="row-flag">${codigo ? flagEmoji(codigo) : "🏳️"}</span>
        <span class="row-name">${data.nombre}</span>
        <span class="row-pos">${data.posicionNatural}</span>
        <button class="delete-btn" data-id="${docSnap.id}">Eliminar</button>
      `;
      recentList.appendChild(row);
    });

    recentList.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar este jugador de la base de datos?")) return;
        await deleteDoc(doc(db, "jugadores_global", btn.dataset.id));
        cargarRecientes();
      });
    });
  } catch (err) {
    console.error(err);
    recentList.innerHTML = `<p style="color:var(--danger);">Error al cargar jugadores.</p>`;
  }
}
