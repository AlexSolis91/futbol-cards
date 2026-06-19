// ============================================================
// CARD-UTILS.JS — Utilidades compartidas para cartas
// ============================================================

export const PAISES = [
  ["Argentina","AR"],["Brasil","BR"],["Uruguay","UY"],["Chile","CL"],
  ["Colombia","CO"],["Paraguay","PY"],["Perú","PE"],["Ecuador","EC"],
  ["Venezuela","VE"],["Bolivia","BO"],["México","MX"],["Estados Unidos","US"],
  ["Canadá","CA"],["Costa Rica","CR"],["Honduras","HN"],["Panamá","PA"],
  ["Jamaica","JM"],["Guatemala","GT"],["El Salvador","SV"],["España","ES"],
  ["Portugal","PT"],["Francia","FR"],["Inglaterra","GB"],["Alemania","DE"],
  ["Italia","IT"],["Países Bajos","NL"],["Bélgica","BE"],["Croacia","HR"],
  ["Polonia","PL"],["Suiza","CH"],["Austria","AT"],["Dinamarca","DK"],
  ["Suecia","SE"],["Noruega","NO"],["Escocia","GB"],["Gales","GB"],
  ["Irlanda","IE"],["Rusia","RU"],["Ucrania","UA"],["Turquía","TR"],
  ["Grecia","GR"],["República Checa","CZ"],["Eslovaquia","SK"],["Hungría","HU"],
  ["Rumania","RO"],["Serbia","RS"],["Bosnia y Herzegovina","BA"],["Senegal","SN"],
  ["Marruecos","MA"],["Nigeria","NG"],["Ghana","GH"],["Camerún","CM"],
  ["Egipto","EG"],["Argelia","DZ"],["Túnez","TN"],["Costa de Marfil","CI"],
  ["Mali","ML"],["Japón","JP"],["Corea del Sur","KR"],["Arabia Saudita","SA"],
  ["Qatar","QA"],["Irán","IR"],["Australia","AU"],["China","CN"],
  ["Sudáfrica","ZA"],["Nueva Zelanda","NZ"],
];

export const POSICIONES = [
  { value:"GK",  label:"GK — Portero" },
  { value:"LD",  label:"LD — Lateral Derecho" },
  { value:"LI",  label:"LI — Lateral Izquierdo" },
  { value:"DFC", label:"DFC — Defensa Central" },
  { value:"MCD", label:"MCD — Mediocentro Defensivo" },
  { value:"MD",  label:"MD — Volante Derecho" },
  { value:"MI",  label:"MI — Volante Izquierdo" },
  { value:"MC",  label:"MC — Mediocentro" },
  { value:"MCO", label:"MCO — Mediocentro Ofensivo" },
  { value:"MP",  label:"MP — Media Punta" },
  { value:"ED",  label:"ED — Extremo Derecho" },
  { value:"EI",  label:"EI — Extremo Izquierdo" },
  { value:"SD",  label:"SD — Segundo Delantero" },
  { value:"DC",  label:"DC — Delantero Centro" },
];

export const RAREZAS = [
  { value:"Estándar",      css:"rareza-estandar" },
  { value:"Franquicia",    css:"rareza-franquicia" },
  { value:"Elite",         css:"rareza-elite" },
  { value:"Elite Mundial", css:"rareza-elite-mundial" },
  { value:"Leyenda",       css:"rareza-leyenda" },
];

// La rareza ya NO se elige a mano: se calcula a partir de la
// valoración natural de cada VERSIÓN del jugador.
export const RAREZA_RANGOS = [
  { rareza:"Estándar",      min:1,  max:69 },
  { rareza:"Franquicia",    min:70, max:79 },
  { rareza:"Elite",         min:80, max:89 },
  { rareza:"Elite Mundial", min:90, max:95 },
  { rareza:"Leyenda",       min:96, max:99 },
];

export function calcularRareza(valoracion) {
  const v = Number(valoracion);
  if (!v) return "Estándar";
  const tier = RAREZA_RANGOS.find(r => v >= r.min && v <= r.max);
  if (tier) return tier.rareza;
  return v > 99 ? "Leyenda" : "Estándar";
}

// Ratio de drop en sobres: fijo por rareza, no se elige a mano.
export const RAREZA_DROP_RATE = {
  "Estándar":      49.99,
  "Franquicia":    30,
  "Elite":         15,
  "Elite Mundial": 5,
  "Leyenda":       0.01,
};

export function calcularDropRate(valoracion) {
  const rareza = calcularRareza(valoracion);
  return RAREZA_DROP_RATE[rareza] ?? 0;
}

export const BONIF_VALS = [5,4,3,2,1,0,-1,-2,-3,-4,-5];

export const ESTRATEGIAS_OF = [
  { id:"bof_contraataque", key:"contraataque", label:"Contraataque" },
  { id:"bof_posesion",     key:"posesion",     label:"Juego de Posesión (Tiki-Taka)" },
  { id:"bof_presion",      key:"presionAlta",  label:"Presión Alta (Gegenpressing)" },
  { id:"bof_directo",      key:"juegoDirecto", label:"Juego Directo" },
];

export const ESTRATEGIAS_DEF = [
  { id:"bdef_bloquebajo",  key:"bloqueBajo",    label:"Bloque Bajo" },
  { id:"bdef_bloquealto",  key:"bloqueAlto",    label:"Bloque Alto" },
  { id:"bdef_zona",        key:"zona",          label:"Defensa por Zona" },
  { id:"bdef_marcaje",     key:"marcajeHombre", label:"Marcaje al Hombre" },
];

export function flagEmoji(code) {
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(127397 + c.charCodeAt(0))
  );
}

export function paisACodigo(nombre) {
  const m = PAISES.find(([n]) => n === nombre);
  return m ? m[1] : null;
}

export function rarezaCSS(rareza) {
  const r = RAREZAS.find(r => r.value === rareza);
  return r ? r.css : "rareza-estandar";
}

// Construye el HTML de una carta de jugador.
// `d` puede traer rareza ya calculada (d.rareza) o se calcula aquí
// a partir de d.valoracionNatural si no viene.
export function buildCardHTML(d) {
  const codigo  = paisACodigo(d.nacionalidad);
  const flag    = codigo ? flagEmoji(codigo) : "🏳️";
  const rareza  = d.rareza || calcularRareza(d.valoracionNatural);
  const css     = rarezaCSS(rareza);
  const imgHTML = d.imagenURL
    ? `<img class="card-img" src="${d.imagenURL}" alt="${d.nombre}" />`
    : `<div class="card-img-placeholder">Sin foto</div>`;

  return `
    <div class="player-card ${css}" data-id="${d.id || ''}">
      ${imgHTML}
      <div class="card-info">
        <div class="card-info-top">
          <span class="card-rating">${d.valoracionNatural ?? '--'}</span>
          <span class="card-pos">${d.posicionNatural || ''}</span>
        </div>
        <div class="card-name">${d.nombre}</div>
        <div class="card-info-bottom">
          <span class="card-rareza-label">${rareza}</span>
        </div>
      </div>
    </div>`;
}
