import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BellRing,
  Building2,
  CalendarDays,
  CarFront,
  ClipboardPen,
  Clock3,
  Filter,
  FileText,
  History,
  Layers3,
  ListChecks,
  LoaderCircle,
  MapPinned,
  Megaphone,
  Radio,
  Save,
  Search,
  ShieldCheck,
  Siren,
} from "lucide-react";

type Status =
  | "Disponível"
  | "QCL"
  | "Empenhada"
  | "Realizando operação"
  | "Abastecimento"
  | "OS da ADM"
  | "Escolta"
  | "Delegacia"
  | "Hospital";

type ResourceType = "RP" | "POP" | "Moto" | "A pé" | "Base Comunitária";

type HistoryEntry = {
  id: string;
  status: Status;
  startedAt: number;
  endedAt: number | null;
  details: {
    note?: string;
    natureza?: string;
    endereco?: string;
    breveHistorico?: string;
    monitorar?: boolean;
  };
};

type Resource = {
  id: number;
  shiftDate: string;
  prefixo: string;
  tipo: ResourceType;
  cia: string;
  setor: string;
  bairros: string[];
  militares: string[];
  status: Status;
  statusStartedAt: number;
  turnoInicio: string;
  turnoFim: string;
  restricaoEmpenho: boolean;
  restricaoEmpenhoMotivo: string;
  history: HistoryEntry[];
  currentOccurrence: {
    natureza: string;
    endereco: string;
    breveHistorico: string;
    monitorar: boolean;
  } | null;
};

type Control = {
  id: number;
  shiftDate: string;
  tipo: string;
  militar: string;
  observacao: string;
  prefixoPrevisto: string;
  prefixoAtual: string;
  createdAt: number;
};

type SectorCatalogItem = {
  cia: string;
  setor: string;
  bairros: string[];
};

type DashboardPayload = {
  meta: {
    statusOptions: Status[];
    resourceTypes: ResourceType[];
    sectorCatalog: SectorCatalogItem[];
  };
  resources: Resource[];
  controls: Control[];
  escorts: Escort[];
  highlights: HighlightOccurrence[];
  announcements: Announcement[];
};

type Escort = {
  id: number;
  recordDate: string;
  escortDate: string;
  escortType: string;
  reds: string;
  natureza: string;
  guarnicaoResponsavel: string[];
  responsavelExterno: string;
  prefixoApoio: string;
  inicioTs: number;
  umMilitarNaEscolta: boolean;
  militarEscolta: string;
  recursoLiberado: boolean;
  hospitalNome: string;
  origemTurnoData: string;
  observacao: string;
  status: string;
  createdAt: number;
};

type HighlightOccurrence = {
  id: number;
  recordDate: string;
  reds: string;
  categoria: string;
  natureza: string;
  resumo: string;
  createdAt: number;
};

type AnnouncementItem = {
  id?: number;
  bloco: string;
  titulo: string;
  prefixo: string;
  efetivo: string;
  observacao: string;
  orderIndex?: number;
};

type Announcement = {
  id: number;
  recordDate: string;
  batalhao: string;
  cia: string;
  turnoNome: string;
  dataLabel: string;
  chamadaHorarios: string;
  lancamentoHorarios: string;
  viaturasConformeEscala: string;
  previstos: number;
  presentes: number;
  baixas: string;
  faltas: string;
  slogan: string;
  observacoes: string;
  items: AnnouncementItem[];
  createdAt: number;
};

const shiftStyles: Record<string, string> = {
  Manhã: "badge-shift badge-shift-morning",
  Tarde: "badge-shift badge-shift-afternoon",
  Noite: "badge-shift badge-shift-night",
  Extra: "badge-shift badge-shift-extra",
};

