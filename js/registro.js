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
import { ajustarCantidadBloques, leerTalentos, renderTalentos } from "../js/talentos-ui.js";
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

// ---------- Autocompletar con IA ----------
const SYSTEM_PROMPT = `Eres un experto analista de fútbol para un juego de cartas coleccionables.
Dado el nombre de un jugador de fútbol, genera sus estadísticas de carta de forma realista.

CÓDIGOS DE POSICIÓN (usa EXACTAMENTE estos):
GK (Portero), LD (Lateral Derecho), LI (Lateral Izquierdo), DFC (Defensa Central),
MCD (Mediocentro Defensivo), MD (Volante Derecho), MI (Volante Izquierdo),
MC (Mediocentro), MCO (Mediocentro Ofensivo), MP (Media Punta),
ED (Extremo Derecho), EI (Extremo Izquierdo), SD (Segundo Delantero), DC (Delantero Centro)

RANGOS DE RAREZA (determinados por valoracionNatural):
Estándar: 0-74 | Franquicia: 75-80 | Elite: 81-86 | Elite Mundial: 87-92 | Leyenda: 93-99

VERSIONES (4 en total, de menor a mayor valoracion, representando la evolución del jugador):
v1 = Versión más débil/temprana (valoracion más baja)
v2 = Desarrollo / etapa media
v3 = Pico en su club principal
v4 = Mejor versión absoluta / legendaria (valoracion más alta)

ESTRATEGIAS (valor -5 a +5, qué tan bien rinde el jugador en cada táctica):
Ofensivas: contraataque, posesion (tiki-taka), presionAlta (gegenpressing), juegoDirecto
Defensivas: bloqueBajo, bloqueAlto, zona (zonal), marcajeHombre

TALENTOS (exactamente 5, con valores PROGRESIVOS — cada talento debe ser mejor que el anterior):

TALENTO 1 (se activa desde rareza Estandar — el mas basico):
  Mecanicas simples: individual, posicion (1-2 posiciones max), o sinergia muy facil (1 jugador de 1 grupo)
  Valor maximo: buff +1 o +2 / debuff -1 o -2
  Ejemplo: buff individual +1, o sinergia pedir 1 jugador de cierta nacionalidad con valor +2

TALENTO 2 (se activa desde rareza Franquicia):
  Mecanicas simples/medias: posicion, nacionalidad, o sinergia sencilla
  Valor maximo: buff +2 / debuff -2 (hasta +3 solo con sinergia que pida 2+ jugadores)
  Ejemplo: buff por posicion +2, debuff por posicion -2

TALENTO 3 (se activa desde rareza Elite):
  Mecanicas medias: posicion multiple, nacionalidad, rareza, o sinergia moderada
  Valor maximo: buff +3 / debuff -3
  Ejemplo: buff por nacionalidad +3, sinergia 2 jugadores de misma posicion +3

TALENTO 4 (se activa desde rareza Elite Mundial):
  Mecanicas elaboradas: rareza, sinergia con 2 condiciones, debuff especifico
  Valor maximo: buff +4 / debuff -4 (mecanicas simples max +3)
  Ejemplo: sinergia 2 jugadores de misma rareza +4, debuff por rareza -3

TALENTO 5 (se activa solo desde rareza Leyenda — el mas poderoso):
  Mecanicas complejas: sinergia con multiples valores y cantidadMinima 2+, debuff amplio
  Valor maximo: buff +5 / debuff -5 (si la mecanica es simple, max +3)
  Ejemplo: sinergia pedir 2 jugadores de cada una de 2 nacionalidades especificas con valor +4 o +5

REGLAS DE TALENTOS:
- tipo: "buff" (beneficia a tu equipo) o "debuff" (perjudica al rival)
- alcance: "individual" (solo buff), "posicion", "nacionalidad", "rareza", "sinergia"
- "debuff" NUNCA puede usar alcance "individual"
- Para posicion: campo "posiciones" (array de codigos de posicion)
- Para nacionalidad: campo "nacionalidades" (array en ESPANOL: Espana, Francia, Brasil, etc.)
- Para rareza: campo "rarezas" (array con nombres exactos de rareza)
- Para sinergia: "criterioSinergia" (posicion/nacionalidad/rareza), "valoresCriterio" (array), "cantidadMinima" (minimo POR CADA valor marcado, logica AND)
- Los 5 talentos deben ser coherentes con el estilo y nacionalidad real del jugador
- Los valores deben subir progresivamente del talento 1 al 5

Devuelve SOLO el JSON valido sin texto adicional ni bloques markdown.`;

