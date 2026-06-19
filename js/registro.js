import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, query,
  orderBy, limit, deleteDoc, doc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "../js/firebase-config.js";
import { PAISES, POSICIONES, RAREZAS, BONIF_VALS, ESTRATEGIAS_OF, ESTRATEGIAS_DEF,
         flagEmoji, paisACodigo, rarezaCSS, buildCardHTML } from "../js/card-utils.js";

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ---------- Poblar selects ----------
function poblarSelects() {
  const sel = document.getElementById("nacionalidad");
  PAISES.forEach(([nombre]) => {
    const o = document.createElement("option");
    o.value = nombre; o.textContent = nombre;
    sel.appendChild(o);
  });

  ["posicionNatural","posicionSecundaria","posicionTerciaria"].forEach(id => {
    const s = document.getElementById(id);
    POSICIONES.forEach(pos => {
      const o = document.createElement("option");
      o.value = pos.value; o.textContent = pos.label;
      s.appendChild(o);
    });
  });

  // Poblar dropdowns de bonificación
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

// ---------- Toggle valoraciones secundarias ----------
function enlazarToggle(selectId, inputId) {
  const s = document.getElementById(selectId);
  const i = document.getElementById(inputId);
  s.addEventListener("change", () => {
    i.disabled = s.value === "";
    if (s.value === "") i.value = "";
    actualizarPreview();
  });
}
enlazarToggle("posicionSecundaria","valoracionSecundaria");
enlazarToggle("posicionTerciaria","valoracionTerciaria");

// ---------- Preview ----------
function actualizarPreview() {
  const nombre      = document.getElementById("nombre").value || "Nombre del jugador";
  const nacionalidad= document.getElementById("nacionalidad").value;
  const posicion    = document.getElementById("posicionNatural").value || "POS";
  const valoracion  = document.getElementById("valoracionNatural").value || "--";
  const imagenURL   = document.getElementById("imagenURL").value;
  const rareza      = document.getElementById("rareza").value;

  const card = document.getElementById("preview-card");

  // Actualizar clase de rareza
  card.className = `player-card ${rarezaCSS(rareza)}`;

  document.getElementById("preview-name").textContent     = nombre;
  document.getElementById("preview-position").textContent = posicion;
  document.getElementById("preview-rating").textContent   = valoracion;
  document.getElementById("preview-rareza").textContent   = rareza;


  const photo = document.getElementById("preview-photo");
  if (imagenURL) {
    photo.outerHTML = `<img id="preview-photo" class="card-img" src="${imagenURL}" alt="${nombre}" onerror="this.outerHTML='<div class=card-img-placeholder id=preview-photo>Sin foto</div>'" />`;
  } else {
    const existing = document.getElementById("preview-photo");
    if (existing.tagName === "IMG") {
      existing.outerHTML = `<div class="card-img-placeholder" id="preview-photo">Sin foto</div>`;
    }
  }
}

["nombre","nacionalidad","posicionNatural","valoracionNatural","imagenURL","rareza"]
  .forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input",  actualizarPreview);
    el.addEventListener("change", actualizarPreview);
  });
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

  const jugador = {
    nombre:             document.getElementById("nombre").value.trim(),
    nacionalidad:       document.getElementById("nacionalidad").value,
    imagenURL:          document.getElementById("imagenURL").value.trim() || null,
    rareza:             document.getElementById("rareza").value,
    posicionNatural:    document.getElementById("posicionNatural").value,
    valoracionNatural:  Number(document.getElementById("valoracionNatural").value),
    posicionSecundaria: document.getElementById("posicionSecundaria").value || null,
    valoracionSecundaria: Number(document.getElementById("valoracionSecundaria").value) || null,
    posicionTerciaria:  document.getElementById("posicionTerciaria").value || null,
    valoracionTerciaria: Number(document.getElementById("valoracionTerciaria").value) || null,
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
    fechaCreacion: serverTimestamp(),
  };

  if (!jugador.nombre || !jugador.nacionalidad || !jugador.posicionNatural || !jugador.valoracionNatural) {
    formError.textContent = "Completa al menos nombre, nacionalidad, posición y valoración natural.";
    return;
  }

  try {
    await addDoc(collection(db, "jugadores_global"), jugador);
    mostrarToast(`${jugador.nombre} guardado correctamente`);
    document.getElementById("form-jugador").reset();
    document.getElementById("valoracionSecundaria").disabled = true;
    document.getElementById("valoracionTerciaria").disabled  = true;
    // Resetear colores de bonificación
    [...ESTRATEGIAS_OF, ...ESTRATEGIAS_DEF].forEach(({ id }) => {
      const sel = document.getElementById(id);
      sel.value = "0";
      actualizarColorBonif(sel);
    });
    actualizarPreview();
    cargarRecientes();
  } catch (err) {
    console.error(err);
    document.getElementById("form-error").textContent = "No se pudo guardar. Revisa la consola.";
    mostrarToast("Error al guardar", true);
  }
});

// ---------- Jugadores recientes ----------
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
      const codigo = paisACodigo(d.nacionalidad);
      const row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = `
        <span class="row-rating">${d.valoracionNatural ?? "--"}</span>
        <span class="row-flag">${codigo ? flagEmoji(codigo) : "🏳️"}</span>
        <span class="row-name">${d.nombre}</span>
        <span class="row-pos">${d.posicionNatural}</span>
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
