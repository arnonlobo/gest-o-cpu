import cors from "cors";
import express from "express";
import { resourceTypes, sectorCatalog, statusOptions } from "./catalog.js";
import {
  buildFinalReport,
  copyPreviousShift,
  getDashboard,
  insertAnnouncement,
  insertControl,
  insertEscort,
  insertHighlight,
  insertResource,
  updateResourceStatus,
} from "./db.js";

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/dashboard", (request, response) => {
  const shiftDate = String(request.query.date || "").slice(0, 10);
  if (!shiftDate) {
    response.status(400).json({ error: "Informe a data do turno." });
    return;
  }

  response.json({
    meta: {
      statusOptions,
      resourceTypes,
      sectorCatalog,
    },
    ...getDashboard(shiftDate),
  });
});

app.post("/api/resources", (request, response) => {
  const resourceId = insertResource(request.body);
  const shiftDate = String(request.body.shiftDate || "").slice(0, 10);
  const dashboard = getDashboard(shiftDate);
  response.status(201).json(dashboard.resources.find((item) => item.id === resourceId));
});

app.patch("/api/resources/:id/status", (request, response) => {
  if (!updateResourceStatus(Number(request.params.id), request.body)) {
    response.status(404).json({ error: "Recurso não encontrado." });
    return;
  }
  response.json({ ok: true });
});

app.post("/api/controls", (request, response) => {
  response.status(201).json({ id: insertControl(request.body) });
});

app.post("/api/shifts/copy-previous", (request, response) => {
  const shiftDate = String(request.body.shiftDate || "").slice(0, 10);
  if (!shiftDate) {
    response.status(400).json({ error: "Informe a data de destino." });
    return;
  }

  const result = copyPreviousShift(shiftDate);
  if (!result.ok) {
    response.status(400).json({ error: result.reason });
    return;
  }

  response.status(201).json(result);
});

app.post("/api/escorts", (request, response) => {
  response.status(201).json({ id: insertEscort(request.body) });
});

app.post("/api/highlights", (request, response) => {
  response.status(201).json({ id: insertHighlight(request.body) });
});

app.post("/api/announcements", (request, response) => {
  response.status(201).json({ id: insertAnnouncement(request.body) });
});

app.get("/api/report", (request, response) => {
  const recordDate = String(request.query.date || "").slice(0, 10);
  if (!recordDate) {
    response.status(400).json({ error: "Informe a data do relatório." });
    return;
  }

  response.json({ text: buildFinalReport(recordDate) });
});

app.listen(port, () => {
  console.log(`CPU API disponível em http://localhost:${port}`);
});