async function autocompletar() {
  const nombre = document.getElementById("nombre").value.trim();
  const statusEl = document.getElementById("ia-status");
  const btnIA = document.getElementById("btn-ia");

  if (!nombre) {
    statusEl.className = "ia-status error";
    statusEl.textContent = "Escribe el nombre del jugador primero.";
    return;
  }

  btnIA.disabled = true;
  statusEl.className = "ia-status";
  statusEl.textContent = "Analizando a " + nombre + "...";

  const userPrompt = `Analiza al jugador de fútbol "${nombre}" y devuelve sus estadísticas de carta.

Considera su carrera real, estilo de juego, equipos y selección nacional.

Devuelve exactamente este formato JSON:
{
  "nacionalidad": "España",
  "versiones": [
    {"posicionNatural": "DC", "valoracionNatural": 82, "posicionSecundaria": "EI", "valoracionSecundaria": 78, "posicionTerciaria": null, "valoracionTerciaria": null},
    {"posicionNatural": "DC", "valoracionNatural": 87, "posicionSecundaria": "EI", "valoracionSecundaria": 83, "posicionTerciaria": null, "valoracionTerciaria": null},
    {"posicionNatural": "DC", "valoracionNatural": 91, "posicionSecundaria": "SD", "valoracionSecundaria": 88, "posicionTerciaria": "EI", "valoracionTerciaria": 85},
    {"posicionNatural": "DC", "valoracionNatural": 95, "posicionSecundaria": "SD", "valoracionSecundaria": 92, "posicionTerciaria": "EI", "valoracionTerciaria": 88}
  ],
  "estrategiasOfensivas": {"contraataque": 2, "posesion": 3, "presionAlta": 1, "juegoDirecto": 4},
  "estrategiasDefensivas": {"bloqueBajo": -1, "bloqueAlto": 2, "zona": 0, "marcajeHombre": 1},
  "talentos": [
    {"tipo": "buff", "alcance": "individual", "valor": 3},
    {"tipo": "buff", "alcance": "posicion", "posiciones": ["DC", "SD"], "valor": 2},
    {"tipo": "debuff", "alcance": "posicion", "posiciones": ["DFC", "GK"], "valor": -2},
    {"tipo": "buff", "alcance": "sinergia", "criterioSinergia": "nacionalidad", "valoresCriterio": ["España"], "cantidadMinima": 2, "valor": 3},
    {"tipo": "buff", "alcance": "rareza", "rarezas": ["Leyenda", "Elite Mundial"], "valor": 2}
  ]
}

Reglas importantes:
- Las 4 versiones deben tener valoracionNatural distintas y ascendentes (v4 siempre la más alta)
- Los valores de estrategia reflejan el estilo real del jugador
- El talento 1 debe ser el más simple (individual), el 5 el más complejo
- Nacionalidad en español
- Usa EXACTAMENTE los códigos de posición dados`;

  try {
    const response = await fetch("https://tight-tooth-e67e.solisalex8291.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }]
      })
    });

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";
    const clean = rawText.replace(/```json|```/g, "").trim();
    const playerData = JSON.parse(clean);

    aplicarDatosIA(playerData);
    statusEl.className = "ia-status ok";
    statusEl.textContent = "✓ Datos completados. Solo falta agregar las URLs de imagen.";
  } catch (err) {
    console.error("Error IA:", err);
    statusEl.className = "ia-status error";
    statusEl.textContent = "Error al analizar el jugador. Revisa la consola.";
  } finally {
    btnIA.disabled = false;
  }
}

function aplicarDatosIA(data) {
  // Nacionalidad
  if (data.nacionalidad) {
    const nacSel = document.getElementById("nacionalidad");
    if (nacSel) nacSel.value = data.nacionalidad;
  }

  // Versiones (re-render con datos)
  if (data.versiones) {
    renderVersiones(versionesContainer, data.versiones);
    previewVersionIndex = 0;
  }

  // Estrategias ofensivas
  const ofMap = {
    bof_contraataque: data.estrategiasOfensivas?.contraataque,
    bof_posesion:     data.estrategiasOfensivas?.posesion,
    bof_presion:      data.estrategiasOfensivas?.presionAlta,
    bof_directo:      data.estrategiasOfensivas?.juegoDirecto,
  };
  Object.entries(ofMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) { el.value = val; actualizarColorBonif(el); }
  });

  // Estrategias defensivas
  const defMap = {
    bdef_bloquebajo: data.estrategiasDefensivas?.bloqueBajo,
    bdef_bloquealto: data.estrategiasDefensivas?.bloqueAlto,
    bdef_zona:       data.estrategiasDefensivas?.zona,
    bdef_marcaje:    data.estrategiasDefensivas?.marcajeHombre,
  };
  Object.entries(defMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) { el.value = val; actualizarColorBonif(el); }
  });

  // Talentos (re-render con datos)
  if (data.talentos) {
    renderTalentos(talentosContainer, 5, data.talentos);
  }

  // Actualizar preview
  actualizarPreview();
}

document.getElementById("btn-ia").addEventListener("click", autocompletar);

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
