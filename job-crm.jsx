import { useState, useMemo, useCallback } from "react";
import { Plus, Search, Download, Upload, Edit3, Trash2, ChevronDown, ChevronUp, ExternalLink, Calendar, DollarSign, User, Building2, FileText, ArrowRight, ArrowLeft, X, BarChart3, Zap, ClipboardPaste, Sparkles, Check, AlertCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════

const STAGES = [
  { id: "encontrada", label: "Encontrada", color: "bg-slate-100 border-slate-300 text-slate-700", dot: "bg-slate-400", emoji: "🔍" },
  { id: "cv_enviado", label: "CV Enviado", color: "bg-blue-50 border-blue-300 text-blue-700", dot: "bg-blue-400", emoji: "📨" },
  { id: "screen", label: "Screen", color: "bg-purple-50 border-purple-300 text-purple-700", dot: "bg-purple-400", emoji: "📞" },
  { id: "tecnica", label: "Técnica", color: "bg-amber-50 border-amber-300 text-amber-700", dot: "bg-amber-400", emoji: "⚙️" },
  { id: "final", label: "Final", color: "bg-emerald-50 border-emerald-300 text-emerald-700", dot: "bg-emerald-400", emoji: "🎯" },
  { id: "oferta", label: "Oferta", color: "bg-green-50 border-green-300 text-green-800", dot: "bg-green-500", emoji: "🎉" },
  { id: "rechazada", label: "Rechazada", color: "bg-red-50 border-red-300 text-red-600", dot: "bg-red-400", emoji: "❌" },
  { id: "descartada", label: "Descartada", color: "bg-gray-50 border-gray-300 text-gray-500", dot: "bg-gray-400", emoji: "🚫" },
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]));

const EMPTY_APP = {
  empresa: "", puesto: "", link: "", etapa: "encontrada",
  contacto: "", contacto_email: "", salario_min: "", salario_max: "", moneda: "USD",
  notas: "", proximos_pasos: "", fecha_aplicacion: "", fecha_followup: "",
  fuente: "", cv_version: "",
};

