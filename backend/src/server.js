import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import xss from "xss-clean";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import ExpressBrute from "express-brute";
import { apiLimiter } from "./middleware/rateLimit.js";
import { auditMiddleware } from "./audit/auditMiddleware.js";
import { logger } from "./utils/logger.js";
import { sendError, sendSuccess } from "./utils/responseHelper.js";
import { supabaseAdmin } from "./config/supabaseAdmin.js";
import { setupSwagger } from "./config/swagger.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { allocationController } from "./controllers/allocationController.js";

// Rotas
import adminUsersRouter from "./routes/adminUsers.js";
import adminBaseRouter from "./routes/adminBase.js";
import reportRoutes from "./routes/report.js";
import authRoutes from "./routes/auth.js";
import notesRoutes from "./routes/notes.js";
import syncRoutes from "./routes/sync.js";
import clientsRoutes from "./routes/clients.js";
import projectRoutes from "./routes/projects.js";
import tasksRoutes from "./routes/tasks.js";
import timesheetsRoutes from "./routes/timesheets.js";
import auditLogsRoutes from "./routes/auditLogs.js";
import collaboratorRoutes from "./routes/collaborators.js";
import supportRoutes from "./routes/support.js";
import organizationRoutes from "./routes/organizationRoutes.js";

const app = express();
app.set('trust proxy', 1);

// 1. CORS - Registro inicial e robusto
const defaultOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "https://gestao.nic-labs.com",
    "https://api-gestao.nic-labs.com"
];
const envOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()) || [];
const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);

app.use(cors({
    origin: (origin, callback) => {
        const isAllowed = !origin ||
            allowedOrigins.has(origin) ||
            (process.env.CORS_ORIGIN?.trim() === "*");

        if (isAllowed) {
            callback(null, true);
        } else {
            logger.warn(`Origin negada pelo CORS: ${origin}`, "CORS");
            callback(null, false);
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type", "Authorization", "X-Requested-With", "Accept",
        "Origin", "apikey", "ngrok-skip-browser-warning", "Prefer"
    ],
    exposedHeaders: ["Content-Disposition"]
}));

// Preflight OPTIONS Global
app.options('*', cors());

// 2. Middlewares de Segurança e Parser
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(xss());
app.use(mongoSanitize());
app.use(hpp());

const store = new ExpressBrute.MemoryStore();
const bruteForce = new ExpressBrute(store);
const startTime = Date.now();

// 3. Auditoria e Logs
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, "HTTP");
    next();
});
app.use(auditMiddleware);

// 4. Rate Limiting aplicado a todas as rotas de API
app.use("/api", apiLimiter);

// 5. Documentação
setupSwagger(app);

// 6. Healthcheck
app.get("/health", async (req, res) => {
    try {
        const { error } = await supabaseAdmin.from('system_settings').select('key').limit(1);
        return sendSuccess(res, {
            status: "ok",
            database: error ? 'error' : 'connected',
            uptime: `${Math.floor((Date.now() - startTime) / 1000)}s`
        });
    } catch (err) {
        return sendError(res, "Healthcheck failed", 500);
    }
});

// 7. Rotas da API
const apiV1 = express.Router();

apiV1.use("/auth", bruteForce.prevent, authRoutes);
apiV1.use("/clientes", clientsRoutes);
apiV1.use("/projetos", projectRoutes);
apiV1.use("/tarefas", tasksRoutes);
apiV1.use("/colaboradores", collaboratorRoutes);
apiV1.use("/timesheets", timesheetsRoutes);
apiV1.use("/support", supportRoutes);
apiV1.use("/sync", syncRoutes);
apiV1.use("/notes", notesRoutes);
apiV1.use("/audit-logs", auditLogsRoutes);
apiV1.use("/organizations", organizationRoutes);

// Allocations v1
apiV1.get("/allocations", authMiddleware, allocationController.list);
apiV1.post("/allocations", authMiddleware, allocationController.upsert);
apiV1.post("/allocations/bulk", authMiddleware, allocationController.bulkUpdate);
apiV1.delete("/allocations/task/:taskId", authMiddleware, allocationController.deleteByTask);

app.use("/api/v1", apiV1);

// Fallbacks de Compatibilidade (Legacy /api URLs)
app.use("/api/auth", authRoutes);
app.use("/api/clientes", clientsRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/projetos", projectRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tarefas", tasksRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/colaboradores", collaboratorRoutes);
app.use("/api/timesheets", timesheetsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/audit-logs", authMiddleware, auditLogsRoutes);
app.use("/api/organizations", organizationRoutes);

// Allocations Fallback direct /api
app.get("/api/allocations", authMiddleware, allocationController.list);
app.post("/api/allocations", authMiddleware, allocationController.upsert);
app.post("/api/allocations/bulk", authMiddleware, allocationController.bulkUpdate);
app.delete("/api/allocations/task/:taskId", authMiddleware, allocationController.deleteByTask);

// Admin / Relatórios
app.use("/api/admin", adminBaseRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/admin/report", reportRoutes);

// 8. Tratamento de Erro Global
app.use((err, req, res, next) => {
    logger.error(`Erro não tratado: ${err.message}`, "GlobalErrorHandler", err);
    return sendError(res, "Ocorreu um erro interno no servidor.", 500);
});

const port = process.env.PORT || 3000;
app.listen(port, () => logger.info(`✅ Backend rodando na porta ${port}`, "ServerInit"));

export default app;
