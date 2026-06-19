// ============================================================
// TALENTOS-UI.JS — Sistema de Talentos (compartido entre
// Registro y Catálogo/Edición)
// ============================================================
import { POSICIONES, PAISES, RAREZAS } from "./card-utils.js";

export const RAREZA_TALENTOS = {
  "Estándar": 1,
  "Franquicia": 2,
  "Elite": 3,
  "Elite Mundial": 4,
  "Leyenda": 5,
};

const VALOR_BUFF   = [5,4,3,2,1];
const VALOR_DEBUFF = [-1,-2,-3,-4,-5];

// ---------- Helpers de render ----------
function valorOptionsHTML(tipo, valorActual) {
  const vals = tipo === "debuff" ? VALOR_DEBUFF : VALOR_BUFF;
  return vals.map(v => {
    const label = v > 0 ? `+${v}` : `${v}`;
    const sel = (Number(valorActual) === v) ? "selected" : "";
    return `<option value="${v}" ${sel}>${label}</option>`;
  }).join("");
}

function posicionesChecksHTML(name, selected = []) {
  return POSICIONES.map(p => {
    const chk = selected.includes(p.value) ? "checked" : "";
    return `<label class="chk-item"><input type="checkbox" name="${name}" value="${p.value}" ${chk}/>${p.value}</label>`;
  }).join("");
}

function nacionalidadesChecksHTML(name, selected = []) {
  return PAISES.map(([nombre]) => {
    const chk = selected.includes(nombre) ? "checked" : "";
    return `<label class="chk-item"><input type="checkbox" name="${name}" value="${nombre}" ${chk}/>${nombre}</label>`;
  }).join("");
}

function rarezasChecksHTML(name, selected = []) {
  return RAREZAS.map(r => {
    const chk = selected.includes(r.value) ? "checked" : "";
    return `<label class="chk-item"><input type="checkbox" name="${name}" value="${r.value}" ${chk}/>${r.value}</label>`;
  }).join("");
}

function sinergiaValoresHTML(criterio, selected = []) {
  if (criterio === "posicion")  return posicionesChecksHTML("sinergia-valores", selected);
  if (criterio === "rareza")    return rarezasChecksHTML("sinergia-valores", selected);
  return nacionalidadesChecksHTML("sinergia-valores", selected);
}

// ---------- HTML de un bloque de talento ----------
function bloqueTalentoHTML(index, data = {}) {
  const tipo    = data.tipo    || "buff";
  const alcance = data.alcance || "individual";
  const valor   = data.valor ?? (tipo === "buff" ? 1 : -1);
  const critSin = data.criterioSinergia || "nacionalidad";

  return `
    <div class="talento-block" data-index="${index}">
      <div class="talento-header">Talento ${index + 1}</div>

      <div class="field-row">
        <div class="field">
          <label>Tipo</label>
          <select class="t-tipo">
            <option value="buff" ${tipo === "buff" ? "selected" : ""}>Buff (equipo propio)</option>
            <option value="debuff" ${tipo === "debuff" ? "selected" : ""}>Debuff (equipo rival)</option>
          </select>
        </div>
        <div class="field">
          <label>Alcance</label>
          <select class="t-alcance">
            <option value="individual" ${alcance === "individual" ? "selected" : ""} ${tipo === "debuff" ? "disabled" : ""}>Individual</option>
            <option value="posicion" ${alcance === "posicion" ? "selected" : ""}>Posición</option>
            <option value="nacionalidad" ${alcance === "nacionalidad" ? "selected" : ""}>Nacionalidad</option>
            <option value="rareza" ${alcance === "rareza" ? "selected" : ""}>Rareza</option>
            <option value="sinergia" ${alcance === "sinergia" ? "selected" : ""}>Sinergia</option>
          </select>
        </div>
        <div class="field">
          <label>Valor</label>
          <select class="t-valor bonif-select">${valorOptionsHTML(tipo, valor)}</select>
        </div>
      </div>

      <div class="t-sub t-sub-posicion ${alcance === "posicion" ? "" : "hidden"}">
        <label class="sub-label">Posiciones afectadas</label>
        <div class="chk-grid">${posicionesChecksHTML(`t${index}-pos`, data.posiciones || [])}</div>
      </div>

      <div class="t-sub t-sub-nacionalidad ${alcance === "nacionalidad" ? "" : "hidden"}">
        <label class="sub-label">Nacionalidades afectadas</label>
        <div class="chk-grid chk-grid-scroll">${nacionalidadesChecksHTML(`t${index}-nac`, data.nacionalidades || [])}</div>
      </div>

      <div class="t-sub t-sub-rareza ${alcance === "rareza" ? "" : "hidden"}">
        <label class="sub-label">Rarezas afectadas</label>
        <div class="chk-grid">${rarezasChecksHTML(`t${index}-rar`, data.rarezas || [])}</div>
      </div>

      <div class="t-sub t-sub-sinergia ${alcance === "sinergia" ? "" : "hidden"}">
        <div class="field-row">
          <div class="field">
            <label>Criterio</label>
            <select class="t-sinergia-criterio">
              <option value="posicion" ${critSin === "posicion" ? "selected" : ""}>Posición</option>
              <option value="nacionalidad" ${critSin === "nacionalidad" ? "selected" : ""}>Nacionalidad</option>
              <option value="rareza" ${critSin === "rareza" ? "selected" : ""}>Rareza</option>
            </select>
          </div>
          <div class="field">
            <label>Cantidad mínima en el 11</label>
            <input type="number" class="t-sinergia-cantidad" min="1" max="11" value="${data.cantidadMinima || 2}" />
          </div>
        </div>
        <label class="sub-label">Valores que cuentan para el umbral</label>
        <div class="chk-grid chk-grid-scroll t-sinergia-valores">${sinergiaValoresHTML(critSin, data.valoresCriterio || [])}</div>
      </div>
    </div>`;
}

