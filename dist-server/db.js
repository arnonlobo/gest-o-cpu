import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getCoverage } from "./catalog.js";
const dataDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "cpu.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_date TEXT NOT NULL,
    prefixo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    cia TEXT NOT NULL,
    setor TEXT NOT NULL,
    bairros_json TEXT NOT NULL,
    militares_json TEXT NOT NULL,
    status TEXT NOT NULL,
    status_started_at INTEGER NOT NULL,
    turno_inicio TEXT NOT NULL,
    turno_fim TEXT NOT NULL,
    restricao_empenho INTEGER NOT NULL DEFAULT 0,
    restricao_empenho_motivo TEXT NOT NULL DEFAULT '',
    current_occurrence_json TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS resource_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    details_json TEXT NOT NULL,
    FOREIGN KEY(resource_id) REFERENCES resources(id)
  );

  CREATE TABLE IF NOT EXISTS controls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_date TEXT NOT NULL,
    tipo TEXT NOT NULL,
    militar TEXT,
    observacao TEXT,
    prefixo_previsto TEXT,
    prefixo_atual TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS escorts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date TEXT NOT NULL,
    escort_date TEXT NOT NULL,
    escort_type TEXT NOT NULL,
    reds TEXT NOT NULL,
    natureza TEXT NOT NULL,
    guarnicao_responsavel_json TEXT NOT NULL,
    responsavel_externo TEXT NOT NULL,
    prefixo_apoio TEXT NOT NULL,
    inicio_ts INTEGER NOT NULL,
    um_militar_na_escolta INTEGER NOT NULL DEFAULT 0,
    militar_escolta TEXT NOT NULL DEFAULT '',
    recurso_liberado INTEGER NOT NULL DEFAULT 0,
    hospital_nome TEXT NOT NULL DEFAULT '',
    origem_turno_data TEXT NOT NULL DEFAULT '',
    observacao TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Ativa',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date TEXT NOT NULL,
    reds TEXT NOT NULL,
    categoria TEXT NOT NULL,
    natureza TEXT NOT NULL,
    resumo TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date TEXT NOT NULL,
    batalhao TEXT NOT NULL,
    cia TEXT NOT NULL,
    turno_nome TEXT NOT NULL,
    data_label TEXT NOT NULL,
    chamada_horarios TEXT NOT NULL,
    lancamento_horarios TEXT NOT NULL,
    viaturas_conforme_escala TEXT NOT NULL,
    previstos INTEGER NOT NULL,
    presentes INTEGER NOT NULL,
    baixas TEXT NOT NULL,
    faltas TEXT NOT NULL,
    slogan TEXT NOT NULL,
    observacoes TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS announcement_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    announcement_id INTEGER NOT NULL,
    bloco TEXT NOT NULL,
    titulo TEXT NOT NULL,
    prefixo TEXT NOT NULL,
    efetivo TEXT NOT NULL,
    observacao TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    FOREIGN KEY(announcement_id) REFERENCES announcements(id)
  );
`);
const resourceColumns = db.prepare("PRAGMA table_info(resources)").all();
if (!resourceColumns.some((column) => column.name === "restricao_empenho")) {
    db.exec("ALTER TABLE resources ADD COLUMN restricao_empenho INTEGER NOT NULL DEFAULT 0");
}
if (!resourceColumns.some((column) => column.name === "restricao_empenho_motivo")) {
    db.exec("ALTER TABLE resources ADD COLUMN restricao_empenho_motivo TEXT NOT NULL DEFAULT ''");
}
db.exec(`
  UPDATE resources
  SET tipo = 'RP'
  WHERE tipo = 'VP';

  UPDATE resources
  SET prefixo = REPLACE(prefixo, 'VP ', 'RP ')
  WHERE prefixo LIKE 'VP %';
