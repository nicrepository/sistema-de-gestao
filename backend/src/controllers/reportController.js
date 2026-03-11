import { reportService } from '../services/reportService.js';
import { projectRepository } from '../repositories/projectRepository.js';

function parseCsvIntArray(v) {
    if (!v) return null;
    if (Array.isArray(v)) v = v.join(',');
    const arr = String(v)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(n => Number(n))
        .filter(n => Number.isFinite(n));
    return arr.length ? arr : null;
}

function parseCsvStringArray(v) {
    if (!v) return null;
    if (Array.isArray(v)) v = v.join(',');
    const arr = String(v)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    return arr.length ? arr : null;
}

function dateOrDefault(v, fallbackIso) {
    const s = (v || '').toString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return fallbackIso;
}

export const reportController = {
    async getPreview(req, res) {
        try {
            const filters = {
                startDate: req.query.startDate ? dateOrDefault(req.query.startDate, null) : null,
                endDate: req.query.endDate ? dateOrDefault(req.query.endDate, null) : null,
                clientIds: parseCsvIntArray(req.query.clientIds),
                projectIds: parseCsvIntArray(req.query.projectIds),
                collaboratorIds: parseCsvIntArray(req.query.collaboratorIds),
                statuses: parseCsvStringArray(req.query.statuses)
            };

            const data = await reportService.getReportData(req.user, filters);
            res.json({
                success: true,
                data: {
                    generatedAt: new Date().toISOString(),
                    filters,
                    count: data.rows.length,
                    ...data
                }
            });
        } catch (e) {
            console.error('[ReportController] Preview error:', e);
            res.status(500).json({ error: e.message || 'Failed to generate preview' });
        }
    },

    async getPowerBi(req, res) {
        try {
            const filters = {
                startDate: req.query.startDate ? dateOrDefault(req.query.startDate, null) : null,
                endDate: req.query.endDate ? dateOrDefault(req.query.endDate, null) : null,
                clientIds: parseCsvIntArray(req.query.clientIds),
                projectIds: parseCsvIntArray(req.query.projectIds),
                collaboratorIds: parseCsvIntArray(req.query.collaboratorIds),
                statuses: parseCsvStringArray(req.query.statuses)
            };

            const { rows } = await reportService.getReportData(req.user, filters);
            res.json({
                dataset: 'relatorio_horas_custos',
                generatedAt: new Date().toISOString(),
                filters,
                rows
            });
        } catch (e) {
            console.error('[ReportController] PowerBI error:', e);
            res.status(500).json({ error: e.message || 'Failed to export PowerBI json' });
        }
    },

    async getExcel(req, res) {
        try {
            const filters = {
                startDate: req.query.startDate ? dateOrDefault(req.query.startDate, null) : null,
                endDate: req.query.endDate ? dateOrDefault(req.query.endDate, null) : null,
                clientIds: parseCsvIntArray(req.query.clientIds),
                projectIds: parseCsvIntArray(req.query.projectIds),
                collaboratorIds: parseCsvIntArray(req.query.collaboratorIds),
                statuses: parseCsvStringArray(req.query.statuses)
            };

            const { rows } = await reportService.getReportData(req.user, filters);
            const wb = await reportService.generateExcel(rows, filters);

            let baseName = "Relatorio Geral";

            if (filters.clientIds?.length === 1 && rows.length > 0) {
                const cId = filters.clientIds[0];
                const item = rows.find(r => r.id_cliente === cId);
                const nome = item ? (item.nome_cliente || item.cliente) : null;
                if (nome) baseName = `Relatorio de Cliente ${nome.replaceAll(/[^a-zA-Z0-9À-ÿ\s-]+/g, '')}`;
            } else if (filters.projectIds?.length === 1 && rows.length > 0) {
                const pId = filters.projectIds[0];
                const item = rows.find(r => r.id_projeto === pId);
                const nome = item ? (item.nome_projeto || item.projeto) : null;
                if (nome) baseName = `Relatorio do Projeto ${nome.replaceAll(/[^a-zA-Z0-9À-ÿ\s-]+/g, '')}`;
            } else if (filters.collaboratorIds?.length === 1 && rows.length > 0) {
                const cId = filters.collaboratorIds[0];
                const item = rows.find(r => r.id_colaborador === cId);
                const nome = item ? (item.nome_colaborador || item.colaborador) : null;
                if (nome) baseName = `Relatorio do Colaborador ${nome.replaceAll(/[^a-zA-Z0-9À-ÿ\s-]+/g, '')}`;
            }

            let dateParams = 'de Todo o Periodo';
            if (filters.startDate && filters.endDate) {
                const d1 = new Date(filters.startDate + 'T12:00:00');
                const d2 = new Date(filters.endDate + 'T12:00:00');

                const m1 = d1.toLocaleString('pt-BR', { month: 'long' });
                const m2 = d2.toLocaleString('pt-BR', { month: 'long' });
                const y1 = d1.getFullYear();
                const y2 = d2.getFullYear();

                if (m1 === m2 && y1 === y2) {
                    if (d1.getDate() === 1 && new Date(y1, d1.getMonth() + 1, 0).getDate() === d2.getDate()) {
                        dateParams = `de ${m1} de ${y1}`;
                    } else {
                        dateParams = `de ${String(d1.getDate()).padStart(2, '0')} a ${String(d2.getDate()).padStart(2, '0')} de ${m1} de ${y1}`;
                    }
                } else if (y1 === y2) {
                    dateParams = `de ${String(d1.getDate()).padStart(2, '0')} de ${m1} a ${String(d2.getDate()).padStart(2, '0')} de ${m2} de ${y1}`;
                } else {
                    dateParams = `de ${String(d1.getDate()).padStart(2, '0')} de ${m1} de ${y1} a ${String(d2.getDate()).padStart(2, '0')} de ${m2} de ${y2}`;
                }
            }

            const fileName = `${baseName} ${dateParams}.xlsx`.replaceAll(/\s+/g, ' ');

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

            await wb.xlsx.write(res);
            res.end();
        } catch (e) {
            console.error('[ReportController] Excel error:', e);
            res.status(500).json({ error: e.message || 'Failed to export Excel' });
        }
    },

    async updateBudgets(req, res) {
        try {
            const body = req.body || {};
            const items = Array.isArray(body.budgets) ? body.budgets : [];
            if (!items.length) return res.status(400).json({ error: 'Missing budgets[]' });

            const results = [];
            for (const it of items) {
                const id = Number(it.id_projeto);
                const budget = it.budget === null || it.budget === undefined ? null : Number(it.budget);
                if (!Number.isFinite(id)) continue;

                const data = await projectRepository.update(id, { budget });
                if (data && data.length > 0) {
                    results.push(data[0]);
                }
            }

            res.json({ updated: results.length, results });
        } catch (e) {
            console.error('[ReportController] UpdateBudgets error:', e);
            res.status(500).json({ error: e.message || 'Failed to update budgets' });
        }
    }
};