// ---------- Color del select de valor ----------
function actualizarColorValor(sel) {
  const v = parseInt(sel.value);
  sel.classList.remove("positivo","negativo");
  sel.classList.add(v > 0 ? "positivo" : "negativo");
}

function mostrarSubSelector(block, alcance) {
  block.querySelectorAll(".t-sub").forEach(el => el.classList.add("hidden"));
  if (alcance !== "individual") {
    const target = block.querySelector(`.t-sub-${alcance}`);
    if (target) target.classList.remove("hidden");
  }
}

// ---------- Eventos de un bloque ----------
function wireBlockEvents(block) {
  const tipoSel    = block.querySelector(".t-tipo");
  const alcanceSel = block.querySelector(".t-alcance");
  const valorSel   = block.querySelector(".t-valor");

  function actualizarOpcionIndividual() {
    const opIndividual = alcanceSel.querySelector('option[value="individual"]');
    if (tipoSel.value === "debuff") {
      opIndividual.disabled = true;
      if (alcanceSel.value === "individual") {
        alcanceSel.value = "posicion";
        mostrarSubSelector(block, "posicion");
      }
    } else {
      opIndividual.disabled = false;
    }
  }

  function actualizarValorOptions() {
    const valorActual = parseInt(valorSel.value) || 0;
    // Si cambia de buff a debuff (o viceversa) y el valor actual no tiene
    // sentido en el nuevo rango, se reinicia a +1 / -1
    const nuevoValor = tipoSel.value === "debuff"
      ? (valorActual < 0 ? valorActual : -1)
      : (valorActual > 0 ? valorActual : 1);
    valorSel.innerHTML = valorOptionsHTML(tipoSel.value, nuevoValor);
    actualizarColorValor(valorSel);
  }

  tipoSel.addEventListener("change", () => {
    actualizarOpcionIndividual();
    actualizarValorOptions();
  });

  alcanceSel.addEventListener("change", () => {
    mostrarSubSelector(block, alcanceSel.value);
  });

  valorSel.addEventListener("change", () => actualizarColorValor(valorSel));

  const sinergiaCriterio = block.querySelector(".t-sinergia-criterio");
  if (sinergiaCriterio) {
    sinergiaCriterio.addEventListener("change", () => {
      const valoresContainer = block.querySelector(".t-sinergia-valores");
      valoresContainer.innerHTML = sinergiaValoresHTML(sinergiaCriterio.value, []);
    });
  }

  actualizarOpcionIndividual();
  actualizarColorValor(valorSel);
}

// ---------- API pública ----------

// Ajusta el número de bloques visibles según la rareza, preservando
// los datos ya ingresados en los bloques que se mantienen.
export function ajustarCantidadBloques(container, nuevaCantidad, datosIniciales = []) {
  const existentes = container.querySelectorAll(".talento-block").length;

  if (nuevaCantidad > existentes) {
    for (let i = existentes; i < nuevaCantidad; i++) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = bloqueTalentoHTML(i, datosIniciales[i] || {});
      const block = wrapper.firstElementChild;
      container.appendChild(block);
      wireBlockEvents(block);
    }
  } else if (nuevaCantidad < existentes) {
    const blocks = container.querySelectorAll(".talento-block");
    for (let i = existentes - 1; i >= nuevaCantidad; i--) {
      blocks[i].remove();
    }
  }
}

// Reemplaza por completo el contenido (usado al abrir el modal de edición)
export function renderTalentos(container, cantidad, datosIniciales = []) {
  container.innerHTML = "";
  ajustarCantidadBloques(container, cantidad, datosIniciales);
}

// Lee el estado actual del DOM y devuelve el array `talentos`
export function leerTalentos(container) {
  const blocks = container.querySelectorAll(".talento-block");
  const talentos = [];

  blocks.forEach(block => {
    const tipo    = block.querySelector(".t-tipo").value;
    const alcance = block.querySelector(".t-alcance").value;
    const valor   = parseInt(block.querySelector(".t-valor").value);

    const talento = { tipo, alcance, valor };

    if (alcance === "posicion") {
      talento.posiciones = Array.from(block.querySelectorAll(".t-sub-posicion input:checked")).map(i => i.value);
    } else if (alcance === "nacionalidad") {
      talento.nacionalidades = Array.from(block.querySelectorAll(".t-sub-nacionalidad input:checked")).map(i => i.value);
    } else if (alcance === "rareza") {
      talento.rarezas = Array.from(block.querySelectorAll(".t-sub-rareza input:checked")).map(i => i.value);
    } else if (alcance === "sinergia") {
      talento.criterioSinergia = block.querySelector(".t-sinergia-criterio").value;
      talento.cantidadMinima   = parseInt(block.querySelector(".t-sinergia-cantidad").value) || 1;
      talento.valoresCriterio  = Array.from(block.querySelectorAll(".t-sinergia-valores input:checked")).map(i => i.value);
    }

    talentos.push(talento);
  });

  return talentos;
}
