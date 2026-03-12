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

const app = express();
app.set('trust proxy', 1);
const store = new ExpressBrute.MemoryStore();
const bruteForce = new ExpressBrute(store);
const startTime = Date.now();

// 1. Segurança de Cabeçalhos
app.use(helmet());

// 2. CORS Seguro
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "https://gestao.nic-labs.com",
    "https://api-gestao.nic-labs.com"
];
app.use(cors({
    origin: (origin, callback) => {
        // Permite requisições sem origin (como mobile apps ou curl) ou se estiver na whitelist ou se CORS_ORIGIN for *
        if (!origin || allowedOrigins.includes(origin) || process.env.CORS_ORIGIN === "*") {
            callback(null, true);
        } else {
            logger.warn(`Origin negada pelo CORS: ${origin}`, "CORS");
            callback(new Error("CORS não permitido"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "apikey", "ngrok-skip-browser-warning", "Prefer", "Access-Control-Request-Private-Network"],
    exposedHeaders: ["Content-Disposition"]
}));

// Chrome Private Network Access: permite que sites HTTPS/externos chamem este servidor local
// Responde ao preflight OPTIONS com o header necessário
app.use((req, res, next) => {
    if (req.headers['access-control-request-private-network']) {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        return res.sendStatus(200);
    }
    next();
});

// 3. Proteção contra Poluição de Parâmetros
app.use(hpp());

// 4. Parser e Sanitização
app.use(express.json({ limit: "1mb" }));
app.use(xss());
app.use(mongoSanitize());

// 5. Logs de Requisição
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, "HTTP");
    next();
});

// 6. Auditoria Contextual
app.use(auditMiddleware);

// 7. Limite de Requisições
app.use("/api", apiLimiter);

// 8. Documentação
setupSwagger(app);

// 9. Healthcheck
app.get("/health", async (req, res) => {
    try {
        const { error } = await supabaseAdmin.from('system_settings').select('key').limit(1);
        const dbStatus = error ? 'error' : 'connected';

        return sendSuccess(res, {
            status: "ok",
            database: dbStatus,
            uptime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        return sendError(res, "Healthcheck failed", 500);
    }
});

/**
 * 9. Rotas Versionadas (v1)
 * Normalizadas para português conforme frontend solicita
 */
const apiV1 = express.Router();

apiV1.use("/auth", bruteForce.prevent, authRoutes);
apiV1.use("/clientes", clientsRoutes);
apiV1.use("/projetos", projectRoutes);
apiV1.use("/tarefas", tasksRoutes);
apiV1.use("/colaboradores", collaboratorRoutes);
apiV1.use("/timesheets", timesheetsRoutes);
apiV1.use("/support", supportRoutes);
apiV1.use("/sync", syncRoutes);
apiV1.use("/audit-logs", auditLogsRoutes);

// Allocations
apiV1.get("/allocations", authMiddleware, allocationController.list);
apiV1.post("/allocations", authMiddleware, allocationController.upsert);
apiV1.delete("/allocations/task/:taskId", authMiddleware, allocationController.deleteByTask);

// Alias em inglês para v1 (Opcional, mas bom p/ padrão rest)
apiV1.use("/clients", clientsRoutes);
apiV1.use("/projects", projectRoutes);
apiV1.use("/tasks", tasksRoutes);

app.use("/api/v1", apiV1);

/**
 * 10. Fallbacks de Compatibilidade
 */
app.use("/api/auth", authRoutes);
app.use("/api/clientes", clientsRoutes);
app.use("/api/projetos", projectRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tarefas", tasksRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/colaboradores", collaboratorRoutes);
app.use("/api/timesheets", timesheetsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/audit-logs", authMiddleware, auditLogsRoutes);
app.get("/api/allocations", authMiddleware, allocationController.list);
app.post("/api/allocations", authMiddleware, allocationController.upsert);
app.delete("/api/allocations/task/:taskId", authMiddleware, allocationController.deleteByTask);

// Admin / Relatórios
app.use("/api/admin", adminBaseRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/admin/report", reportRoutes);

// 11. Tratamento de Erro Global
app.use((err, req, res, next) => {
    logger.error(`Erro não tratado: ${err.message}`, "GlobalErrorHandler", err);
    return sendError(res, "Ocorreu um erro interno no servidor.", 500);
});

const port = process.env.PORT || 3000;
app.listen(port, () => logger.info(`✅ Backend rodando na porta ${port}`, "ServerInit"));

export default app;