`);
function serialize(value) {
    return JSON.stringify(value);
}
function deserialize(value, fallback) {
    if (!value)
        return fallback;
    return JSON.parse(value);
}
function stampOnDate(date, time) {
    return new Date(`${date}T${time}:00`).getTime();
}
function previousDate(shiftDate) {
    const date = new Date(`${shiftDate}T00:00:00`);
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
}
function seedShiftIfNeeded(shiftDate) {
    const existing = db.prepare("SELECT COUNT(*) AS total FROM resources WHERE shift_date = ?").get(shiftDate);
    if (existing.total > 0)
        return;
    const insertResource = db.prepare(`
    INSERT INTO resources (
      shift_date, prefixo, tipo, cia, setor, bairros_json, militares_json, status,
      status_started_at, turno_inicio, turno_fim, restricao_empenho, restricao_empenho_motivo, current_occurrence_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const insertHistory = db.prepare(`
    INSERT INTO resource_history (resource_id, status, started_at, ended_at, details_json)
    VALUES (?, ?, ?, ?, ?)
  `);
    const insertControl = db.prepare(`
    INSERT INTO controls (shift_date, tipo, militar, observacao, prefixo_previsto, prefixo_atual, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    const resources = [
        {
            prefixo: "RP 21456",
            tipo: "RP",
            cia: "26ª Cia",
            setor: "Eldorado",
            militares: ["Sgt João", "Cb Pedro", "Sd Lucas"],
            status: "QCL",
            statusStartedAt: stampOnDate(shiftDate, "07:32"),
            turnoInicio: "07:00",
            turnoFim: "17:00",
            restricaoEmpenho: false,
            restricaoEmpenhoMotivo: "",
            currentOccurrence: null,
            history: [
                { status: "QCL", startedAt: stampOnDate(shiftDate, "07:32"), endedAt: null, details: { note: "Início do turno" } },
            ],
        },
        {
            prefixo: "M 291",
            tipo: "Moto",
            cia: "26ª Cia",
            setor: "JK",
            militares: ["Cb Henrique"],
            status: "Empenhada",
            statusStartedAt: stampOnDate(shiftDate, "14:46"),
            turnoInicio: "14:00",
            turnoFim: "00:00",
            restricaoEmpenho: false,
            restricaoEmpenhoMotivo: "",
            currentOccurrence: {
                natureza: "Ameaça",
                endereco: "Rua das Flores, JK",
                breveHistorico: "Solicitante relata autor no local alterado.",
                monitorar: true,
            },
            history: [
                { status: "QCL", startedAt: stampOnDate(shiftDate, "14:02"), endedAt: stampOnDate(shiftDate, "14:46"), details: { note: "Início do turno" } },
                {
                    status: "Empenhada",
                    startedAt: stampOnDate(shiftDate, "14:46"),
                    endedAt: null,
                    details: {
                        natureza: "Ameaça",
                        endereco: "Rua das Flores, JK",
                        breveHistorico: "Solicitante relata autor no local alterado.",
                        monitorar: true,
                    },
                },
            ],
        },
        {
            prefixo: "BC 01",
            tipo: "Base Comunitária",
            cia: "43ª Cia",
            setor: "Cidade Industrial",
            militares: ["Sgt Tavares", "Cb Bruno"],
            status: "Disponível",
            statusStartedAt: stampOnDate(shiftDate, "14:09"),
            turnoInicio: "14:00",
            turnoFim: "00:00",
            restricaoEmpenho: false,
            restricaoEmpenhoMotivo: "",
            currentOccurrence: null,
            history: [{ status: "Disponível", startedAt: stampOnDate(shiftDate, "14:09"), endedAt: null, details: { note: "Base ativa" } }],
        },
        {
            prefixo: "POP 21533",
            tipo: "POP",
            cia: "132ª Cia",
            setor: "Jardim Riacho",
            militares: ["Sgt Ramon", "Cb Luan", "Sd Afonso"],
            status: "Realizando operação",
            statusStartedAt: stampOnDate(shiftDate, "17:24"),
            turnoInicio: "08:00",
            turnoFim: "18:00",
            restricaoEmpenho: true,
            restricaoEmpenhoMotivo: "Emprego prioritário em operação planejada",
            currentOccurrence: null,
            history: [
                { status: "QCL", startedAt: stampOnDate(shiftDate, "08:06"), endedAt: stampOnDate(shiftDate, "17:24"), details: { note: "Início do turno" } },
                { status: "Realizando operação", startedAt: stampOnDate(shiftDate, "17:24"), endedAt: null, details: { note: "Operação em andamento" } },
            ],
        },
        {
            prefixo: "AP 07",
            tipo: "A pé",
            cia: "186ª Cia",
            setor: "Inconfidentes",
            militares: ["Sd Fábio", "Sd Nathan"],
            status: "OS da ADM",
            statusStartedAt: stampOnDate(shiftDate, "16:48"),
            turnoInicio: "08:30",
            turnoFim: "17:00",
            restricaoEmpenho: false,
            restricaoEmpenhoMotivo: "",
            currentOccurrence: null,
            history: [
                { status: "Disponível", startedAt: stampOnDate(shiftDate, "08:32"), endedAt: stampOnDate(shiftDate, "16:48"), details: { note: "Início do turno" } },
                { status: "OS da ADM", startedAt: stampOnDate(shiftDate, "16:48"), endedAt: null, details: { note: "Apoio administrativo" } },
            ],
        },
        {
            prefixo: "RP 21640",
            tipo: "RP",
            cia: "186ª Cia",
            setor: "Riacho das Pedras",
            militares: ["Sgt Caio", "Sd Breno", "Sd Matos"],
            status: "Disponível",
            statusStartedAt: stampOnDate(shiftDate, "18:19"),
            turnoInicio: "18:00",
            turnoFim: "06:00",
            restricaoEmpenho: true,
            restricaoEmpenhoMotivo: "Viatura com restrição de empenho para apoio setorial",
            currentOccurrence: null,
            history: [{ status: "Disponível", startedAt: stampOnDate(shiftDate, "18:19"), endedAt: null, details: { note: "Recurso liberado" } }],
        },
    ];
    db.transaction(() => {
        for (const resource of resources) {
            const coverage = getCoverage(resource.cia, resource.setor);
            const info = insertResource.run(shiftDate, resource.prefixo, resource.tipo, resource.cia, resource.setor, serialize(coverage?.bairros || []), serialize(resource.militares), resource.status, resource.statusStartedAt, resource.turnoInicio, resource.turnoFim, resource.restricaoEmpenho ? 1 : 0, resource.restricaoEmpenhoMotivo, serialize(resource.currentOccurrence), resource.statusStartedAt);
            const resourceId = Number(info.lastInsertRowid);
            for (const historyEntry of resource.history) {
                insertHistory.run(resourceId, historyEntry.status, historyEntry.startedAt, historyEntry.endedAt, serialize(historyEntry.details));
            }
        }
        insertControl.run(shiftDate, "Licenciado", "Sd Exemplo", "Licença médica", "", "", stampOnDate(shiftDate, "17:00"));
        insertControl.run(shiftDate, "Alteração de prefixo", "", "Troca por indisponibilidade", "RP 34499", "RP 32102", stampOnDate(shiftDate, "17:30"));
    })();
}
export function getDashboard(shiftDate) {
    seedShiftIfNeeded(shiftDate);
    const resourceRows = db
        .prepare("SELECT * FROM resources WHERE shift_date = ? ORDER BY cia, setor, prefixo")
        .all(shiftDate);
    const historyRows = db
        .prepare(`SELECT id, resource_id, status, started_at, ended_at, details_json
       FROM resource_history
       WHERE resource_id IN (SELECT id FROM resources WHERE shift_date = ?)
       ORDER BY started_at ASC`)
        .all(shiftDate);
    const historyByResource = new Map();
    for (const row of historyRows) {
        const collection = historyByResource.get(row.resource_id) || [];
        collection.push({
            id: String(row.id),
            status: row.status,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            details: deserialize(row.details_json, {}),
        });
        historyByResource.set(row.resource_id, collection);
    }
    const resources = resourceRows.map((row) => ({
        id: row.id,
        shiftDate: row.shift_date,
        prefixo: row.prefixo,
        tipo: row.tipo,
        cia: row.cia,
        setor: row.setor,
        bairros: deserialize(row.bairros_json, []),
        militares: deserialize(row.militares_json, []),
        status: row.status,
        statusStartedAt: row.status_started_at,
        turnoInicio: row.turno_inicio,
        turnoFim: row.turno_fim,
        restricaoEmpenho: Boolean(row.restricao_empenho),
        restricaoEmpenhoMotivo: row.restricao_empenho_motivo || "",
        currentOccurrence: deserialize(row.current_occurrence_json, null),
        history: historyByResource.get(row.id) || [],
    }));
    const controls = db
        .prepare(`SELECT id, shift_date, tipo, militar, observacao, prefixo_previsto, prefixo_atual, created_at
       FROM controls
       WHERE shift_date = ?
       ORDER BY created_at DESC`)
        .all(shiftDate)
        .map((row) => ({
        id: row.id,
        shiftDate: row.shift_date,
        tipo: row.tipo,
        militar: row.militar || "",
        observacao: row.observacao || "",
        prefixoPrevisto: row.prefixo_previsto || "",
        prefixoAtual: row.prefixo_atual || "",
        createdAt: row.created_at,
    }));
    const escorts = db
        .prepare(`SELECT *
       FROM escorts
       WHERE record_date = ?
       ORDER BY inicio_ts ASC, created_at ASC`)
        .all(shiftDate)
        .map((row) => ({
        id: row.id,
        recordDate: row.record_date,
        escortDate: row.escort_date,
        escortType: row.escort_type,
        reds: row.reds,
        natureza: row.natureza,
        guarnicaoResponsavel: deserialize(row.guarnicao_responsavel_json, []),
        responsavelExterno: row.responsavel_externo,
        prefixoApoio: row.prefixo_apoio,
        inicioTs: row.inicio_ts,
        umMilitarNaEscolta: Boolean(row.um_militar_na_escolta),
        militarEscolta: row.militar_escolta,
        recursoLiberado: Boolean(row.recurso_liberado),
        hospitalNome: row.hospital_nome,
        origemTurnoData: row.origem_turno_data,
        observacao: row.observacao,
        status: row.status,
        createdAt: row.created_at,
    }));
    const highlights = db
        .prepare(`SELECT *
       FROM highlights
       WHERE record_date = ?
       ORDER BY created_at DESC`)
        .all(shiftDate)
        .map((row) => ({
        id: row.id,
        recordDate: row.record_date,
        reds: row.reds,
        categoria: row.categoria,
        natureza: row.natureza,
        resumo: row.resumo,
        createdAt: row.created_at,
    }));
    const announcements = db
        .prepare(`SELECT *
       FROM announcements
       WHERE record_date = ?
       ORDER BY created_at DESC`)
        .all(shiftDate)
        .map((row) => {
        const items = db
            .prepare(`SELECT *
           FROM announcement_items
           WHERE announcement_id = ?
           ORDER BY order_index ASC, id ASC`)
            .all(row.id)
            .map((item) => ({
            id: item.id,
            bloco: item.bloco,
            titulo: item.titulo,
            prefixo: item.prefixo,
            efetivo: item.efetivo,
            observacao: item.observacao,
            orderIndex: item.order_index,
        }));
        return {
            id: row.id,
            recordDate: row.record_date,
            batalhao: row.batalhao,
            cia: row.cia,
            turnoNome: row.turno_nome,
            dataLabel: row.data_label,
            chamadaHorarios: row.chamada_horarios,
            lancamentoHorarios: row.lancamento_horarios,
            viaturasConformeEscala: row.viaturas_conforme_escala,
            previstos: row.previstos,
            presentes: row.presentes,
            baixas: row.baixas,
            faltas: row.faltas,
            slogan: row.slogan,
            observacoes: row.observacoes,
            items,
            createdAt: row.created_at,
        };
    });
    return { resources, controls, escorts, highlights, announcements };
}
export function insertResource(input) {
    const createdAt = Date.now();
    const coverage = getCoverage(input.cia, input.setor);
    const militares = input.militares.split(",").map((item) => item.trim()).filter(Boolean);
    const info = db.prepare(`INSERT INTO resources (
      shift_date, prefixo, tipo, cia, setor, bairros_json, militares_json, status,
      status_started_at, turno_inicio, turno_fim, restricao_empenho, restricao_empenho_motivo, current_occurrence_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.shiftDate, input.prefixo, input.tipo, input.cia, input.setor, serialize(coverage?.bairros || []), serialize(militares), input.status, createdAt, input.turnoInicio, input.turnoFim, input.restricaoEmpenho ? 1 : 0, input.restricaoEmpenhoMotivo || "", null, createdAt);
    db.prepare(`INSERT INTO resource_history (resource_id, status, started_at, ended_at, details_json)
     VALUES (?, ?, ?, ?, ?)`).run(Number(info.lastInsertRowid), input.status, createdAt, null, serialize({ note: "Recurso lançado no turno" }));
    return Number(info.lastInsertRowid);
}
export function updateResourceStatus(resourceId, input) {
    const startedAt = Date.now();
    const resource = db.prepare("SELECT id FROM resources WHERE id = ?").get(resourceId);
    if (!resource)
        return false;
    db.prepare(`UPDATE resource_history
     SET ended_at = ?
     WHERE resource_id = ? AND ended_at IS NULL`).run(startedAt, resourceId);
    const occurrence = input.status === "Empenhada"
        ? {
            natureza: input.natureza,
            endereco: input.endereco,
            breveHistorico: input.breveHistorico,
            monitorar: input.monitorar,
        }
        : null;
    db.prepare(`INSERT INTO resource_history (resource_id, status, started_at, ended_at, details_json)
     VALUES (?, ?, ?, ?, ?)`).run(resourceId, input.status, startedAt, null, serialize({
        note: input.status === "Empenhada" ? "Empenho lançado" : "Atualização manual",
        natureza: occurrence?.natureza || "",
        endereco: occurrence?.endereco || "",
        breveHistorico: occurrence?.breveHistorico || "",
        monitorar: occurrence?.monitorar || false,
    }));
    db.prepare(`UPDATE resources
     SET status = ?, status_started_at = ?, current_occurrence_json = ?
     WHERE id = ?`).run(input.status, startedAt, serialize(occurrence), resourceId);
    return true;
}
export function insertControl(input) {
    const createdAt = Date.now();
    const info = db.prepare(`INSERT INTO controls (
      shift_date, tipo, militar, observacao, prefixo_previsto, prefixo_atual, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(input.shiftDate, input.tipo, input.militar || "", input.observacao || "", input.prefixoPrevisto || "", input.prefixoAtual || "", createdAt);
    return Number(info.lastInsertRowid);
}
export function insertEscort(input) {
    const createdAt = Date.now();
    const inicioTs = new Date(`${input.escortDate}T${input.inicioHora}:00`).getTime();
    const guarnicaoResponsavel = input.guarnicaoResponsavel
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    const info = db.prepare(`INSERT INTO escorts (
      record_date, escort_date, escort_type, reds, natureza, guarnicao_responsavel_json,
      responsavel_externo, prefixo_apoio, inicio_ts, um_militar_na_escolta, militar_escolta,
      recurso_liberado, hospital_nome, origem_turno_data, observacao, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.recordDate, input.escortDate, input.escortType, input.reds, input.natureza, serialize(guarnicaoResponsavel), input.responsavelExterno || "", input.prefixoApoio || "", inicioTs, input.umMilitarNaEscolta ? 1 : 0, input.militarEscolta || "", input.recursoLiberado ? 1 : 0, input.hospitalNome || "", input.origemTurnoData || "", input.observacao || "", input.status || "Ativa", createdAt);
    return Number(info.lastInsertRowid);
}
export function insertHighlight(input) {
    const createdAt = Date.now();
    const info = db.prepare(`INSERT INTO highlights (record_date, reds, categoria, natureza, resumo, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`).run(input.recordDate, input.reds, input.categoria, input.natureza, input.resumo, createdAt);
    return Number(info.lastInsertRowid);
}
export function insertAnnouncement(input) {
    const createdAt = Date.now();
    const info = db.prepare(`INSERT INTO announcements (
      record_date, batalhao, cia, turno_nome, data_label, chamada_horarios, lancamento_horarios,
      viaturas_conforme_escala, previstos, presentes, baixas, faltas, slogan, observacoes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.recordDate, input.batalhao, input.cia, input.turnoNome, input.dataLabel, input.chamadaHorarios, input.lancamentoHorarios, input.viaturasConformeEscala, input.previstos, input.presentes, input.baixas, input.faltas, input.slogan, input.observacoes, createdAt);
    const announcementId = Number(info.lastInsertRowid);
    const insertItem = db.prepare(`INSERT INTO announcement_items (announcement_id, bloco, titulo, prefixo, efetivo, observacao, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const [index, item] of input.items.entries()) {
        insertItem.run(announcementId, item.bloco || "", item.titulo || "", item.prefixo || "", item.efetivo || "", item.observacao || "", index);
    }
    return announcementId;
}
export function copyPreviousShift(targetDate) {
    const sourceDate = previousDate(targetDate);
    const existingTarget = db.prepare("SELECT COUNT(*) AS total FROM resources WHERE shift_date = ?").get(targetDate);
    if (existingTarget.total > 0) {
        return { ok: false, reason: "A data selecionada já possui viaturas cadastradas." };
    }
    const sourceResources = db
        .prepare("SELECT * FROM resources WHERE shift_date = ? ORDER BY created_at ASC")
        .all(sourceDate);
    if (sourceResources.length === 0) {
        return { ok: false, reason: "Não existe turno anterior cadastrado para copiar." };
    }
    const insertResourceStatement = db.prepare(`INSERT INTO resources (
      shift_date, prefixo, tipo, cia, setor, bairros_json, militares_json, status,
      status_started_at, turno_inicio, turno_fim, restricao_empenho, restricao_empenho_motivo, current_occurrence_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertHistoryStatement = db.prepare(`INSERT INTO resource_history (resource_id, status, started_at, ended_at, details_json)
     VALUES (?, ?, ?, ?, ?)`);
    const startedAt = Date.now();
    db.transaction(() => {
        for (const resource of sourceResources) {
            const coverage = getCoverage(resource.cia, resource.setor);
            const info = insertResourceStatement.run(targetDate, resource.prefixo, resource.tipo, resource.cia, resource.setor, serialize(coverage?.bairros || deserialize(resource.bairros_json, [])), resource.militares_json, "QCL", startedAt, resource.turno_inicio, resource.turno_fim, resource.restricao_empenho, resource.restricao_empenho_motivo, null, startedAt);
            insertHistoryStatement.run(Number(info.lastInsertRowid), "QCL", startedAt, null, serialize({ note: `Escala copiada de ${sourceDate}` }));
        }
    })();
    return { ok: true, sourceDate, total: sourceResources.length };
}
export function buildFinalReport(recordDate) {
    const dashboard = getDashboard(recordDate);
    const escortsText = dashboard.escorts.length === 0
        ? "ESCOLTAS: nenhuma registrada."
        : dashboard.escorts
            .map((escort, index) => {
            const tipo = escort.escortType === "Escolta hospitalar" ? "Escolta hospitalar" : "Escolta";
            const linhas = [
                `${index + 1}. ${tipo} | REDS ${escort.reds || "não informado"} | início ${new Date(escort.inicioTs).toLocaleString("pt-BR")}`,
                `Natureza: ${escort.natureza || "não informada"}`,
                `Guarnição responsável: ${escort.guarnicaoResponsavel.join(" • ") || escort.responsavelExterno || "não informada"}`,
            ];
            if (escort.hospitalNome)
                linhas.push(`Hospital: ${escort.hospitalNome}`);
            if (escort.umMilitarNaEscolta)
                linhas.push(`Militar em escolta: ${escort.militarEscolta || "não informado"}`);
            if (escort.recursoLiberado)
                linhas.push("Recurso liberado para atendimento: SIM");
            if (escort.origemTurnoData)
                linhas.push(`Origem do turno: ${escort.origemTurnoData}`);
            if (escort.observacao)
                linhas.push(`Obs: ${escort.observacao}`);
            return linhas.join("\n");
        })
            .join("\n\n");
    const highlightsText = dashboard.highlights.length === 0
        ? "REDS DE DESTAQUE: nenhum cadastrado."
        : dashboard.highlights
            .map((item, index) => `${index + 1}. [${item.categoria}] REDS ${item.reds || "não informado"} | ${item.natureza}\n${item.resumo}`)
            .join("\n\n");
    const announcementText = dashboard.announcements.length === 0
        ? "ANÚNCIO DE CHAMADA: nenhum cadastrado."
        : dashboard.announcements
            .map((announcement) => {
            const itemsText = announcement.items.length === 0
                ? "*SEM EQUIPES CADASTRADAS*"
                : announcement.items
                    .map((item) => {
                    const parts = [];
                    if (item.bloco)
                        parts.push(`*${item.bloco}*`);
                    if (item.titulo || item.prefixo)
                        parts.push(`🚔 *${item.titulo}${item.prefixo ? ` - ${item.prefixo}` : ""}*`);
                    if (item.efetivo)
                        parts.push(item.efetivo);
                    if (item.observacao)
                        parts.push(item.observacao);
                    return parts.join("\n");
                })
                    .join("\n\n");
            return [
                `*🚨Anúncio de lançamento de turno - ${announcement.batalhao}/ ${announcement.cia}*🚨`,
                "",
                `*1) Data:* ${announcement.dataLabel}`,
                "————————————",
                `*2) Turno:* ${announcement.turnoNome}`,
                "————————————",
                `*3) Horário de chamada:* ${announcement.chamadaHorarios}, lançamento das equipes: ${announcement.lancamentoHorarios}`,
                "————————————",
                `*4) Viaturas lançadas conforme escala?* ${announcement.viaturasConformeEscala}`,
                "————————————",
                `*5) Faltas/ausências:*`,
                `Previstos: ${announcement.previstos}`,
                `Presentes: ${announcement.presentes}`,
                "",
                "————————————",
                "*6) Resumo:*",
                "",
                itemsText,
                "",
                `*BAIXAS:* ${announcement.baixas}.`,
                "",
                `*FALTAS:* ${announcement.faltas}.`,
                "",
                announcement.observacoes ? `${announcement.observacoes}\n` : "",
                `*${announcement.slogan}*`,
            ]
                .filter(Boolean)
                .join("\n");
        })
            .join("\n\n");
    return [
        `RELATÓRIO FINAL CPU - ${new Date(`${recordDate}T00:00:00`).toLocaleDateString("pt-BR")}`,
        "",
        "ESCOLTAS",
        escortsText,
        "",
        "REDS DE DESTAQUE",
        highlightsText,
        "",
        "ANÚNCIO DE CHAMADA",
        announcementText,
    ].join("\n");
}