const SAMPLE_DATA = [
  { ...EMPTY_APP, id: "demo-1", empresa: "TechCorp", puesto: "Product Manager", etapa: "cv_enviado", fecha_aplicacion: "2026-02-10", link: "https://linkedin.com/jobs/123", fuente: "LinkedIn", salario_min: "3000", salario_max: "5000", moneda: "USD", notas: "Match alto con el perfil.", proximos_pasos: "Esperar respuesta de HR", fecha_followup: "2026-02-20" },
  { ...EMPTY_APP, id: "demo-2", empresa: "StartupAI", puesto: "Operations Lead", etapa: "screen", fecha_aplicacion: "2026-02-05", contacto: "María López", contacto_email: "maria@startupai.com", fuente: "Referido", notas: "Screening call agendada", proximos_pasos: "Preparar pitch de 2 min", fecha_followup: "2026-02-18" },
  { ...EMPTY_APP, id: "demo-3", empresa: "GlobalManufacturing", puesto: "Ing. de Procesos Senior", etapa: "encontrada", link: "https://indeed.com/jobs/456", fuente: "Indeed", salario_min: "4000", salario_max: "6000", moneda: "USD" },
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ═══════════════════════════════════════════════════════════════
// MOTOR DE AUTO-POPULATE: Parser de URLs + Extractor de texto
// ═══════════════════════════════════════════════════════════════

// ── Parser de URLs de job boards ──
function parseJobUrl(url) {
  if (!url) return {};
  const result = { link: url };
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    const host = u.hostname.replace("www.", "").toLowerCase();
    const path = u.pathname.toLowerCase();

    // LinkedIn
    if (host.includes("linkedin.com")) {
      result.fuente = "LinkedIn";
      // linkedin.com/jobs/view/job-title-at-company-123456 OR /jobs/view/4325931819
      const viewMatch = path.match(/\/jobs\/view\/(.+?)(?:\/|$)/);
      if (viewMatch) {
        const slug = viewMatch[1].replace(/-\d+$/, ""); // remove trailing ID
        // Si el slug es solo dígitos (ID numérico), no lo usamos como puesto
        const isJustId = /^\d+$/.test(slug);
        if (!isJustId) {
          const parts = slug.split("-at-");
          if (parts.length >= 2) {
            result.puesto = parts[0].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
            result.empresa = parts[1].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          } else {
            result.puesto = slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          }
        }
      }
      // linkedin.com/jobs/collections/... or /jobs/search/...
      const searchParams = u.searchParams;
      if (searchParams.get("keywords")) result.puesto = result.puesto || searchParams.get("keywords");
      if (searchParams.get("company")) result.empresa = result.empresa || searchParams.get("company");
    }

    // Indeed
    else if (host.includes("indeed.com")) {
      result.fuente = "Indeed";
      // indeed.com/viewjob?jk=xxx or /jobs?q=title&l=location
      const q = u.searchParams.get("q");
      if (q) result.puesto = q;
      // /rc/clk/... patterns
      const viewjob = path.match(/\/viewjob/);
      if (viewjob) {
        const title = u.searchParams.get("tk") || u.searchParams.get("q");
        if (title) result.puesto = title;
      }
    }

    // Glassdoor
    else if (host.includes("glassdoor.com")) {
      result.fuente = "Glassdoor";
      // glassdoor.com/job-listing/job-title-company-JV_xxx
      const jobMatch = path.match(/\/job-listing\/(.+?)(?:JV_|$)/i);
      if (jobMatch) {
        const parts = jobMatch[1].replace(/-$/, "").split("-");
        // Last word before JV_ is often the company
        result.puesto = parts.slice(0, -1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    // Computrabajo
    else if (host.includes("computrabajo.com")) {
      result.fuente = "Computrabajo";
      const oferta = path.match(/\/ofertas-de-trabajo\/(.+?)(?:\/|$)/);
      if (oferta) {
        result.puesto = oferta[1].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    // ZonaJobs
    else if (host.includes("zonajobs.com")) {
      result.fuente = "ZonaJobs";
    }

    // Bumeran
    else if (host.includes("bumeran.com")) {
      result.fuente = "Bumeran";
      const empleo = path.match(/\/empleos\/(.+?)(?:\.html|$)/);
      if (empleo) {
        result.puesto = empleo[1].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    // GetOnBoard
    else if (host.includes("getonbrd.com") || host.includes("getonboard.com")) {
      result.fuente = "GetOnBoard";
      // getonbrd.com/jobs/programming/company-slug/job-slug
      const jobParts = path.split("/").filter(Boolean);
      if (jobParts.length >= 3) {
        result.empresa = jobParts[jobParts.length - 2].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        result.puesto = jobParts[jobParts.length - 1].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    // Wellfound (ex AngelList)
    else if (host.includes("wellfound.com") || host.includes("angel.co")) {
      result.fuente = "Wellfound";
      const companyMatch = path.match(/\/company\/([^/]+)/);
      if (companyMatch) {
        result.empresa = companyMatch[1].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    // Lever
    else if (host.includes("lever.co")) {
      result.fuente = "Lever";
      // jobs.lever.co/company-name/job-id
      const leverParts = path.split("/").filter(Boolean);
      if (leverParts.length >= 1) {
        result.empresa = leverParts[0].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    // Greenhouse
    else if (host.includes("greenhouse.io") || host.includes("boards.greenhouse.io")) {
      result.fuente = "Greenhouse";
      // boards.greenhouse.io/company/jobs/id
      const ghParts = path.split("/").filter(Boolean);
      if (ghParts.length >= 1 && ghParts[0] !== "jobs") {
        result.empresa = ghParts[0].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    // Generic: try to get company from subdomain or domain
    else {
      const domainParts = host.split(".");
      if (domainParts.length > 2 && domainParts[0] !== "jobs" && domainParts[0] !== "careers") {
        result.fuente = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
      } else {
        result.fuente = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
      }
      // careers.company.com or jobs.company.com
      if (["careers", "jobs", "boards", "apply"].includes(domainParts[0])) {
        result.empresa = domainParts[1].charAt(0).toUpperCase() + domainParts[1].slice(1);
        result.fuente = result.empresa + " Careers";
      }
    }
  } catch (e) { /* invalid URL, no problem */ }

  return result;
}

// ── Extractor de datos del texto de la descripción ──
function extractFromText(text) {
  if (!text || text.length < 10) return {};
  const result = {};
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // --- Puesto: suele ser la primera línea "fuerte" o la que tiene keywords de puesto ---
  const titleKeywords = /\b(manager|lead|senior|junior|engineer|developer|analyst|designer|director|coordinator|specialist|consultant|ingeniero|jefe|líder|gerente|coordinador|analista|desarrollador|diseñador|head of|vp of|chief)\b/i;
  const titleLine = lines.find(l => titleKeywords.test(l) && l.length < 120);
  if (titleLine && !result.puesto) {
    result.puesto = titleLine.replace(/^[\-•·▪︎►→]+\s*/, "").trim();
  }
  // If first line looks like a title (short, capitalized)
  if (!result.puesto && lines[0] && lines[0].length < 80) {
    const firstLine = lines[0].replace(/^[\-•·▪︎►→]+\s*/, "").trim();
    if (firstLine.length > 3 && !/^(about|acerca|descripción|description|company|empresa|we are|somos)/i.test(firstLine)) {
      result.puesto = firstLine;
    }
  }

  // --- Empresa: look for "at Company", "Company is", "About Company" patterns ---
  const atCompany = text.match(/(?:at|en|@)\s+([A-Z][A-Za-záéíóúñÁÉÍÓÚÑ&.\s]{2,40})(?:\s*[,\-–|]|\s+is|\s+we|\s+está)/);
  if (atCompany) result.empresa = atCompany[1].trim();

  if (!result.empresa) {
    const aboutMatch = text.match(/(?:about|acerca de|sobre)\s+([A-Z][A-Za-záéíóúñÁÉÍÓÚÑ&.\s]{2,40})(?:\n|\.)/);
    if (aboutMatch) result.empresa = aboutMatch[1].trim();
  }

  // --- Salario: múltiples formatos ---
  // USD/ARS/EUR patterns
  const salaryPatterns = [
    // $3,000 - $5,000 / $3000-5000
    /(?:USD|U\$D|U\$S|\$)\s*(\d{1,3}[,.]?\d{3})\s*[-–a]\s*(?:USD|U\$D|U\$S|\$)?\s*(\d{1,3}[,.]?\d{3})/i,
    // 3000 - 5000 USD
    /(\d{1,3}[,.]?\d{3})\s*[-–a]\s*(\d{1,3}[,.]?\d{3})\s*(?:USD|U\$D|dólares|dollars)/i,
    // ARS patterns
    /(?:ARS|\$)\s*(\d{1,3}[,.]?\d{3}[,.]?\d{0,3})\s*[-–a]\s*(?:ARS|\$)?\s*(\d{1,3}[,.]?\d{3}[,.]?\d{0,3})\s*(?:ARS|pesos)?/i,
    // EUR patterns
    /€\s*(\d{1,3}[,.]?\d{3})\s*[-–a]\s*€?\s*(\d{1,3}[,.]?\d{3})/i,
    /(\d{1,3}[,.]?\d{3})\s*[-–a]\s*(\d{1,3}[,.]?\d{3})\s*(?:EUR|€|euros)/i,
    // Single salary: $5000 USD, USD 5000
    /(?:USD|U\$D|U\$S)\s*(\d{1,3}[,.]?\d{3})/i,
    /(\d{1,3}[,.]?\d{3})\s*(?:USD|U\$D|dólares|dollars)/i,
  ];

  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match) {
      const clean = (s) => s ? s.replace(/[,.]/g, "") : "";
      result.salario_min = clean(match[1]);
      if (match[2]) result.salario_max = clean(match[2]);
      // Detect currency
      const ctx = match[0].toLowerCase();
      if (ctx.includes("eur") || ctx.includes("€")) result.moneda = "EUR";
      else if (ctx.includes("ars") || ctx.includes("pesos")) result.moneda = "ARS";
      else result.moneda = "USD";
      break;
    }
  }

  // --- Contacto: buscar emails ---
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (emailMatch) {
    result.contacto_email = emailMatch[0];
    // Try to find name near the email
    const emailIdx = text.indexOf(emailMatch[0]);
    const nearby = text.substring(Math.max(0, emailIdx - 80), emailIdx).trim();
    const nameMatch = nearby.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s*$/);
    if (nameMatch) result.contacto = nameMatch[1];
  }

  // --- Modalidad / ubicación como nota ---
  const modalidad = [];
  if (/\b(remote|remoto|100%?\s*remoto|fully remote|trabajo remoto)\b/i.test(text)) modalidad.push("Remoto");
  if (/\b(hybrid|híbrido|mixto)\b/i.test(text)) modalidad.push("Híbrido");
  if (/\b(on.?site|presencial|en oficina)\b/i.test(text)) modalidad.push("Presencial");
  if (/\b(relocation|reubicación)\b/i.test(text)) modalidad.push("Relocation");

  const locationMatch = text.match(/(?:ubicación|location|sede|base)[:\s]+([^\n,.]{3,50})/i);
  if (locationMatch) modalidad.push(locationMatch[1].trim());

  if (modalidad.length > 0) {
    result.notas = modalidad.join(" | ");
  }

  return result;
}

// ── Merge: URL data + text data con priorización inteligente ──
function mergeExtracted(urlData, textData) {
  const merged = { ...EMPTY_APP };

  // Estrategia: URL tiene prioridad para link/fuente, texto para puesto/empresa/salario/contacto
  // Esto es porque el texto extraído del aviso es más confiable para el contenido
  const urlPriorityFields = ['link', 'fuente'];
  const textPriorityFields = ['puesto', 'empresa', 'salario_min', 'salario_max', 'moneda', 'contacto', 'contacto_email', 'notas'];

  // Aplicar datos de URL para campos de URL-priority
  for (const field of urlPriorityFields) {
    if (urlData[field]) merged[field] = urlData[field];
  }

  // Aplicar datos de texto para campos de text-priority (tienen mayor prioridad)
  for (const field of textPriorityFields) {
    if (textData[field]) {
      merged[field] = textData[field];
    } else if (urlData[field]) {
      // Fallback a URL data solo si texto no tiene el campo
      merged[field] = urlData[field];
    }
  }

  // Para campos restantes, usar lo que esté disponible
  const allFields = Object.keys(EMPTY_APP);
  for (const field of allFields) {
    if (!merged[field] || merged[field] === EMPTY_APP[field]) {
      if (textData[field]) merged[field] = textData[field];
      else if (urlData[field]) merged[field] = urlData[field];
    }
  }

  merged.fecha_aplicacion = new Date().toISOString().slice(0, 10);
  // Default follow-up: 7 días después
  const followup = new Date();
  followup.setDate(followup.getDate() + 7);
  merged.fecha_followup = followup.toISOString().slice(0, 10);
  return merged;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTES UI
// ═══════════════════════════════════════════════════════════════

function StageBadge({ stageId }) {
  const s = STAGE_MAP[stageId];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${s.color}`}>
      <span>{s.emoji}</span> {s.label}
    </span>
  );
}

// ── Quick Add Modal: Pegar link + descripción → auto-populate ──
function QuickAddModal({ onResult, onClose }) {
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState(1); // 1: paste, 2: preview

  const handleParse = () => {
    const urlData = parseJobUrl(url);
    const textData = extractFromText(desc);
    const merged = mergeExtracted(urlData, textData);
    setPreview(merged);
    setStep(2);
  };

  const handlePasteUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith("http") || text.includes(".com") || text.includes(".co"))) {
        setUrl(text);
      }
    } catch { /* clipboard not available */ }
  };

  const handlePasteDesc = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setDesc(text);
    } catch { /* clipboard not available */ }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Quick Add</h2>
              <p className="text-xs text-gray-400">Pegá el link y la descripción, hacemos el resto</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition"><X size={20} /></button>
        </div>

        {step === 1 && (
          <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
            {/* URL input */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Link de la oferta
              </label>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://linkedin.com/jobs/view/..."
                  onPaste={(e) => {
                    // Auto-detect URL on paste
                    setTimeout(() => {
                      const val = e.target.value;
                      if (val && !desc) {
                        // Auto-parse URL immediately on paste
                        const urlData = parseJobUrl(val);
                        if (urlData.fuente) {
                          // Show a subtle hint
                        }
                      }
                    }, 100);
                  }}
                />
                <button
                  onClick={handlePasteUrl}
                  className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition flex-shrink-0"
                  title="Pegar del clipboard"
                >
                  <ClipboardPaste size={16} />
                </button>
              </div>
              {url && (() => {
                const parsed = parseJobUrl(url);
                const tags = [parsed.fuente, parsed.empresa, parsed.puesto].filter(Boolean);
                return tags.length > 0 ? (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {tags.map((t, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-[11px] font-medium">
                        <Check size={10} /> {t}
                      </span>
                    ))}
                    <span className="text-[11px] text-gray-400 self-center">detectado del URL</span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Description paste */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Descripción del puesto (opcional pero recomendado)
                </label>
                <button
                  onClick={handlePasteDesc}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-gray-500 hover:bg-gray-100 transition"
                >
                  <ClipboardPaste size={11} /> Pegar
                </button>
              </div>
              <textarea
                className={inputCls + " h-32 resize-none font-mono text-xs"}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder={"Copiá y pegá acá el texto completo de la oferta.\n\nPor ejemplo, el contenido que ves en LinkedIn, Indeed, etc.\nDe acá extraemos: puesto, empresa, salario, modalidad, contacto..."}
              />
              {desc.length > 20 && (() => {
                const extracted = extractFromText(desc);
                const fields = Object.entries(extracted).filter(([k, v]) => v && k !== "moneda");
                return fields.length > 0 ? (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {fields.map(([k, v]) => (
                      <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-medium">
                        <Sparkles size={10} /> {k.replace(/_/g, " ")}: {String(v).substring(0, 30)}
                      </span>
                    ))}
                    <span className="text-[11px] text-gray-400 self-center">extraído del texto</span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Tip */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex gap-2 text-xs text-amber-700">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p><span className="font-semibold">Tip:</span> Copiá todo el texto del aviso (Ctrl/Cmd+A) para extraer más datos.</p>
            </div>

          </div>
        )}

        {/* Footer step 1 */}
        {step === 1 && (
          <div className="flex justify-end gap-3 px-6 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition">
              Cancelar
            </button>
            <button
              onClick={handleParse}
              disabled={!url && !desc}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
            >
              <Sparkles size={15} /> Extraer datos
            </button>
          </div>
        )}

        {step === 2 && preview && (
          <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-center gap-2">
              <Check size={14} className="text-green-600" />
              <p className="text-xs text-green-700 font-medium">Datos extraídos. Revisá y ajustá lo que necesites.</p>
            </div>

            {/* Preview fields - Grid compacto */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <Building2 size={12} /> Empresa
                </label>
                <input
                  className={inputCls + " text-xs py-1.5"}
                  value={preview.empresa || ""}
                  onChange={e => setPreview(p => ({ ...p, empresa: e.target.value }))}
                  placeholder="Nombre empresa"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <FileText size={12} /> Puesto
                </label>
                <input
                  className={inputCls + " text-xs py-1.5"}
                  value={preview.puesto || ""}
                  onChange={e => setPreview(p => ({ ...p, puesto: e.target.value }))}
                  placeholder="Título del puesto"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <Search size={12} /> Fuente
                </label>
                <input
                  className={inputCls + " text-xs py-1.5"}
                  value={preview.fuente || ""}
                  onChange={e => setPreview(p => ({ ...p, fuente: e.target.value }))}
                  placeholder="LinkedIn, Indeed..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <User size={12} /> Contacto
                </label>
                <input
                  className={inputCls + " text-xs py-1.5"}
                  value={preview.contacto || ""}
                  onChange={e => setPreview(p => ({ ...p, contacto: e.target.value }))}
                  placeholder="Recruiter"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <User size={12} /> Email contacto
              </label>
              <input
                className={inputCls + " text-xs py-1.5"}
                value={preview.contacto_email || ""}
                onChange={e => setPreview(p => ({ ...p, contacto_email: e.target.value }))}
                placeholder="email@empresa.com"
              />
            </div>

            {/* Salary row */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                <DollarSign size={12} /> Rango salarial
              </label>
              <div className="flex gap-2 items-center">
                <select
                  className="px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-xs"
                  value={preview.moneda}
                  onChange={e => setPreview(p => ({ ...p, moneda: e.target.value }))}
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                  <option value="EUR">EUR</option>
                </select>
                <input
                  className={inputCls + " text-xs py-1.5"}
                  type="number"
                  value={preview.salario_min}
                  onChange={e => setPreview(p => ({ ...p, salario_min: e.target.value }))}
                  placeholder="Mín"
                />
                <span className="text-gray-400 text-xs">—</span>
                <input
                  className={inputCls + " text-xs py-1.5"}
                  type="number"
                  value={preview.salario_max}
                  onChange={e => setPreview(p => ({ ...p, salario_max: e.target.value }))}
                  placeholder="Máx"
                />
              </div>
            </div>

            {/* Notas */}
            {preview.notas && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <Sparkles size={12} /> Notas extraídas
                </label>
                <textarea
                  className={inputCls + " h-14 resize-none text-xs"}
                  value={preview.notas}
                  onChange={e => setPreview(p => ({ ...p, notas: e.target.value }))}
                />
              </div>
            )}

          </div>
        )}

        {/* Footer step 2 */}
        {step === 2 && preview && (
          <div className="flex justify-between gap-3 px-6 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition">
              Volver
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => onResult(preview, false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 transition"
              >
                Editar más detalles
              </button>
              <button
                onClick={() => { if (preview.empresa || preview.puesto) onResult(preview, true); }}
                disabled={!preview.empresa && !preview.puesto}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
              >
                <Plus size={15} /> Agregar al pipeline
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal de crear/editar postulación (completo) ──
function AppModal({ app, onSave, onClose, isNew }) {
  const [form, setForm] = useState(app || { ...EMPTY_APP });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const inputCls = "w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition";
  const labelCls = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-800">{isNew ? "Nueva Postulación" : "Editar Postulación"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Empresa *</label>
              <input className={inputCls} value={form.empresa} onChange={e => set("empresa", e.target.value)} placeholder="Nombre de la empresa" />
            </div>
            <div>
              <label className={labelCls}>Puesto *</label>
              <input className={inputCls} value={form.puesto} onChange={e => set("puesto", e.target.value)} placeholder="Título del puesto" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Link de la oferta</label>
              <input className={inputCls} value={form.link} onChange={e => set("link", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className={labelCls}>Etapa</label>
              <select className={inputCls} value={form.etapa} onChange={e => set("etapa", e.target.value)}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fecha de aplicación</label>
              <input type="date" className={inputCls} value={form.fecha_aplicacion} onChange={e => set("fecha_aplicacion", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Fecha follow-up</label>
              <input type="date" className={inputCls} value={form.fecha_followup} onChange={e => set("fecha_followup", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Contacto</label>
              <input className={inputCls} value={form.contacto} onChange={e => set("contacto", e.target.value)} placeholder="Recruiter/hiring manager" />
            </div>
            <div>
              <label className={labelCls}>Email contacto</label>
              <input className={inputCls} value={form.contacto_email} onChange={e => set("contacto_email", e.target.value)} placeholder="email@empresa.com" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Rango salarial</label>
            <div className="flex gap-2 items-center">
              <select className="px-2 py-2 rounded-lg border border-gray-200 bg-white text-sm" value={form.moneda} onChange={e => set("moneda", e.target.value)}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
                <option value="EUR">EUR</option>
              </select>
              <input className={inputCls} type="number" value={form.salario_min} onChange={e => set("salario_min", e.target.value)} placeholder="Mín" />
              <span className="text-gray-400">—</span>
              <input className={inputCls} type="number" value={form.salario_max} onChange={e => set("salario_max", e.target.value)} placeholder="Máx" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fuente</label>
              <input className={inputCls} value={form.fuente} onChange={e => set("fuente", e.target.value)} placeholder="LinkedIn, Indeed, Referido..." />
            </div>
            <div>
              <label className={labelCls}>Versión de CV usada</label>
              <input className={inputCls} value={form.cv_version} onChange={e => set("cv_version", e.target.value)} placeholder="CV_PM_v2, CV_Ops..." />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <textarea className={inputCls + " h-12 resize-none text-xs"} value={form.notas} onChange={e => set("notas", e.target.value)} placeholder="Observaciones, fit cultural..." />
          </div>
          <div>
            <label className={labelCls}>Próximos pasos</label>
            <textarea className={inputCls + " h-12 resize-none text-xs"} value={form.proximos_pasos} onChange={e => set("proximos_pasos", e.target.value)} placeholder="¿Qué sigue?" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-2.5 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition">Cancelar</button>
          <button
            onClick={() => { if (form.empresa && form.puesto) onSave({ ...form, id: form.id || uid() }); }}
            disabled={!form.empresa || !form.puesto}
            className="px-5 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            {isNew ? "Agregar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card de postulación ──
function AppCard({ app, onEdit, onMove, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const stageIdx = STAGES.findIndex(s => s.id === app.etapa);
  const nextStage = stageIdx < STAGES.length - 3 ? STAGES[stageIdx + 1] : null; // no avanzar a rechazada/descartada
  const prevStage = stageIdx > 0 && !["rechazada", "descartada"].includes(app.etapa) ? STAGES[stageIdx - 1] : null;
  const isOverdue = app.fecha_followup && new Date(app.fecha_followup) < new Date() && !["oferta", "rechazada", "descartada"].includes(app.etapa);

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all ${isOverdue ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"}`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-gray-800 text-sm truncate">{app.puesto}</h4>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Building2 size={12} /> {app.empresa}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {app.link && (
              <a href={app.link} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition">
                <ExternalLink size={14} />
              </a>
            )}
            <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {app.salario_min && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
              <DollarSign size={10} /> {app.moneda} {app.salario_min}{app.salario_max ? `-${app.salario_max}` : ""}
            </span>
          )}
          {app.fecha_aplicacion && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
              <Calendar size={10} /> {app.fecha_aplicacion}
            </span>
          )}
          {app.contacto && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
              <User size={10} /> {app.contacto}
            </span>
          )}
          {isOverdue && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium">
              Follow-up vencido
            </span>
          )}
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-600">
            {app.fuente && <p><span className="font-medium text-gray-500">Fuente:</span> {app.fuente}</p>}
            {app.cv_version && <p><span className="font-medium text-gray-500">CV:</span> {app.cv_version}</p>}
            {app.contacto_email && <p><span className="font-medium text-gray-500">Email:</span> {app.contacto_email}</p>}
            {app.notas && <p><span className="font-medium text-gray-500">Notas:</span> {app.notas}</p>}
            {app.proximos_pasos && (
              <div className="bg-blue-50 rounded-lg p-2 text-blue-700">
                <span className="font-medium">Próximos pasos:</span> {app.proximos_pasos}
              </div>
            )}
            {app.fecha_followup && (
              <p className={isOverdue ? "text-red-600 font-medium" : ""}>
                <span className="font-medium">Follow-up:</span> {app.fecha_followup}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
          <div className="flex gap-1">
            <button onClick={() => onEdit(app)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition" title="Editar">
              <Edit3 size={13} />
            </button>
            <button onClick={() => onDelete(app.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition" title="Eliminar">
              <Trash2 size={13} />
            </button>
          </div>
          <div className="flex gap-1">
            {prevStage && (
              <button
                onClick={() => onMove(app.id, prevStage.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
                title={`Retroceder a ${prevStage.label}`}
              >
                <ArrowLeft size={12} /> {prevStage.emoji}
              </button>
            )}
            {nextStage && (
              <button
                onClick={() => onMove(app.id, nextStage.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
                title={`Avanzar a ${nextStage.label}`}
              >
                {nextStage.emoji} <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ──
function Dashboard({ apps }) {
  const activeApps = apps.filter(a => !["rechazada", "descartada"].includes(a.etapa));
  const overdue = apps.filter(a => a.fecha_followup && new Date(a.fecha_followup) < new Date() && !["oferta", "rechazada", "descartada"].includes(a.etapa));
  const conversionRate = apps.length > 0
    ? Math.round((apps.filter(a => ["screen", "tecnica", "final", "oferta"].includes(a.etapa)).length / apps.length) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <p className="text-2xl font-bold text-gray-800">{apps.length}</p>
        <p className="text-xs text-gray-500 mt-1">Total postulaciones</p>
      </div>
      <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
        <p className="text-2xl font-bold text-blue-600">{activeApps.length}</p>
        <p className="text-xs text-gray-500 mt-1">Activas en pipeline</p>
      </div>
      <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
        <p className="text-2xl font-bold text-emerald-600">{conversionRate}%</p>
        <p className="text-xs text-gray-500 mt-1">Tasa de avance</p>
      </div>
      <div className={`bg-white rounded-xl border p-4 shadow-sm ${overdue.length > 0 ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
        <p className={`text-2xl font-bold ${overdue.length > 0 ? "text-red-600" : "text-gray-800"}`}>{overdue.length}</p>
        <p className="text-xs text-gray-500 mt-1">Follow-ups pendientes</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function JobCRM() {
  const [apps, setApps] = useState(SAMPLE_DATA);
  const [modal, setModal] = useState(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("kanban");
  const [showDashboard, setShowDashboard] = useState(true);
  const [filterStage, setFilterStage] = useState("all");

  const saveApp = (app) => {
    setApps(prev => {
      const idx = prev.findIndex(a => a.id === app.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = app; return next; }
      return [...prev, app];
    });
    setModal(null);
  };

  const deleteApp = (id) => setApps(prev => prev.filter(a => a.id !== id));
  const moveApp = (id, newStage) => setApps(prev => prev.map(a => a.id === id ? { ...a, etapa: newStage } : a));

  // Quick Add result handler
  const handleQuickAddResult = (data, addDirectly) => {
    setQuickAdd(false);
    if (addDirectly) {
      // Add directly to pipeline
      saveApp({ ...data, id: uid() });
    } else {
      // Open full modal with pre-filled data
      setModal({ app: data, isNew: true });
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exported: new Date().toISOString(), applications: apps }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `job-crm-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const importData = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => { try { const data = JSON.parse(ev.target.result); if (data.applications) setApps(data.applications); } catch {} };
      reader.readAsText(file);
    };
    input.click();
  };

  const filtered = useMemo(() => {
    let result = apps;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a => a.empresa.toLowerCase().includes(q) || a.puesto.toLowerCase().includes(q) || a.contacto.toLowerCase().includes(q) || a.notas.toLowerCase().includes(q));
    }
    if (filterStage !== "all") result = result.filter(a => a.etapa === filterStage);
    return result;
  }, [apps, search, filterStage]);

  const kanbanStages = STAGES.filter(s => !["rechazada", "descartada"].includes(s.id) || filtered.some(a => a.etapa === s.id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <FileText size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Job Search CRM</h1>
                <p className="text-xs text-gray-400">Pipeline de postulaciones</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-sm" value={filterStage} onChange={e => setFilterStage(e.target.value)}>
                <option value="all">Todas las etapas</option>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
              </select>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button onClick={() => setView("kanban")} className={`px-3 py-1.5 text-xs font-medium transition ${view === "kanban" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Kanban</button>
                <button onClick={() => setView("table")} className={`px-3 py-1.5 text-xs font-medium transition ${view === "table" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Tabla</button>
              </div>
              <button onClick={() => setShowDashboard(!showDashboard)} className={`p-1.5 rounded-lg border transition ${showDashboard ? "bg-blue-50 border-blue-200 text-blue-600" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                <BarChart3 size={16} />
              </button>
              <button onClick={importData} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition" title="Importar JSON"><Upload size={16} /></button>
              <button onClick={exportData} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition" title="Exportar JSON"><Download size={16} /></button>

              {/* ★ QUICK ADD - Botón principal */}
              <button
                onClick={() => setQuickAdd(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-medium shadow-sm transition"
              >
                <Zap size={15} /> Quick Add
              </button>
              <button
                onClick={() => setModal({ app: { ...EMPTY_APP }, isNew: true })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition"
              >
                <Plus size={15} /> Manual
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-4">
        {showDashboard && <Dashboard apps={apps} />}

        {/* Kanban View */}
        {view === "kanban" && (
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
            {kanbanStages.map(stage => {
              const stageApps = filtered.filter(a => a.etapa === stage.id);
              return (
                <div key={stage.id} className="flex-shrink-0 w-72">
                  <div className={`rounded-t-xl px-3 py-2 border-b-2 flex items-center justify-between ${stage.color}`}>
                    <div className="flex items-center gap-2">
                      <span>{stage.emoji}</span>
                      <span className="text-sm font-semibold">{stage.label}</span>
                    </div>
                    <span className="text-xs font-bold bg-white/60 px-2 py-0.5 rounded-full">{stageApps.length}</span>
                  </div>
                  <div className="bg-gray-50/50 rounded-b-xl p-2 space-y-2 min-h-[200px]">
                    {stageApps.map(app => (
                      <AppCard key={app.id} app={app} onEdit={(a) => setModal({ app: a, isNew: false })} onMove={moveApp} onDelete={deleteApp} />
                    ))}
                    {stageApps.length === 0 && <div className="text-center py-8 text-xs text-gray-400">Sin postulaciones</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table View */}
        {view === "table" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Empresa</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Puesto</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Etapa</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Follow-up</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Salario</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Fuente</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(app => {
                  const isOverdue = app.fecha_followup && new Date(app.fecha_followup) < new Date() && !["oferta", "rechazada", "descartada"].includes(app.etapa);
                  return (
                    <tr key={app.id} className={`border-b border-gray-100 hover:bg-gray-50 transition ${isOverdue ? "bg-red-50/50" : ""}`}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        <div className="flex items-center gap-2">
                          {app.empresa}
                          {app.link && <a href={app.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600"><ExternalLink size={12} /></a>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{app.puesto}</td>
                      <td className="px-4 py-3"><StageBadge stageId={app.etapa} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{app.fecha_aplicacion || "—"}</td>
                      <td className={`px-4 py-3 text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>{app.fecha_followup || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{app.salario_min ? `${app.moneda} ${app.salario_min}${app.salario_max ? `-${app.salario_max}` : ""}` : "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{app.fuente || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setModal({ app, isNew: false })} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Edit3 size={14} /></button>
                          <button onClick={() => deleteApp(app.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No hay postulaciones</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {quickAdd && <QuickAddModal onResult={handleQuickAddResult} onClose={() => setQuickAdd(false)} />}
      {modal && <AppModal app={modal.app} isNew={modal.isNew} onSave={saveApp} onClose={() => setModal(null)} />}
    </div>
  );
}
