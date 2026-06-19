// ============================================================
// VERSIONES-UI.JS — Bloques de Versión de carta (hasta 4 por
// jugador). Compartido entre Registro y Catálogo/Edición.
// ============================================================
//
// Cada jugador (documento) tiene datos compartidos (nombre,
// nacionalidad, estrategias, talentos) + un array `versiones`
// de hasta 4 elementos, cada uno con su propia imagen, posiciones,
// valoraciones y ratio de drop en sobres. La rareza de cada
// versión se CALCULA a partir de su valoracionNatural — no se
// guarda como elección manual.
// ============================================================

import { POSICIONES, calcularRareza, rarezaCSS } from "./card-utils.js";

export const MAX_VERSIONES = 4;

function posicionesOptionsHTML(selected) {
  return POSICIONES.map(p =>
    `<option value="${p.value}" ${p.value === selected ? "selected" : ""}>${p.label}</option>`
  ).join("");
}

function bloqueVersionHTML(index, data = {}) {
  const tieneSec = !!data.posicionSecundaria;
  const tieneTer = !!data.posicionTerciaria;

  return `
    <div class="version-block" data-index="${index}">
      <div class="version-header">Versión ${index + 1}</div>

      <div class="field-row">
        <div class="field" style="grid-column:1/-1;">
          <label>Club / Etapa (opcional)</label>
          <input type="text" class="v-etiqueta" placeholder="Ej. Al-Nassr" value="${data.etiqueta || ''}" />
        </div>
      </div>

      <div class="field-row">
        <div class="field" style="grid-column:1/-1;">
          <label>URL de la imagen</label>
          <input type="url" class="v-imagen" placeholder="https://..." value="${data.imagenURL || ''}" />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Posición natural</label>
          <select class="v-posNat">${posicionesOptionsHTML(data.posicionNatural)}</select>
        </div>
        <div class="field">
          <label>Valoración</label>
          <input type="number" class="v-valNat" min="1" max="99" placeholder="85" value="${data.valoracionNatural || ''}" />
        </div>
        <div class="field">
          <label>Rareza</label>
          <div class="rareza-badge">—</div>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Posición secundaria (opcional)</label>
          <select class="v-posSec">
            <option value="">Ninguna</option>
            ${posicionesOptionsHTML(data.posicionSecundaria)}
          </select>
        </div>
        <div class="field">
          <label>Valoración</label>
          <input type="number" class="v-valSec" min="1" max="99" value="${data.valoracionSecundaria || ''}" ${tieneSec ? "" : "disabled"} />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Posición terciaria (opcional)</label>
          <select class="v-posTer">
            <option value="">Ninguna</option>
            ${posicionesOptionsHTML(data.posicionTerciaria)}
          </select>
        </div>
        <div class="field">
          <label>Valoración</label>
          <input type="number" class="v-valTer" min="1" max="99" value="${data.valoracionTerciaria || ''}" ${tieneTer ? "" : "disabled"} />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Ratio de drop en sobres (%)</label>
          <input type="number" class="v-dropRate" min="0" max="100" step="0.1" placeholder="10" value="${data.dropRate ?? ''}" />
        </div>
      </div>
    </div>`;
}

function actualizarRarezaBadge(block) {
  const valNat = block.querySelector(".v-valNat");
  const badge  = block.querySelector(".rareza-badge");
  const v = parseInt(valNat.value);

  badge.classList.remove("rareza-estandar","rareza-franquicia","rareza-elite","rareza-elite-mundial","rareza-leyenda");

  if (!v) {
    badge.textContent = "—";
    return;
  }
  const rareza = calcularRareza(v);
  badge.textContent = rareza;
  badge.classList.add(rarezaCSS(rareza));
}

function wireVersionBlockEvents(block) {
  const valNat = block.querySelector(".v-valNat");
  valNat.addEventListener("input", () => actualizarRarezaBadge(block));

  function enlazarToggle(selSel, inputSel) {
    const sel = block.querySelector(selSel);
    const inp = block.querySelector(inputSel);
    sel.addEventListener("change", () => {
      inp.disabled = sel.value === "";
      if (sel.value === "") inp.value = "";
    });
  }
  enlazarToggle(".v-posSec", ".v-valSec");
  enlazarToggle(".v-posTer", ".v-valTer");

  actualizarRarezaBadge(block);
}

// ---------- API pública ----------

// Renderiza siempre los 4 bloques (algunos pueden quedar vacíos)
export function renderVersiones(container, datosIniciales = []) {
  container.innerHTML = "";
  for (let i = 0; i < MAX_VERSIONES; i++) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = bloqueVersionHTML(i, datosIniciales[i] || {});
    const block = wrapper.firstElementChild;
    container.appendChild(block);
    wireVersionBlockEvents(block);
  }
}

// Lee el estado actual del DOM y devuelve el array `versiones`
export function leerVersiones(container) {
  const blocks = container.querySelectorAll(".version-block");
  const versiones = [];

  blocks.forEach(block => {
    const posSec = block.querySelector(".v-posSec").value;
    const posTer = block.querySelector(".v-posTer").value;

    versiones.push({
      etiqueta:             block.querySelector(".v-etiqueta").value.trim() || null,
      imagenURL:            block.querySelector(".v-imagen").value.trim() || null,
      posicionNatural:      block.querySelector(".v-posNat").value || null,
      valoracionNatural:    Number(block.querySelector(".v-valNat").value) || null,
      posicionSecundaria:   posSec || null,
      valoracionSecundaria: posSec ? (Number(block.querySelector(".v-valSec").value) || null) : null,
      posicionTerciaria:    posTer || null,
      valoracionTerciaria:  posTer ? (Number(block.querySelector(".v-valTer").value) || null) : null,
      dropRate:             Number(block.querySelector(".v-dropRate").value) || 0,
    });
  });

  return versiones;
}

// Lee en vivo los datos de UNA versión específica directo del DOM
// (usado para refrescar la vista previa sin esperar al submit)
export function leerVersionIndividual(container, index) {
  const block = container.querySelectorAll(".version-block")[index];
  if (!block) return null;
  return {
    etiqueta:          block.querySelector(".v-etiqueta").value.trim(),
    imagenURL:         block.querySelector(".v-imagen").value.trim(),
    posicionNatural:   block.querySelector(".v-posNat").value,
    valoracionNatural: block.querySelector(".v-valNat").value,
  };
}