const statusStyles: Record<Status, string> = {
  Disponível: "badge-status badge-status-disponivel",
  QCL: "badge-status badge-status-qcl",
  Empenhada: "badge-status badge-status-empenhada",
  "Realizando operação": "badge-status badge-status-operacao",
  Abastecimento: "badge-status badge-status-abastecimento",
  "OS da ADM": "badge-status badge-status-adm",
  Escolta: "badge-status badge-status-escolta",
  Delegacia: "badge-status badge-status-delegacia",
  Hospital: "badge-status badge-status-hospital",
};

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = (value || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function getShiftPeriod(turnoInicio: string) {
  const [hour] = (turnoInicio || "00:00").split(":").map(Number);
  if (hour < 12) return "Manhã";
  if (hour < 18) return "Tarde";
  return "Noite";
}

function isResourceInShiftNow(turnoInicio: string, turnoFim: string, nowDate: Date) {
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const start = timeToMinutes(turnoInicio);
  const end = timeToMinutes(turnoFim);
  if (start === end) return true;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}

function isOverflowActive(vehicle: Resource, nowDate: Date) {
  const stillInShift = isResourceInShiftNow(vehicle.turnoInicio, vehicle.turnoFim, nowDate);
  const critical = ["Empenhada", "Realizando operação", "Escolta", "Delegacia", "Hospital"].includes(vehicle.status);
  return !stillInShift && critical;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function rankStatus(status: Status) {
  const order: Record<Status, number> = {
    QCL: 0,
    Disponível: 1,
    Empenhada: 2,
    "Realizando operação": 3,
    Escolta: 4,
    Delegacia: 5,
    Hospital: 6,
    Abastecimento: 7,
    "OS da ADM": 8,
  };
  return order[status] ?? 99;
}

function isAvailable(status: Status) {
  return status === "QCL" || status === "Disponível";
}

function resourceLabel(type: ResourceType) {
  if (type === "RP") return "RP";
  if (type === "POP") return "POP";
  if (type === "Moto") return "Moto";
  if (type === "A pé") return "A pé";
  return "Base";
}

function isMobileResource(type: ResourceType) {
  return type === "RP" || type === "POP" || type === "Moto";
}

function dispatchPriority(vehicle: Resource) {
  if (isAvailable(vehicle.status) && !vehicle.restricaoEmpenho) return 0;
  if (isAvailable(vehicle.status) && vehicle.restricaoEmpenho) return 1;
  return 2;
}

function referenceTimeForDate(shiftDate: string, now: number) {
  if (shiftDate === todayIsoDate()) return new Date(now);
  return new Date(`${shiftDate}T23:59:59`);
}

function resolveShiftWindow(shiftDate: string, turnoInicio: string, turnoFim: string) {
  const start = new Date(`${shiftDate}T${turnoInicio}:00`).getTime();
  let end = new Date(`${shiftDate}T${turnoFim}:00`).getTime();
  if (timeToMinutes(turnoFim) <= timeToMinutes(turnoInicio)) {
    end += 24 * 60 * 60 * 1000;
  }
  return { start, end };
}

function formatShiftClock(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Badge({ children, className = "" }: { children: string; className?: string }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">{subtitle}</p>
    </div>
  );
}

function SmallStat({ label, value, accent = "" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className={`stat-value ${accent}`}>{value}</p>
    </div>
  );
}

function Stepper({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="stepper">
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1;
        const active = step === current;
        const done = step < current;
        return (
          <div key={step} className={`stepper-item ${active ? "stepper-active" : ""} ${done ? "stepper-done" : ""}`}>
            <span>{step}</span>
            <small>{labels[index]}</small>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("consulta");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const [shiftDate, setShiftDate] = useState(todayIsoDate());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [vehicles, setVehicles] = useState<Resource[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [escorts, setEscorts] = useState<Escort[]>([]);
  const [highlights, setHighlights] = useState<HighlightOccurrence[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [statusOptions, setStatusOptions] = useState<Status[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [sectorCatalog, setSectorCatalog] = useState<SectorCatalogItem[]>([]);
  const [filterCia, setFilterCia] = useState("Todas");
  const [filterSetor, setFilterSetor] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [filterPeriodo, setFilterPeriodo] = useState("Todos");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reportText, setReportText] = useState("");
  const [cadastroStep, setCadastroStep] = useState(1);
  const [escortStep, setEscortStep] = useState(1);
  const [announcementStep, setAnnouncementStep] = useState(1);
  const [actionForm, setActionForm] = useState({
    status: "QCL" as Status,
    natureza: "",
    endereco: "",
    breveHistorico: "",
    monitorar: false,
  });
  const [cadastroForm, setCadastroForm] = useState({
    prefixo: "",
    tipo: "RP" as ResourceType,
    cia: "26ª Cia",
    setor: "Eldorado",
    militares: "",
    status: "QCL" as Status,
    turnoInicio: "19:00",
    turnoFim: "01:00",
    restricaoEmpenho: false,
    restricaoEmpenhoMotivo: "",
  });
  const [controlForm, setControlForm] = useState({
    militar: "",
    tipo: "Licenciado",
    observacao: "",
    prefixoPrevisto: "",
    prefixoAtual: "",
  });
  const [escortForm, setEscortForm] = useState({
    escortDate: todayIsoDate(),
    escortType: "Escolta",
    reds: "",
    natureza: "",
    guarnicaoResponsavel: "",
    responsavelExterno: "",
    prefixoApoio: "",
    inicioHora: "18:00",
    umMilitarNaEscolta: false,
    militarEscolta: "",
    recursoLiberado: false,
    hospitalNome: "",
    origemTurnoData: todayIsoDate(),
    observacao: "",
    status: "Ativa",
  });
  const [highlightForm, setHighlightForm] = useState({
    reds: "",
    categoria: "Destaque",
    natureza: "",
    resumo: "",
  });
  const [announcementForm, setAnnouncementForm] = useState({
    batalhao: "1° BPM",
    cia: "",
    turnoNome: "",
    dataLabel: new Date(`${todayIsoDate()}T00:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    chamadaHorarios: "",
    lancamentoHorarios: "",
    viaturasConformeEscala: "NÃO",
    previstos: "0",
    presentes: "0",
    baixas: "NÃO",
    faltas: "NÃO",
    slogan: "⚡CIA PM - AQUI SE FORJAM HERÓIS!!!⚡",
    observacoes: "",
  });
  const [announcementItemForm, setAnnouncementItemForm] = useState<AnnouncementItem>({
    bloco: "",
    titulo: "",
    prefixo: "",
    efetivo: "",
    observacao: "",
  });
  const [announcementItemsDraft, setAnnouncementItemsDraft] = useState<AnnouncementItem[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadDashboard(date: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard?date=${date}`);
      if (!response.ok) throw new Error("Falha ao carregar os dados do turno.");
      const payload = (await response.json()) as DashboardPayload;
      setVehicles(payload.resources);
      setControls(payload.controls);
      setEscorts(payload.escorts);
      setHighlights(payload.highlights);
      setAnnouncements(payload.announcements);
      setStatusOptions(payload.meta.statusOptions);
      setResourceTypes(payload.meta.resourceTypes);
      setSectorCatalog(payload.meta.sectorCatalog);
      if (!payload.resources.some((item) => item.id === selectedId)) {
        setSelectedId(payload.resources[0]?.id ?? null);
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Erro inesperado.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard(shiftDate);
  }, [shiftDate]);

  useEffect(() => {
    setEscortForm((prev) => ({ ...prev, escortDate: shiftDate, origemTurnoData: prev.origemTurnoData || shiftDate }));
    setAnnouncementForm((prev) => ({
      ...prev,
      dataLabel: new Date(`${shiftDate}T00:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    }));
  }, [shiftDate]);

  const companyOptions = useMemo(() => [...new Set(sectorCatalog.map((item) => item.cia))], [sectorCatalog]);
  const shiftOptions = ["Todos", "Manhã", "Tarde", "Noite"];
  const sectorOptions = useMemo(() => {
    const base = filterCia === "Todas" ? sectorCatalog : sectorCatalog.filter((item) => item.cia === filterCia);
    return [...new Set(base.map((item) => item.setor))];
  }, [filterCia, sectorCatalog]);
  const sectorsForSelectedCompany = useMemo(() => sectorCatalog.filter((item) => item.cia === cadastroForm.cia), [cadastroForm.cia, sectorCatalog]);

  useEffect(() => {
    if (filterSetor !== "Todos" && !sectorOptions.includes(filterSetor)) setFilterSetor("Todos");
  }, [filterSetor, sectorOptions]);

  useEffect(() => {
    if (!sectorsForSelectedCompany.some((item) => item.setor === cadastroForm.setor)) {
      setCadastroForm((prev) => ({ ...prev, setor: sectorsForSelectedCompany[0]?.setor || "" }));
    }
  }, [sectorsForSelectedCompany, cadastroForm.setor]);

  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === selectedId) || vehicles[0] || null, [selectedId, vehicles]);

  useEffect(() => {
    if (!selectedVehicle) return;
    setActionForm({
      status: selectedVehicle.status,
      natureza: selectedVehicle.currentOccurrence?.natureza || "",
      endereco: selectedVehicle.currentOccurrence?.endereco || "",
      breveHistorico: selectedVehicle.currentOccurrence?.breveHistorico || "",
      monitorar: Boolean(selectedVehicle.currentOccurrence?.monitorar),
    });
  }, [selectedVehicle]);

  const referenceDate = useMemo(() => referenceTimeForDate(shiftDate, now), [shiftDate, now]);

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...vehicles]
      .filter((vehicle) => {
        const matchesQuery =
          !q ||
          vehicle.prefixo.toLowerCase().includes(q) ||
          vehicle.tipo.toLowerCase().includes(q) ||
          vehicle.cia.toLowerCase().includes(q) ||
          vehicle.setor.toLowerCase().includes(q) ||
          vehicle.status.toLowerCase().includes(q) ||
          vehicle.militares.some((item) => item.toLowerCase().includes(q)) ||
          vehicle.bairros.some((item) => item.toLowerCase().includes(q));
        const matchesCia = filterCia === "Todas" || vehicle.cia === filterCia;
        const matchesSetor = filterSetor === "Todos" || vehicle.setor === filterSetor;
        const matchesStatus = filterStatus === "Todos" || vehicle.status === filterStatus;
        const matchesTipo = filterTipo === "Todos" || vehicle.tipo === filterTipo;
        const matchesPeriodo = filterPeriodo === "Todos" || getShiftPeriod(vehicle.turnoInicio) === filterPeriodo;
        const matchesAvailable = !onlyAvailable || isAvailable(vehicle.status);
        return matchesQuery && matchesCia && matchesSetor && matchesStatus && matchesTipo && matchesPeriodo && matchesAvailable;
      })
      .sort((a, b) => {
        const aOverflow = isOverflowActive(a, referenceDate) ? 0 : 1;
        const bOverflow = isOverflowActive(b, referenceDate) ? 0 : 1;
        if (aOverflow !== bOverflow) return aOverflow - bOverflow;
        if (a.cia !== b.cia) return a.cia.localeCompare(b.cia);
        if (a.setor !== b.setor) return a.setor.localeCompare(b.setor);
        return rankStatus(a.status) - rankStatus(b.status);
      });
  }, [vehicles, query, filterCia, filterSetor, filterStatus, filterTipo, filterPeriodo, onlyAvailable, referenceDate]);

  const overviewGroups = useMemo(
    () =>
      filteredVehicles.reduce<Record<string, Record<string, Resource[]>>>((acc, item) => {
        if (!acc[item.cia]) acc[item.cia] = {};
        if (!acc[item.cia][item.setor]) acc[item.cia][item.setor] = [];
        acc[item.cia][item.setor].push(item);
        return acc;
      }, {}),
    [filteredVehicles],
  );

  const consulta = useMemo(() => {
    const q = query.trim().toLowerCase();
    const coverage =
      sectorCatalog.find((item) => item.bairros.some((bairro) => bairro.toLowerCase() === q)) ||
      sectorCatalog.find((item) => item.setor.toLowerCase() === q) ||
      null;
    const pool = coverage ? filteredVehicles.filter((item) => item.cia === coverage.cia && item.setor === coverage.setor) : filteredVehicles;
    const orderedPool = [...pool].sort((a, b) => {
      const byDispatch = dispatchPriority(a) - dispatchPriority(b);
      if (byDispatch !== 0) return byDispatch;
      return rankStatus(a.status) - rankStatus(b.status);
    });
    const principal = orderedPool[0] || filteredVehicles[0] || vehicles[0] || null;
    if (!principal) return null;
    const support =
      [...filteredVehicles]
        .filter((item) => item.id !== principal.id && item.cia === principal.cia)
        .sort((a, b) => {
          const byDispatch = dispatchPriority(a) - dispatchPriority(b);
          if (byDispatch !== 0) return byDispatch;
          return rankStatus(a.status) - rankStatus(b.status);
        })[0] || null;
    return {
      coverage: coverage || { cia: principal.cia, setor: principal.setor, bairros: principal.bairros },
      principal,
      support,
    };
  }, [filteredVehicles, query, sectorCatalog, vehicles]);

  const monitoredOccurrences = useMemo(() => vehicles.filter((item) => item.currentOccurrence?.monitorar), [vehicles]);

  const managementView = useMemo(() => {
    const referenceTime = referenceDate.getTime();
    const resourcesWithWindow = vehicles.map((vehicle) => {
      const window = resolveShiftWindow(shiftDate, vehicle.turnoInicio, vehicle.turnoFim);
      return { vehicle, ...window };
    });

    const activeNow = resourcesWithWindow
      .filter(({ vehicle, start, end }) => (referenceTime >= start && referenceTime < end) || isOverflowActive(vehicle, referenceDate))
      .sort((a, b) => a.end - b.end);

    const upcomingEntries = resourcesWithWindow
      .filter(({ start }) => start > referenceTime)
      .sort((a, b) => a.start - b.start);

    const upcomingExits = resourcesWithWindow
      .filter(({ vehicle, start, end }) => referenceTime >= start && referenceTime < end && !isOverflowActive(vehicle, referenceDate))
      .sort((a, b) => a.end - b.end);

    if (resourcesWithWindow.length === 0) {
      return {
        activeNow,
        upcomingEntries,
        upcomingExits,
        timeline: [] as Array<{
          ts: number;
          label: string;
          total: number;
          countsByType: Record<ResourceType, number>;
        }>,
        events: [] as Array<{
          kind: "Entrada" | "Saída";
          ts: number;
          vehicle: Resource;
        }>,
        firstEntry: null as null | number,
        lastExit: null as null | number,
        mobileActiveNow: [] as typeof activeNow,
        mobileReady: [] as typeof activeNow,
        mobileRestrictedReady: [] as typeof activeNow,
        mobileBusy: [] as typeof activeNow,
        allMobileBusy: false,
        noMobileReady: false,
        peak: null as null | {
          ts: number;
          label: string;
          total: number;
          countsByType: Record<ResourceType, number>;
        },
        nextChange: null as null | {
          kind: "Entrada" | "Saída";
          ts: number;
          vehicle: Resource;
        },
      };
    }

    const minStart = Math.min(...resourcesWithWindow.map((item) => item.start));
    const maxEnd = Math.max(...resourcesWithWindow.map((item) => item.end));
    const startHour = new Date(minStart);
    startHour.setMinutes(0, 0, 0);
    const endHour = new Date(maxEnd);
    if (endHour.getMinutes() !== 0 || endHour.getSeconds() !== 0 || endHour.getMilliseconds() !== 0) {
      endHour.setHours(endHour.getHours() + 1, 0, 0, 0);
    }

    const timeline: Array<{
      ts: number;
      label: string;
      total: number;
      countsByType: Record<ResourceType, number>;
    }> = [];

    for (let cursor = startHour.getTime(); cursor <= endHour.getTime(); cursor += 60 * 60 * 1000) {
      const activeAtPoint = resourcesWithWindow.filter(({ start, end }) => cursor >= start && cursor < end);
      const countsByType: Record<ResourceType, number> = { RP: 0, POP: 0, Moto: 0, "A pé": 0, "Base Comunitária": 0 };
      for (const item of activeAtPoint) countsByType[item.vehicle.tipo] += 1;
      timeline.push({
        ts: cursor,
        label: formatShiftClock(cursor),
        total: activeAtPoint.length,
        countsByType,
      });
    }

    const events = resourcesWithWindow
      .flatMap(({ vehicle, start, end }) => [
        { kind: "Entrada" as const, ts: start, vehicle },
        { kind: "Saída" as const, ts: end, vehicle },
      ])
      .sort((a, b) => a.ts - b.ts || a.kind.localeCompare(b.kind));

    const peak = timeline.reduce((best, point) => (point.total > best.total ? point : best), timeline[0]);
    const nextChange = events.find((event) => event.ts > referenceTime) || null;

    const mobileActiveNow = activeNow.filter(({ vehicle }) => isMobileResource(vehicle.tipo));
    const mobileReady = mobileActiveNow.filter(({ vehicle }) => isAvailable(vehicle.status) && !vehicle.restricaoEmpenho);
    const mobileRestrictedReady = mobileActiveNow.filter(({ vehicle }) => isAvailable(vehicle.status) && vehicle.restricaoEmpenho);
    const mobileBusy = mobileActiveNow.filter(({ vehicle }) => ["Empenhada", "Realizando operação"].includes(vehicle.status));
    const allMobileBusy =
      mobileActiveNow.length > 0 && mobileBusy.length === mobileActiveNow.length;
    const noMobileReady = mobileActiveNow.length > 0 && mobileReady.length === 0;

    return {
      activeNow,
      upcomingEntries,
      upcomingExits,
      timeline,
      events,
      mobileActiveNow,
      mobileReady,
      mobileRestrictedReady,
      mobileBusy,
      allMobileBusy,
      noMobileReady,
      firstEntry: resourcesWithWindow[0] ? Math.min(...resourcesWithWindow.map((item) => item.start)) : null,
      lastExit: resourcesWithWindow[0] ? Math.max(...resourcesWithWindow.map((item) => item.end)) : null,
      peak,
      nextChange,
    };
  }, [referenceDate, shiftDate, vehicles]);

  const summary = useMemo(
    () => ({
      totalResources: filteredVehicles.length,
      availableResources: filteredVehicles.filter((item) => isAvailable(item.status)).length,
      availableRPs: filteredVehicles.filter((item) => item.tipo === "RP" && isAvailable(item.status) && !item.restricaoEmpenho).length,
      mobileReady: filteredVehicles.filter((item) => isMobileResource(item.tipo) && isAvailable(item.status) && !item.restricaoEmpenho).length,
      monitored: filteredVehicles.filter((item) => item.currentOccurrence?.monitorar).length,
      overflowing: filteredVehicles.filter((item) => isOverflowActive(item, referenceDate)).length,
    }),
    [filteredVehicles, referenceDate],
  );

  const managementChart = useMemo(() => {
    const width = 720;
    const height = 220;
    const padding = 24;
    const points = managementView.timeline;
    const maxTotal = Math.max(1, ...points.map((point) => point.total));

    if (points.length === 0) {
      return {
        width,
        height,
        path: "",
        areaPath: "",
        markers: [] as Array<{ x: number; y: number; point: (typeof points)[number] }>,
        maxTotal,
      };
    }

    const step = points.length === 1 ? 0 : (width - padding * 2) / (points.length - 1);
    const markers = points.map((point, index) => {
      const x = padding + step * index;
      const y = height - padding - ((height - padding * 2) * point.total) / maxTotal;
      return { x, y, point };
    });

    const path = markers.map((marker, index) => `${index === 0 ? "M" : "L"} ${marker.x} ${marker.y}`).join(" ");
    const areaPath = `${path} L ${markers[markers.length - 1].x} ${height - padding} L ${markers[0].x} ${height - padding} Z`;

    return { width, height, path, areaPath, markers, maxTotal };
  }, [managementView.timeline]);

  function getCardClass(vehicle: Resource) {
    if (isOverflowActive(vehicle, referenceDate)) return shiftStyles.Extra;
    return shiftStyles[getShiftPeriod(vehicle.turnoInicio)];
  }

  async function saveAction() {
    if (!selectedVehicle) return;
    const response = await fetch(`/api/resources/${selectedVehicle.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actionForm),
    });
    if (!response.ok) return setError("Não foi possível salvar a atualização do recurso.");
    await loadDashboard(shiftDate);
    setTab("geral");
  }

  async function addVehicle() {
    if (!cadastroForm.prefixo || !cadastroForm.setor) return;
    const response = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftDate, ...cadastroForm }),
    });
    if (!response.ok) return setError("Não foi possível cadastrar o recurso.");
    const created = (await response.json()) as Resource;
    await loadDashboard(shiftDate);
    setSelectedId(created.id);
    setCadastroForm({
      prefixo: "",
      tipo: "RP",
      cia: "26ª Cia",
      setor: "Eldorado",
      militares: "",
      status: "QCL",
      turnoInicio: "19:00",
      turnoFim: "01:00",
      restricaoEmpenho: false,
      restricaoEmpenhoMotivo: "",
    });
    setTab("geral");
  }

  async function addControl() {
    if (controlForm.tipo === "Alteração de prefixo") {
      if (!controlForm.prefixoPrevisto || !controlForm.prefixoAtual) return;
    } else if (!controlForm.militar) {
      return;
    }

    const response = await fetch("/api/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftDate, ...controlForm }),
    });
    if (!response.ok) return setError("Não foi possível salvar o controle complementar.");
    await loadDashboard(shiftDate);
    setControlForm({ militar: "", tipo: "Licenciado", observacao: "", prefixoPrevisto: "", prefixoAtual: "" });
  }

  async function copyPreviousDayShift() {
    setError("");
    setSuccessMessage("");
    const response = await fetch("/api/shifts/copy-previous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftDate }),
    });

    const payload = (await response.json()) as { error?: string; sourceDate?: string; total?: number };
    if (!response.ok) {
      setError(payload.error || "Não foi possível copiar o turno anterior.");
      return;
    }

    setSuccessMessage(`Escala copiada de ${payload.sourceDate} com ${payload.total} viatura(s).`);
    await loadDashboard(shiftDate);
  }

  async function addEscort() {
    const response = await fetch("/api/escorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordDate: shiftDate,
        ...escortForm,
      }),
    });
    if (!response.ok) return setError("Não foi possível salvar a escolta.");
    await loadDashboard(shiftDate);
    setSuccessMessage("Escolta registrada.");
    setEscortForm({
      escortDate: shiftDate,
      escortType: "Escolta",
      reds: "",
      natureza: "",
      guarnicaoResponsavel: "",
      responsavelExterno: "",
      prefixoApoio: "",
      inicioHora: "18:00",
      umMilitarNaEscolta: false,
      militarEscolta: "",
      recursoLiberado: false,
      hospitalNome: "",
      origemTurnoData: shiftDate,
      observacao: "",
      status: "Ativa",
    });
  }

  async function addHighlight() {
    const response = await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordDate: shiftDate,
        ...highlightForm,
      }),
    });
    if (!response.ok) return setError("Não foi possível salvar o REDS de destaque.");
    await loadDashboard(shiftDate);
    setSuccessMessage("Reds de destaque registrado.");
    setHighlightForm({ reds: "", categoria: "Destaque", natureza: "", resumo: "" });
  }

  function addAnnouncementItemDraft() {
    if (!announcementItemForm.titulo && !announcementItemForm.bloco) return;
    setAnnouncementItemsDraft((prev) => [...prev, announcementItemForm]);
    setAnnouncementItemForm({ bloco: "", titulo: "", prefixo: "", efetivo: "", observacao: "" });
  }

  async function addAnnouncement() {
    const response = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordDate: shiftDate,
        ...announcementForm,
        previstos: Number(announcementForm.previstos || 0),
        presentes: Number(announcementForm.presentes || 0),
        items: announcementItemsDraft,
      }),
    });
    if (!response.ok) return setError("Não foi possível salvar o anúncio.");
    await loadDashboard(shiftDate);
    setSuccessMessage("Anúncio de chamada registrado.");
    setAnnouncementItemsDraft([]);
  }

  async function generateReport() {
    const response = await fetch(`/api/report?date=${shiftDate}`);
    const payload = (await response.json()) as { text?: string; error?: string };
    if (!response.ok) return setError(payload.error || "Não foi possível gerar o relatório.");
    setReportText(payload.text || "");
    setSuccessMessage("Relatório final atualizado.");
  }

  if (loading) {
    return (
      <div className="app-shell centered-shell">
        <div className="loading-state">
          <LoaderCircle className="spin" />
          <p>Carregando turno e sincronizando com o SQLite...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="dashboard-frame">
        <header className="dashboard-header">
          <div className="hero-row">
            <div>
              <div className="hero-badge">
                <Radio className="icon-xs" />
                39º BPM • CPU Operacional
              </div>
              <h1>Gestão de turno integrada</h1>
              <p>Painel persistido em SQLite com recursos, ações, controles complementares e leitura rápida por data.</p>
            </div>
            <div className="clock-panel">
              <span>Horário atual</span>
              <strong>
                {new Date(now).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </strong>
            </div>
          </div>

          <div className="toolbar-grid">
            <label className="field-shell">
              <span>
                <CalendarDays className="icon-xs" />
                Data do turno
              </span>
              <input type="date" value={shiftDate} onChange={(event) => setShiftDate(event.target.value)} />
            </label>

            <div className="info-pill">
              <Clock3 className="icon-xs" />
              <div>
                <span>Turno selecionado</span>
                <strong>{formatDateLabel(shiftDate)}</strong>
              </div>
            </div>

            <label className="search-box">
              <Search className="icon-sm" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar bairro, setor, prefixo ou militar" />
            </label>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}
          {successMessage ? <div className="success-banner">{successMessage}</div> : null}
        </header>

        <main className="dashboard-content">
          {tab === "geral" ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="Painel geral" subtitle="Leitura consolidada dos recursos cadastrados para a data do turno." />
              <div className="stats-grid">
                <SmallStat label="Recursos" value={summary.totalResources} />
                <SmallStat label="Disponíveis" value={summary.availableResources} accent="accent-green" />
                <SmallStat label="RPs livres" value={summary.availableRPs} accent="accent-blue" />
                <SmallStat label="Móveis livres" value={summary.mobileReady} accent="accent-blue" />
                <SmallStat label="Monitoradas" value={summary.monitored} accent="accent-amber" />
                <SmallStat label="Estouraram" value={summary.overflowing} accent="accent-red" />
              </div>
              <div className="legend-row">
                <Badge className={shiftStyles.Manhã}>Manhã</Badge>
                <Badge className={shiftStyles.Tarde}>Tarde</Badge>
                <Badge className={shiftStyles.Noite}>Noite</Badge>
                <Badge className={shiftStyles.Extra}>Passou do horário</Badge>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <Filter className="icon-sm" />
                  <p>Filtros</p>
                </div>
                <div className="filter-grid">
                  <select value={filterCia} onChange={(event) => setFilterCia(event.target.value)}>
                    <option value="Todas">Todas as Cias</option>
                    {companyOptions.map((company) => <option key={company} value={company}>{company}</option>)}
                  </select>
                  <select value={filterSetor} onChange={(event) => setFilterSetor(event.target.value)}>
                    <option value="Todos">Todos os setores</option>
                    {sectorOptions.map((setor) => <option key={setor} value={setor}>{setor}</option>)}
                  </select>
                  <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                    <option value="Todos">Todos os status</option>
                    {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <select value={filterTipo} onChange={(event) => setFilterTipo(event.target.value)}>
                    <option value="Todos">Todos os tipos</option>
                    {resourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <select value={filterPeriodo} onChange={(event) => setFilterPeriodo(event.target.value)}>
                  {shiftOptions.map((periodo) => <option key={periodo} value={periodo}>{periodo}</option>)}
                </select>
                <button className={`toggle-button ${onlyAvailable ? "toggle-button-active" : ""}`} onClick={() => setOnlyAvailable((prev) => !prev)}>
                  <ShieldCheck className="icon-sm" />
                  {onlyAvailable ? "Mostrando só disponíveis/QCL" : "Filtrar só disponíveis/QCL"}
                </button>
              </section>
              <div className="stack-lg">
                {Object.keys(overviewGroups).length === 0 ? <div className="empty-state">Nenhum recurso encontrado para os filtros atuais nessa data.</div> : null}
                {Object.entries(overviewGroups).map(([cia, setores]) => {
                  const ciaResources = Object.values(setores).flat();
                  const ciaAvailable = ciaResources.filter((item) => isAvailable(item.status)).length;
                  return (
                    <section key={cia} className="panel">
                      <div className="company-header">
                        <div>
                          <p className="company-name">{cia}</p>
                          <p className="company-meta">{ciaResources.length} recurso(s) • {ciaAvailable} disponível(is)</p>
                        </div>
                        <Layers3 className="icon-md dimmed" />
                      </div>
                      <div className="stack-md">
                        {Object.entries(setores).map(([setor, items]) => {
                          const setorAvailable = items.filter((item) => isAvailable(item.status)).length;
                          return (
                            <div key={setor} className="sector-block">
                              <div className="sector-header">
                                <div>
                                  <p className="sector-name">{setor}</p>
                                  <p className="sector-meta">{items.length} recurso(s) • {setorAvailable} disponível(is)</p>
                                </div>
                                <span>Setor</span>
                              </div>
                              <div className="stack-sm">
                                {items.map((item) => (
                                  <button key={item.id} className={`resource-card ${getCardClass(item)}`} onClick={() => { setSelectedId(item.id); setTab("acao"); }}>
                                    <div className="resource-card-head">
                                      <div>
                                        <p className="resource-title">{item.prefixo}</p>
                                        <div className="resource-badges">
                                          <span className="resource-type">{resourceLabel(item.tipo)}</span>
                                          <Badge className={isOverflowActive(item, referenceDate) ? shiftStyles.Extra : shiftStyles[getShiftPeriod(item.turnoInicio)]}>
                                            {isOverflowActive(item, referenceDate) ? "Extra" : getShiftPeriod(item.turnoInicio)}
                                          </Badge>
                                          {item.restricaoEmpenho ? <Badge className="badge-status badge-status-restricao">Restrição de empenho</Badge> : null}
                                        </div>
                                      </div>
                                      <Badge className={statusStyles[item.status]}>{item.status}</Badge>
                                    </div>
                                    <div className="crew-card">
                                      <p>Guarnição</p>
                                      <strong>{item.militares.join(" • ") || "Sem militares cadastrados"}</strong>
                                    </div>
                                    <div className="resource-card-foot">
                                      <span>{formatDuration(referenceDate.getTime() - item.statusStartedAt)}</span>
                                      <span>{item.turnoInicio} • {item.turnoFim}</span>
                                    </div>
                                    {isOverflowActive(item, referenceDate) ? <p className="overflow-note">Fora do horário previsto, mas segue em acompanhamento.</p> : null}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
          {tab === "gestao" ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="Gestão do dia" subtitle="Leitura cronológica da cobertura, sobreposição de recursos e próximos movimentos do turno." />
              <div className="stats-grid stats-grid-gestao">
                <SmallStat label="Em serviço agora" value={managementView.activeNow.length} accent="accent-green" />
                <SmallStat label="Pico do dia" value={managementView.peak?.total ?? 0} accent="accent-blue" />
                <SmallStat label="Livres c/ restrição" value={managementView.mobileRestrictedReady.length} accent="accent-amber" />
                <SmallStat label="Primeira entrada" value={managementView.firstEntry ? formatShiftClock(managementView.firstEntry) : "--:--"} accent="accent-amber" />
                <SmallStat label="Última saída" value={managementView.lastExit ? formatShiftClock(managementView.lastExit) : "--:--"} accent="accent-red" />
              </div>

              {managementView.allMobileBusy ? (
                <section className="panel panel-alert">
                  <div className="panel-heading danger">
                    <Siren className="icon-sm" />
                    <p>Todas as viaturas móveis estão empenhadas ou em operação</p>
                  </div>
                  <p className="radio-copy">
                    A leitura atual considera apenas `RP`, `POP` e `Moto`. Base comunitária não entra nessa sinalização.
                  </p>
                </section>
              ) : managementView.noMobileReady ? (
                <section className="panel panel-alert-soft">
                  <div className="panel-heading">
                    <ShieldCheck className="icon-sm" />
                    <p>Sem viatura móvel livre sem restrição</p>
                  </div>
                  <p className="radio-copy">
                    Existem apenas recursos móveis ocupados ou com restrição informativa de empenho no momento.
                  </p>
                </section>
              ) : null}

              <section className="panel">
                <div className="panel-heading">
                  <CalendarDays className="icon-sm" />
                  <p>Menu de gerenciamento diário</p>
                </div>
                <p className="radio-copy">
                  Cada data mantém sua própria escala no banco. Troque a data do turno no topo para consultar ou lançar recursos de outros dias.
                </p>
                <div className="chip-row">
                  <button className="chip-button" onClick={() => void copyPreviousDayShift()}>Copiar turno anterior</button>
                  <button className="chip-button" onClick={() => setTab("cadastro")}>Cadastrar viatura do dia</button>
                  <button className="chip-button" onClick={() => setTab("acao")}>Atualizar viatura</button>
                  <button className="chip-button" onClick={() => setTab("controle")}>Controle complementar</button>
                </div>
              </section>

              <div className="management-layout">
                <section className="panel timeline-panel">
                  <div className="panel-heading">
                    <Layers3 className="icon-sm" />
                    <p>Cobertura por faixa horária</p>
                  </div>
                  <p className="radio-copy">
                    Contagem total de recursos escalados no dia, incluindo RP, POP, moto, policiamento a pé e base comunitária.
                  </p>
                  {managementView.timeline.length > 0 ? (
                    <>
                      <div className="timeline-chart-shell">
                        <svg viewBox={`0 0 ${managementChart.width} ${managementChart.height}`} className="timeline-chart" role="img" aria-label="Cobertura por faixa horária">
                          {[0, 1, 2, 3, 4].map((tick) => {
                            const y = managementChart.height - 24 - ((managementChart.height - 48) * tick) / 4;
                            return (
                              <g key={tick}>
                                <line x1="24" y1={y} x2={managementChart.width - 24} y2={y} className="chart-grid-line" />
                                <text x="8" y={y + 4} className="chart-grid-label">
                                  {Math.round((managementChart.maxTotal * tick) / 4)}
                                </text>
                              </g>
                            );
                          })}
                          <path d={managementChart.areaPath} className="chart-area" />
                          <path d={managementChart.path} className="chart-line" />
                          {managementChart.markers.map((marker) => (
                            <g key={marker.point.ts}>
                              <circle cx={marker.x} cy={marker.y} r="4" className={marker.point.total === managementView.peak?.total ? "chart-dot chart-dot-peak" : "chart-dot"} />
                              <text x={marker.x} y={managementChart.height - 8} className="chart-axis-label" textAnchor="middle">
                                {marker.point.label}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                      <div className="timeline-meta-grid">
                        <div className="mini-stat">
                          <span>Pico</span>
                          <strong>{managementView.peak?.total ?? 0} recursos às {managementView.peak?.label ?? "--:--"}</strong>
                        </div>
                        <div className="mini-stat">
                          <span>Próxima mudança</span>
                          <strong>
                            {managementView.nextChange
                              ? `${managementView.nextChange.kind} ${managementView.nextChange.vehicle.prefixo} às ${formatShiftClock(managementView.nextChange.ts)}`
                              : "Sem mudança futura nessa data"}
                          </strong>
                        </div>
                      </div>
                      {managementView.peak ? (
                        <div className="chip-row">
                          <span className="chip">RP {managementView.peak.countsByType.RP}</span>
                          <span className="chip">POP {managementView.peak.countsByType.POP}</span>
                          <span className="chip">Moto {managementView.peak.countsByType.Moto}</span>
                          <span className="chip">A pé {managementView.peak.countsByType["A pé"]}</span>
                          <span className="chip">BC {managementView.peak.countsByType["Base Comunitária"]}</span>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="empty-inline">Sem escala suficiente para montar a cronologia desse dia.</div>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <ShieldCheck className="icon-sm" />
                    <p>Viaturas no turno</p>
                  </div>
                  <div className="stack-sm">
                    {managementView.activeNow.length === 0 ? <div className="empty-inline">Nenhuma viatura em serviço nesse horário.</div> : null}
                    {managementView.activeNow.map(({ vehicle, end }) => (
                      <button key={`active-${vehicle.id}`} className="list-card" onClick={() => { setSelectedId(vehicle.id); setTab("acao"); }}>
                        <div>
                          <strong>{vehicle.prefixo}</strong>
                          <p>{vehicle.cia} • {vehicle.setor} • {vehicle.status}</p>
                          {vehicle.restricaoEmpenho ? <p>Restrição: {vehicle.restricaoEmpenhoMotivo || "Informativa"}</p> : null}
                        </div>
                        <span>Saída {formatShiftClock(end)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="management-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <Radio className="icon-sm" />
                    <p>Viaturas que vão entrar</p>
                  </div>
                  <div className="stack-sm">
                    {managementView.upcomingEntries.length === 0 ? <div className="empty-inline">Nenhuma entrada pendente para essa data.</div> : null}
                    {managementView.upcomingEntries.map(({ vehicle, start }) => (
                      <button key={`entry-${vehicle.id}`} className="list-card" onClick={() => { setSelectedId(vehicle.id); setTab("acao"); }}>
                        <div>
                          <strong>{vehicle.prefixo}</strong>
                          <p>{vehicle.cia} • {vehicle.setor} • {resourceLabel(vehicle.tipo)}</p>
                          {vehicle.restricaoEmpenho ? <p>Restrição: {vehicle.restricaoEmpenhoMotivo || "Informativa"}</p> : null}
                        </div>
                        <span>Entrada {formatShiftClock(start)}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <Clock3 className="icon-sm" />
                    <p>Viaturas que vão sair</p>
                  </div>
                  <div className="stack-sm">
                    {managementView.upcomingExits.length === 0 ? <div className="empty-inline">Nenhuma saída prevista restante para esse horário.</div> : null}
                    {managementView.upcomingExits.map(({ vehicle, end }) => (
                      <button key={`exit-${vehicle.id}`} className="list-card" onClick={() => { setSelectedId(vehicle.id); setTab("acao"); }}>
                        <div>
                          <strong>{vehicle.prefixo}</strong>
                          <p>{vehicle.cia} • {vehicle.setor} • {vehicle.status}</p>
                          {vehicle.restricaoEmpenho ? <p>Restrição: {vehicle.restricaoEmpenhoMotivo || "Informativa"}</p> : null}
                        </div>
                        <span>Saída {formatShiftClock(end)}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <History className="icon-sm" />
                    <p>Agenda cronológica</p>
                  </div>
                  <div className="stack-sm">
                    {managementView.events.length === 0 ? <div className="empty-inline">Sem eventos de escala para exibir.</div> : null}
                    {managementView.events.map((event, index) => (
                      <div key={`${event.kind}-${event.vehicle.id}-${event.ts}-${index}`} className="timeline-event">
                        <span className={`timeline-event-tag ${event.kind === "Entrada" ? "timeline-event-entry" : "timeline-event-exit"}`}>{event.kind}</span>
                        <div className="timeline-event-body">
                          <strong>{event.vehicle.prefixo}</strong>
                          <p>{event.vehicle.cia} • {event.vehicle.setor} • {resourceLabel(event.vehicle.tipo)}</p>
                        </div>
                        <span className="timeline-event-time">{formatShiftClock(event.ts)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          ) : null}
          {tab === "mais" ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="Mais ações" subtitle="Cadastro e rotinas menos frequentes, deixados fora da navegação principal do celular." />
              <section className="panel">
                <div className="panel-heading">
                  <Layers3 className="icon-sm" />
                  <p>Operação e cadastro</p>
                </div>
                <details className="expand-panel">
                  <summary>
                    <span>Ação operacional</span>
                    <small>Atualização rápida de recurso e leitura geral</small>
                  </summary>
                  <div className="quick-grid">
                    <button className="quick-action" onClick={() => setTab("acao")}>
                      <ClipboardPen className="icon-sm" />
                      <strong>Ação do recurso</strong>
                      <span>Atualizar status e histórico</span>
                    </button>
                    <button className="quick-action" onClick={() => setTab("geral")}>
                      <Building2 className="icon-sm" />
                      <strong>Painel geral</strong>
                      <span>Visão completa por Cia e setor</span>
                    </button>
                  </div>
                </details>

                <details className="expand-panel">
                  <summary>
                    <span>Cadastros do dia</span>
                    <small>Viaturas, controles e ocorrências especiais</small>
                  </summary>
                  <div className="quick-grid">
                    <button className="quick-action" onClick={() => setTab("cadastro")}>
                      <CarFront className="icon-sm" />
                      <strong>Cadastrar viatura</strong>
                      <span>Adicionar recurso do dia</span>
                    </button>
                    <button className="quick-action" onClick={() => setTab("controle")}>
                      <ListChecks className="icon-sm" />
                      <strong>Controle</strong>
                      <span>Baixas, faltas e alterações</span>
                    </button>
                    <button className="quick-action" onClick={() => setTab("destaques")}>
                      <BellRing className="icon-sm" />
                      <strong>Destaques</strong>
                      <span>REDS e ocorrências relevantes</span>
                    </button>
                    <button className="quick-action" onClick={() => setTab("anuncio")}>
                      <Megaphone className="icon-sm" />
                      <strong>Anúncio</strong>
                      <span>Efetivo e chamada por CIA</span>
                    </button>
                  </div>
                </details>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <FileText className="icon-sm" />
                  <p>Atalhos rápidos</p>
                </div>
                <div className="chip-row">
                  <button className="chip-button" onClick={() => void copyPreviousDayShift()}>Copiar turno anterior</button>
                  <button className="chip-button" onClick={() => void generateReport()}>Gerar relatório</button>
                </div>
              </section>
            </motion.div>
          ) : null}
          {tab === "consulta" && consulta ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="Consulta imediata" subtitle="Resposta rápida ao COPOM com base no turno selecionado." />
              <section className="panel">
                <div className="panel-heading">
                  <Search className="icon-sm" />
                  <p>Painel principal de despacho</p>
                </div>
                <div className="chip-row">
                  <button className="chip-button" onClick={() => setTab("gestao")}>Abrir gestão cronológica</button>
                  <button className="chip-button" onClick={() => setTab("escoltas")}>Registrar escolta</button>
                  <button className="chip-button" onClick={() => setTab("relatorio")}>Ver relatório</button>
                </div>
              </section>
              <section className="panel panel-highlight">
                <p className="eyebrow">Cobertura encontrada</p>
                <h3>{consulta.coverage.setor}</h3>
                <p className="coverage-company">{consulta.coverage.cia}</p>
                <div className="chip-row">
                  {consulta.coverage.bairros.map((bairro) => <span key={bairro} className="chip">{bairro}</span>)}
                </div>
              </section>
              <section className="panel">
                <div className="resource-card-head">
                  <div>
                    <p className="muted">Recurso sugerido</p>
                    <p className="resource-title">{consulta.principal.prefixo}</p>
                    <div className="resource-badges">
                      <span className="resource-type">{resourceLabel(consulta.principal.tipo)}</span>
                      <Badge className={isOverflowActive(consulta.principal, referenceDate) ? shiftStyles.Extra : shiftStyles[getShiftPeriod(consulta.principal.turnoInicio)]}>
                        {isOverflowActive(consulta.principal, referenceDate) ? "Extra" : getShiftPeriod(consulta.principal.turnoInicio)}
                      </Badge>
                      {consulta.principal.restricaoEmpenho ? <Badge className="badge-status badge-status-restricao">Restrição de empenho</Badge> : null}
                    </div>
                  </div>
                  <Badge className={statusStyles[consulta.principal.status]}>{consulta.principal.status}</Badge>
                </div>
                <div className="crew-card">
                  <p>Guarnição</p>
                  <strong>{consulta.principal.militares.join(" • ") || "Sem militares cadastrados"}</strong>
                </div>
                <div className="resource-card-foot">
                  <span>No status há {formatDuration(referenceDate.getTime() - consulta.principal.statusStartedAt)}</span>
                  <span>{consulta.principal.turnoInicio} • {consulta.principal.turnoFim}</span>
                </div>
              </section>
              <section className="panel">
                <p className="muted">Leitura pronta para rádio</p>
                <p className="radio-copy">Setor {consulta.coverage.setor}, {consulta.coverage.cia}, recurso {consulta.principal.prefixo}, {consulta.principal.tipo.toLowerCase()}, status {consulta.principal.status.toLowerCase()}. {consulta.support ? `Apoio possível ${consulta.support.prefixo}, status ${consulta.support.status.toLowerCase()}.` : "Sem apoio sugerido no momento."}</p>
              </section>
              <details className="expand-panel">
                <summary>
                  <span>Campo expandido de consulta</span>
                  <small>Ver apoio, restrição e observações do recurso sugerido</small>
                </summary>
                <div className="stack-sm expand-body">
                  <div className="list-card">
                    <div>
                      <strong>{consulta.principal.prefixo}</strong>
                      <p>{consulta.principal.cia} • {consulta.principal.setor}</p>
                      <p>Status: {consulta.principal.status}</p>
                      {consulta.principal.restricaoEmpenho ? <p>Restrição: {consulta.principal.restricaoEmpenhoMotivo || "Informativa"}</p> : null}
                    </div>
                    <span>{consulta.principal.turnoInicio} • {consulta.principal.turnoFim}</span>
                  </div>
                  {consulta.support ? (
                    <div className="list-card">
                      <div>
                        <strong>Apoio sugerido: {consulta.support.prefixo}</strong>
                        <p>{consulta.support.cia} • {consulta.support.setor}</p>
                        <p>Status: {consulta.support.status}</p>
                        {consulta.support.restricaoEmpenho ? <p>Restrição: {consulta.support.restricaoEmpenhoMotivo || "Informativa"}</p> : null}
                      </div>
                      <span>{consulta.support.turnoInicio} • {consulta.support.turnoFim}</span>
                    </div>
                  ) : (
                    <div className="empty-inline">Sem apoio adicional sugerido no momento.</div>
                  )}
                </div>
              </details>
              {monitoredOccurrences.length > 0 ? (
                <section className="panel panel-alert">
                  <div className="panel-heading danger">
                    <BellRing className="icon-sm" />
                    <p>Ocorrências monitoradas</p>
                  </div>
                  <div className="stack-sm">
                    {monitoredOccurrences.map((item) => (
                      <div key={item.id} className="monitor-card">
                        <div>
                          <p className="resource-title">{item.prefixo}</p>
                          <p className="muted">{item.currentOccurrence?.natureza || "Ocorrência monitorada"}</p>
                        </div>
                        <span>{formatDuration(referenceDate.getTime() - item.statusStartedAt)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </motion.div>
          ) : null}
          {tab === "acao" && selectedVehicle ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="Ação do recurso" subtitle="Atualize status, lance empenho e grave o histórico no banco." />
              <section className="panel">
                <div className="resource-card-head">
                  <div>
                    <p className="resource-title">{selectedVehicle.prefixo}</p>
                    <p className="muted">{resourceLabel(selectedVehicle.tipo)} • {selectedVehicle.setor} • {selectedVehicle.cia}</p>
                    <div className="resource-badges">
                      <Badge className={isOverflowActive(selectedVehicle, referenceDate) ? shiftStyles.Extra : shiftStyles[getShiftPeriod(selectedVehicle.turnoInicio)]}>
                        {isOverflowActive(selectedVehicle, referenceDate) ? "Extra" : getShiftPeriod(selectedVehicle.turnoInicio)}
                      </Badge>
                      {selectedVehicle.restricaoEmpenho ? <Badge className="badge-status badge-status-restricao">Restrição de empenho</Badge> : null}
                    </div>
                  </div>
                  <Badge className={statusStyles[selectedVehicle.status]}>{selectedVehicle.status}</Badge>
                </div>
                {selectedVehicle.restricaoEmpenho ? (
                  <div className="restriction-note">
                    <strong>Restrição informativa de empenho.</strong> {selectedVehicle.restricaoEmpenhoMotivo || "Verificar antes de direcionar para atendimento."}
                  </div>
                ) : null}
                <div className="crew-card">
                  <p>Guarnição</p>
                  <strong>{selectedVehicle.militares.join(" • ") || "Sem militares cadastrados"}</strong>
                </div>
                <div className="detail-row">
                  <span>Turno</span>
                  <strong>{selectedVehicle.turnoInicio} • {selectedVehicle.turnoFim}</strong>
                </div>
                <div className="detail-row">
                  <span>Status atual há</span>
                  <strong>{formatDuration(referenceDate.getTime() - selectedVehicle.statusStartedAt)}</strong>
                </div>
              </section>
              <section className="panel">
                <p className="muted">Novo status</p>
                <div className="chip-row">
                  {statusOptions.map((status) => (
                    <button key={status} className={`chip-button ${actionForm.status === status ? statusStyles[status] : ""}`} onClick={() => setActionForm((prev) => ({ ...prev, status }))}>
                      {status}
                    </button>
                  ))}
                </div>
              </section>
              {actionForm.status === "Empenhada" ? (
                <section className="panel panel-alert">
                  <div className="panel-heading danger">
                    <Siren className="icon-sm" />
                    <p>Formulário do empenho</p>
                  </div>
                  <div className="stack-sm">
                    <input value={actionForm.natureza} onChange={(event) => setActionForm((prev) => ({ ...prev, natureza: event.target.value }))} placeholder="Tipo da ocorrência" />
                    <input value={actionForm.endereco} onChange={(event) => setActionForm((prev) => ({ ...prev, endereco: event.target.value }))} placeholder="Endereço" />
                    <textarea value={actionForm.breveHistorico} onChange={(event) => setActionForm((prev) => ({ ...prev, breveHistorico: event.target.value }))} placeholder="Breve histórico" rows={4} />
                    <button className={`toggle-button ${actionForm.monitorar ? "toggle-button-danger" : ""}`} onClick={() => setActionForm((prev) => ({ ...prev, monitorar: !prev.monitorar }))}>
                      <BellRing className="icon-sm" />
                      {actionForm.monitorar ? "Ocorrência marcada para monitorar" : "Marcar para monitorar ocorrência"}
                    </button>
                  </div>
                </section>
              ) : null}
              <button className="primary-button" onClick={() => void saveAction()}>
                <Save className="icon-sm" />
                Salvar atualização do recurso
              </button>
              <section className="panel">
                <div className="panel-heading">
                  <History className="icon-sm" />
                  <p>Histórico do recurso</p>
                </div>
                <div className="stack-sm">
                  {[...selectedVehicle.history].reverse().map((entry) => {
                    const isCurrent = !entry.endedAt;
                    const duration = (entry.endedAt || referenceDate.getTime()) - entry.startedAt;
                    return (
                      <div key={entry.id} className="history-card">
                        <div className="resource-card-head">
                          <div>
                            <Badge className={statusStyles[entry.status]}>{entry.status}</Badge>
                            <p className="muted">{formatClock(entry.startedAt)} {entry.endedAt ? `• ${formatClock(entry.endedAt)}` : "• em andamento"}</p>
                          </div>
                          <span>{formatDuration(duration)}</span>
                        </div>
                        {entry.details?.natureza || entry.details?.endereco || entry.details?.breveHistorico || entry.details?.note ? (
                          <div className="history-details">
                            {entry.details.natureza ? <p>Natureza: {entry.details.natureza}</p> : null}
                            {entry.details.endereco ? <p>Endereço: {entry.details.endereco}</p> : null}
                            {entry.details.breveHistorico ? <p>Histórico: {entry.details.breveHistorico}</p> : null}
                            {entry.details.note ? <p>Obs: {entry.details.note}</p> : null}
                            {entry.details.monitorar ? <p className="accent-red">Ocorrência monitorada</p> : null}
                          </div>
                        ) : null}
                        {isCurrent ? <p className="current-note">Situação atual</p> : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            </motion.div>
          ) : null}
          {tab === "cadastro" ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="Cadastro manual" subtitle="Novo recurso persistido na data do turno selecionado." />
              <section className="panel">
                <div className="stack-sm">
                  <input value={cadastroForm.prefixo} onChange={(event) => setCadastroForm((prev) => ({ ...prev, prefixo: event.target.value }))} placeholder="Prefixo do recurso" />
                  <select value={cadastroForm.tipo} onChange={(event) => setCadastroForm((prev) => ({ ...prev, tipo: event.target.value as ResourceType }))}>
                    {resourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <select value={cadastroForm.cia} onChange={(event) => setCadastroForm((prev) => ({ ...prev, cia: event.target.value }))}>
                    {companyOptions.map((company) => <option key={company} value={company}>{company}</option>)}
                  </select>
                  <select value={cadastroForm.setor} onChange={(event) => setCadastroForm((prev) => ({ ...prev, setor: event.target.value }))}>
                    {sectorsForSelectedCompany.map((item) => <option key={`${item.cia}-${item.setor}`} value={item.setor}>{item.setor}</option>)}
                  </select>
                  <div className="split-grid">
                    <input type="time" value={cadastroForm.turnoInicio} onChange={(event) => setCadastroForm((prev) => ({ ...prev, turnoInicio: event.target.value }))} />
                    <input type="time" value={cadastroForm.turnoFim} onChange={(event) => setCadastroForm((prev) => ({ ...prev, turnoFim: event.target.value }))} />
                  </div>
                  <input value={cadastroForm.militares} onChange={(event) => setCadastroForm((prev) => ({ ...prev, militares: event.target.value }))} placeholder="Militares separados por vírgula" />
                  <button className={`toggle-button ${cadastroForm.restricaoEmpenho ? "toggle-button-danger" : ""}`} onClick={() => setCadastroForm((prev) => ({ ...prev, restricaoEmpenho: !prev.restricaoEmpenho }))}>
                    <ShieldCheck className="icon-sm" />
                    {cadastroForm.restricaoEmpenho ? "Viatura com restrição informativa de empenho" : "Marcar restrição informativa de empenho"}
                  </button>
                  {cadastroForm.restricaoEmpenho ? (
                    <input
                      value={cadastroForm.restricaoEmpenhoMotivo}
                      onChange={(event) => setCadastroForm((prev) => ({ ...prev, restricaoEmpenhoMotivo: event.target.value }))}
                      placeholder="Motivo da restrição de empenho"
                    />
                  ) : null}
                  <div>
                    <p className="muted">Status inicial</p>
                    <div className="chip-row">
                      {statusOptions.map((status) => (
                        <button key={status} className={`chip-button ${cadastroForm.status === status ? statusStyles[status] : ""}`} onClick={() => setCadastroForm((prev) => ({ ...prev, status }))}>
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="coverage-box">
                    <div className="panel-heading">
                      <MapPinned className="icon-sm" />
                      <p>Bairros puxados do setor selecionado</p>
                    </div>
                    <div className="chip-row">
                      {(sectorCatalog.find((item) => item.cia === cadastroForm.cia && item.setor === cadastroForm.setor)?.bairros || []).map((bairro) => <span key={bairro} className="chip">{bairro}</span>)}
                    </div>
                  </div>
                  <button className="primary-button" onClick={() => void addVehicle()}>
                    <Save className="icon-sm" />
                    Salvar recurso no turno
                  </button>
                </div>
              </section>
            </motion.div>
          ) : null}
          {tab === "controle" ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="Controle complementar" subtitle="Licenciados, baixas e alteração de prefixo por data." />
              <section className="panel">
                <div className="stack-sm">
                  <select value={controlForm.tipo} onChange={(event) => setControlForm((prev) => ({ ...prev, tipo: event.target.value }))}>
                    <option value="Licenciado">Militar licenciado</option>
                    <option value="Baixou">Militar baixou</option>
                    <option value="Alteração de prefixo">Alteração de prefixo</option>
                  </select>
                  {controlForm.tipo === "Alteração de prefixo" ? (
                    <div className="split-grid">
                      <input value={controlForm.prefixoPrevisto} onChange={(event) => setControlForm((prev) => ({ ...prev, prefixoPrevisto: event.target.value }))} placeholder="Prefixo previsto" />
                      <input value={controlForm.prefixoAtual} onChange={(event) => setControlForm((prev) => ({ ...prev, prefixoAtual: event.target.value }))} placeholder="Prefixo atual" />
                    </div>
                  ) : (
                    <input value={controlForm.militar} onChange={(event) => setControlForm((prev) => ({ ...prev, militar: event.target.value }))} placeholder="Nome do militar" />
                  )}
                  <textarea value={controlForm.observacao} onChange={(event) => setControlForm((prev) => ({ ...prev, observacao: event.target.value }))} placeholder="Observação" rows={3} />
                  <button className="primary-button" onClick={() => void addControl()}>
                    <Save className="icon-sm" />
                    Salvar controle
                  </button>
                </div>
              </section>
              <div className="stack-sm">
                {controls.map((item) => (
                  <section key={item.id} className="panel">
                    <div className="resource-card-head">
                      <p className="resource-title">{item.tipo}</p>
                      <span>{formatClock(item.createdAt)}</span>
                    </div>
                    {item.tipo === "Alteração de prefixo" ? <p className="radio-copy">Previsto: {item.prefixoPrevisto} • Atual: {item.prefixoAtual}</p> : <p className="radio-copy">{item.militar}</p>}
                    {item.observacao ? <p className="muted">{item.observacao}</p> : null}
                  </section>
                ))}
              </div>
            </motion.div>
          ) : null}
          {tab === "escoltas" ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="Escoltas" subtitle="Registro separado por data, com REDS, guarnição responsável, escolta hospitalar e liberação do recurso." />
              <section className="panel">
                <div className="stack-sm">
                  <div className="split-grid">
                    <input type="date" value={escortForm.escortDate} onChange={(event) => setEscortForm((prev) => ({ ...prev, escortDate: event.target.value }))} />
                    <select value={escortForm.escortType} onChange={(event) => setEscortForm((prev) => ({ ...prev, escortType: event.target.value }))}>
                      <option value="Escolta">Escolta</option>
                      <option value="Escolta hospitalar">Escolta hospitalar</option>
                    </select>
                  </div>
                  <div className="split-grid">
                    <input value={escortForm.reds} onChange={(event) => setEscortForm((prev) => ({ ...prev, reds: event.target.value }))} placeholder="REDS" />
                    <input type="time" value={escortForm.inicioHora} onChange={(event) => setEscortForm((prev) => ({ ...prev, inicioHora: event.target.value }))} />
                  </div>
                  <input value={escortForm.natureza} onChange={(event) => setEscortForm((prev) => ({ ...prev, natureza: event.target.value }))} placeholder="Natureza da ocorrência" />
                  <input value={escortForm.guarnicaoResponsavel} onChange={(event) => setEscortForm((prev) => ({ ...prev, guarnicaoResponsavel: event.target.value }))} placeholder="Guarnição responsável pela ocorrência, separada por vírgula" />
                  <input value={escortForm.responsavelExterno} onChange={(event) => setEscortForm((prev) => ({ ...prev, responsavelExterno: event.target.value }))} placeholder="Responsável externo, quando não for do turno" />
                  <div className="split-grid">
                    <input value={escortForm.prefixoApoio} onChange={(event) => setEscortForm((prev) => ({ ...prev, prefixoApoio: event.target.value }))} placeholder="Prefixo do recurso de apoio" />
                    <input type="date" value={escortForm.origemTurnoData} onChange={(event) => setEscortForm((prev) => ({ ...prev, origemTurnoData: event.target.value }))} />
                  </div>
                  {escortForm.escortType === "Escolta hospitalar" ? <input value={escortForm.hospitalNome} onChange={(event) => setEscortForm((prev) => ({ ...prev, hospitalNome: event.target.value }))} placeholder="Hospital" /> : null}
                  <button className={`toggle-button ${escortForm.umMilitarNaEscolta ? "toggle-button-active" : ""}`} onClick={() => setEscortForm((prev) => ({ ...prev, umMilitarNaEscolta: !prev.umMilitarNaEscolta }))}>
                    <ShieldCheck className="icon-sm" />
                    {escortForm.umMilitarNaEscolta ? "Somente um militar na escolta" : "Marcar escolta com apenas um militar"}
                  </button>
                  {escortForm.umMilitarNaEscolta ? <input value={escortForm.militarEscolta} onChange={(event) => setEscortForm((prev) => ({ ...prev, militarEscolta: event.target.value }))} placeholder="Militar que permanecerá na escolta" /> : null}
                  <button className={`toggle-button ${escortForm.recursoLiberado ? "toggle-button-active" : ""}`} onClick={() => setEscortForm((prev) => ({ ...prev, recursoLiberado: !prev.recursoLiberado }))}>
                    <Radio className="icon-sm" />
                    {escortForm.recursoLiberado ? "Recurso liberado para atendimento" : "Marcar recurso liberado para atendimento"}
                  </button>
                  <textarea value={escortForm.observacao} onChange={(event) => setEscortForm((prev) => ({ ...prev, observacao: event.target.value }))} placeholder="Observações da escolta" rows={3} />
                  <button className="primary-button" onClick={() => void addEscort()}><Save className="icon-sm" />Salvar escolta</button>
                </div>
              </section>
              <div className="stack-sm">
                {escorts.map((escort) => (
                  <section key={escort.id} className="panel">
                    <div className="resource-card-head">
                      <div>
                        <p className="resource-title">{escort.escortType} • REDS {escort.reds || "não informado"}</p>
                        <p className="muted">{new Date(escort.inicioTs).toLocaleString("pt-BR")} • {escort.natureza}</p>
                      </div>
                      <Badge className={escort.escortType === "Escolta hospitalar" ? "badge-status badge-status-hospital" : "badge-status badge-status-escolta"}>{escort.escortType}</Badge>
                    </div>
                    <div className="stack-sm">
                      <p className="radio-copy">Guarnição: {escort.guarnicaoResponsavel.join(" • ") || escort.responsavelExterno || "Não informada"}</p>
                      {escort.responsavelExterno ? <p className="radio-copy">Responsável externo: {escort.responsavelExterno}</p> : null}
                      {escort.hospitalNome ? <p className="radio-copy">Hospital: {escort.hospitalNome}</p> : null}
                      {escort.umMilitarNaEscolta ? <p className="radio-copy">Militar que permanece: {escort.militarEscolta}</p> : null}
                      {escort.recursoLiberado ? <p className="accent-green">Recurso liberado para atendimento.</p> : null}
                      {escort.origemTurnoData ? <p className="radio-copy">Origem do turno: {escort.origemTurnoData}</p> : null}
                      {escort.observacao ? <p className="muted">{escort.observacao}</p> : null}
                    </div>
                  </section>
                ))}
              </div>
            </motion.div>
          ) : null}
          {tab === "destaques" ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="REDS de destaque" subtitle="Cadastre ocorrências de destaque, inclusive não violentas, para entrarem no relatório final." />
              <section className="panel">
                <div className="stack-sm">
                  <div className="split-grid">
                    <input value={highlightForm.reds} onChange={(event) => setHighlightForm((prev) => ({ ...prev, reds: event.target.value }))} placeholder="REDS" />
                    <select value={highlightForm.categoria} onChange={(event) => setHighlightForm((prev) => ({ ...prev, categoria: event.target.value }))}>
                      <option value="Destaque">Destaque</option>
                      <option value="Sem crime violento">Sem crime violento</option>
                    </select>
                  </div>
                  <input value={highlightForm.natureza} onChange={(event) => setHighlightForm((prev) => ({ ...prev, natureza: event.target.value }))} placeholder="Natureza" />
                  <textarea value={highlightForm.resumo} onChange={(event) => setHighlightForm((prev) => ({ ...prev, resumo: event.target.value }))} placeholder="Resumo para o relatório" rows={4} />
                  <button className="primary-button" onClick={() => void addHighlight()}><Save className="icon-sm" />Salvar destaque</button>
                </div>
              </section>
              <div className="stack-sm">
                {highlights.map((item) => (
                  <section key={item.id} className="panel">
                    <div className="resource-card-head">
                      <p className="resource-title">{item.categoria} • REDS {item.reds || "não informado"}</p>
                      <span>{new Date(item.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="radio-copy">{item.natureza}</p>
                    <p className="muted">{item.resumo}</p>
                  </section>
                ))}
              </div>
            </motion.div>
          ) : null}
          {tab === "anuncio" ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="Anúncio de chamada" subtitle="Efetivo do batalhão por chamada, separado por CIA e independente das viaturas do turno." />
              <section className="panel">
                <div className="stack-sm">
                  <div className="split-grid">
                    <input value={announcementForm.batalhao} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, batalhao: event.target.value }))} placeholder="Batalhão" />
                    <input value={announcementForm.cia} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, cia: event.target.value }))} placeholder="CIA" />
                  </div>
                  <div className="split-grid">
                    <input value={announcementForm.turnoNome} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, turnoNome: event.target.value }))} placeholder="Turno" />
                    <input value={announcementForm.dataLabel} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, dataLabel: event.target.value }))} placeholder="Data formatada" />
                  </div>
                  <div className="split-grid">
                    <input value={announcementForm.chamadaHorarios} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, chamadaHorarios: event.target.value }))} placeholder="Horário de chamada" />
                    <input value={announcementForm.lancamentoHorarios} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, lancamentoHorarios: event.target.value }))} placeholder="Horário de lançamento" />
                  </div>
                  <div className="split-grid">
                    <select value={announcementForm.viaturasConformeEscala} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, viaturasConformeEscala: event.target.value }))}>
                      <option value="SIM">SIM</option>
                      <option value="NÃO">NÃO</option>
                    </select>
                    <input value={announcementForm.slogan} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, slogan: event.target.value }))} placeholder="Slogan final" />
                  </div>
                  <div className="split-grid">
                    <input value={announcementForm.previstos} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, previstos: event.target.value }))} placeholder="Previstos" />
                    <input value={announcementForm.presentes} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, presentes: event.target.value }))} placeholder="Presentes" />
                  </div>
                  <div className="split-grid">
                    <input value={announcementForm.baixas} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, baixas: event.target.value }))} placeholder="Baixas" />
                    <input value={announcementForm.faltas} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, faltas: event.target.value }))} placeholder="Faltas" />
                  </div>
                  <textarea value={announcementForm.observacoes} onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, observacoes: event.target.value }))} placeholder="Observações extras" rows={3} />

                  <div className="coverage-box">
                    <div className="panel-heading">
                      <Megaphone className="icon-sm" />
                      <p>Equipes do anúncio</p>
                    </div>
                    <div className="stack-sm">
                      <input value={announcementItemForm.bloco} onChange={(event) => setAnnouncementItemForm((prev) => ({ ...prev, bloco: event.target.value }))} placeholder="Bloco, ex.: VIATURAS DE ÁREA" />
                      <div className="split-grid">
                        <input value={announcementItemForm.titulo} onChange={(event) => setAnnouncementItemForm((prev) => ({ ...prev, titulo: event.target.value }))} placeholder="Título, ex.: RP Setor 10" />
                        <input value={announcementItemForm.prefixo} onChange={(event) => setAnnouncementItemForm((prev) => ({ ...prev, prefixo: event.target.value }))} placeholder="Prefixo" />
                      </div>
                      <textarea value={announcementItemForm.efetivo} onChange={(event) => setAnnouncementItemForm((prev) => ({ ...prev, efetivo: event.target.value }))} placeholder="Efetivo, um por linha" rows={3} />
                      <input value={announcementItemForm.observacao} onChange={(event) => setAnnouncementItemForm((prev) => ({ ...prev, observacao: event.target.value }))} placeholder="Observação da equipe" />
                      <button className="toggle-button" onClick={addAnnouncementItemDraft}><Save className="icon-sm" />Adicionar equipe ao anúncio</button>
                      {announcementItemsDraft.map((item, index) => (
                        <div key={`${item.titulo}-${index}`} className="list-card">
                          <div>
                            <strong>{item.titulo || item.bloco}</strong>
                            <p>{item.prefixo}</p>
                          </div>
                          <span>{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button className="primary-button" onClick={() => void addAnnouncement()}><Save className="icon-sm" />Salvar anúncio</button>
                </div>
              </section>
              <div className="stack-sm">
                {announcements.map((announcement) => (
                  <section key={announcement.id} className="panel">
                    <div className="resource-card-head">
                      <p className="resource-title">{announcement.batalhao} / {announcement.cia}</p>
                      <span>{announcement.turnoNome}</span>
                    </div>
                    <p className="radio-copy">Chamada: {announcement.chamadaHorarios} • Lançamento: {announcement.lancamentoHorarios}</p>
                    <p className="radio-copy">Previstos: {announcement.previstos} • Presentes: {announcement.presentes}</p>
                    <p className="muted">{announcement.items.length} equipe(s) cadastrada(s).</p>
                  </section>
                ))}
              </div>
            </motion.div>
          ) : null}
          {tab === "relatorio" ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="stack-lg">
              <SectionTitle title="Relatório final" subtitle="Texto consolidado do dia para copiar e colar com escoltas, REDS de destaque e anúncio de chamada." />
              <section className="panel">
                <div className="panel-heading">
                  <FileText className="icon-sm" />
                  <p>Gerar relatório do dia</p>
                </div>
                <button className="primary-button" onClick={() => void generateReport()}><FileText className="icon-sm" />Atualizar relatório</button>
                <textarea value={reportText} readOnly rows={28} className="report-box" />
              </section>
            </motion.div>
          ) : null}
        </main>
        <nav className="bottom-nav">
          <button className={tab === "gestao" ? "nav-active" : ""} onClick={() => setTab("gestao")}><CalendarDays className="icon-sm" />Gestão</button>
          <button className={tab === "escoltas" ? "nav-active" : ""} onClick={() => setTab("escoltas")}><Siren className="icon-sm" />Escoltas</button>
          <button className={tab === "relatorio" ? "nav-active" : ""} onClick={() => setTab("relatorio")}><FileText className="icon-sm" />Relatório</button>
          <button className={tab === "mais" ? "nav-active" : ""} onClick={() => setTab("mais")}><Layers3 className="icon-sm" />Mais</button>
        </nav>
      </div>
    </div>
  );
}
