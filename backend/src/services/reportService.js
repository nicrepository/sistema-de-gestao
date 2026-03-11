import ExcelJS from 'exceljs';
import { reportRepository } from '../repositories/reportRepository.js';
import { isAdmUser } from '../utils/security.js';
import { projectService } from './projectService.js';

export const reportService = {
    async getReportData(user, filters) {
        let finalFilters = { ...filters };

        if (!isAdmUser(user)) {
            const userProjectIds = await projectService._getUserLinkedProjectIds(user);

            if (userProjectIds.length === 0) {
                return { rows: [], projectTotals: [], totals: { horas_total: 0, valor_total_rateado: 0 } };
            }

            // Intersect com os projetos que o usuário pediu, ou usa todos os vinculados
            if (finalFilters.projectIds && finalFilters.projectIds.length > 0) {
                finalFilters.projectIds = finalFilters.projectIds.filter(id => userProjectIds.includes(id));
                if (finalFilters.projectIds.length === 0) {
                    return { rows: [], projectTotals: [], totals: { horas_total: 0, valor_total_rateado: 0 } };
                }
            } else {
                finalFilters.projectIds = userProjectIds;
            }
        }

        const rows = await reportRepository.fetchRelatorioHorasCustos(finalFilters);

        const mapped = rows.map(r => ({
            ...r,
            id_cliente: r.id_cliente ? Number(r.id_cliente) : null,
            id_projeto: r.id_projeto ? Number(r.id_projeto) : null,
            id_colaborador: r.id_colaborador ? Number(r.id_colaborador) : null,
            horas: Number(r.horas || 0),
            valor_projeto: Number(r.valor_projeto || 0),
            horas_projeto_total: Number(r.horas_projeto_total || 0),
            valor_hora_projeto: Number(r.valor_hora_projeto || 0),
            valor_rateado: Number(r.valor_rateado || 0),
            progresso_p: Number(r.progresso_p || 0)
        }));

        const projectTotals = this.calculateProjectTotals(mapped);
        const totals = this.calculateTotals(mapped);

        return { rows: mapped, projectTotals, totals };
    },

    calculateProjectTotals(rows) {
        const map = new Map();
        rows.forEach(r => {
            const id = r.id_projeto;
            if (!id) return;
            if (!map.has(id)) {
                map.set(id, {
                    id_projeto: id,
                    projeto: r.nome_projeto || r.projeto,
                    cliente: r.nome_cliente || r.cliente,
                    id_cliente: r.id_cliente,
                    horas_projeto_total: Number(r.horas_projeto_total || 0),
                    valor_projeto: Number(r.valor_projeto || 0),
                    valor_hora_projeto: Number(r.valor_hora_projeto || 0),
                    valor_rateado_total: 0
                });
            }
            const pt = map.get(id);
            pt.valor_rateado_total += Number(r.valor_rateado || 0);
        });
        return Array.from(map.values());
    },

    calculateTotals(rows) {
        let horas_total = 0;
        let valor_total_rateado = 0;
        rows.forEach(r => {
            horas_total += Number(r.horas || 0);
            valor_total_rateado += Number(r.valor_rateado || 0);
        });
        return { horas_total, valor_total_rateado };
    },

    async generateExcel(rows, filters) {
        const { startDate, endDate, clientIds, projectIds, collaboratorIds } = filters;
        const sortedRows = [...rows].sort((a, b) => {
            const dateA = a.data_registro || a.data || '';
            const dateB = b.data_registro || b.data || '';
            return dateB.localeCompare(dateA);
        });

        const wb = new ExcelJS.Workbook();
        const wsDados = wb.addWorksheet('Dados');

        const styles = {
            header: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } },
                font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 },
                alignment: { vertical: 'middle', horizontal: 'center' },
                border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
            },
            executivoHeader: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }, // Slate 900
                font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 },
                alignment: { vertical: 'middle', horizontal: 'center' },
                border: {
                    top: { style: 'thin', color: { argb: 'FF334155' } },
                    left: { style: 'thin', color: { argb: 'FF334155' } },
                    bottom: { style: 'thin', color: { argb: 'FF334155' } },
                    right: { style: 'thin', color: { argb: 'FF334155' } }
                }
            },
            summaryHeader: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } },
                font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
            },
            projectHeader: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } },
                font: { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
            },
            zebraGray: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
            },
            zebraWhite: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
            },
            border: {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            }
        };

        const formats = {
            hours: '[h]:mm',
            date: 'DD/MM/YYYY'
        };

        wsDados.columns = [
            { header: 'DATA DO APONTAMENTO', key: 'data', width: 22 },
            { header: 'MEMBRO DA EQUIPE', key: 'colaborador', width: 28 },
            { header: 'ATIVIDADE DESENVOLVIDA', key: 'tarefa', width: 50 },
            { header: 'ESFORÇO APLICADO', key: 'horas', width: 20 },
            { header: 'NOME DO PROJETO', key: 'projeto', width: 40 },
            { header: 'STATUS DO PROJETO', key: 'status_p', width: 20 },
            { header: 'COMPLEXIDADE', key: 'complexidade_p', width: 18 },
            { header: 'MENSURAÇÃO: INÍCIO O.', key: 'data_inicio_p', width: 24 },
            { header: 'MENSURAÇÃO: TÉRMINO P.', key: 'data_fim_p', width: 24 },
            { header: 'EVOLUÇÃO ESPERADA (%)', key: 'progresso_p', width: 24 },
        ];

        wsDados.getRow(1).height = 25;
        wsDados.getRow(1).eachCell(cell => {
            cell.fill = styles.executivoHeader.fill;
            cell.font = styles.executivoHeader.font;
            cell.alignment = styles.executivoHeader.alignment;
            cell.border = styles.executivoHeader.border;
        });

        const collabMap = new Map();
        const taskMap = new Map();
        const clientProjectHierarchy = new Map();
        let totalHoursGlobal = 0;

        sortedRows.forEach(r => {
            const h = r.horas || 0;
            const projName = r.nome_projeto || r.projeto;
            const cliName = r.nome_cliente || r.cliente;
            const collName = r.colaborador;

            totalHoursGlobal += h;

            if (!collabMap.has(collName)) collabMap.set(collName, 0);
            collabMap.set(collName, collabMap.get(collName) + h);

            const taskName = r.tarefa || '-';
            if (!taskMap.has(taskName)) taskMap.set(taskName, 0);
            taskMap.set(taskName, taskMap.get(taskName) + h);

            if (!clientProjectHierarchy.has(cliName)) {
                clientProjectHierarchy.set(cliName, { total: 0, projects: new Map() });
            }
            const cliData = clientProjectHierarchy.get(cliName);
            cliData.total += h;
            if (!cliData.projects.has(projName)) cliData.projects.set(projName, 0);
            cliData.projects.set(projName, cliData.projects.get(projName) + h);

            const row = wsDados.addRow({
                data: r.data_registro ? new Date(r.data_registro + 'T12:00:00') : null,
                colaborador: collName,
                tarefa: taskName,
                horas: h / 24,
                projeto: projName,
                status_p: r.status_p,
                complexidade_p: r.complexidade_p,
                data_inicio_p: r.data_inicio_p ? new Date(r.data_inicio_p + 'T12:00:00') : null,
                data_fim_p: r.data_fim_p ? new Date(r.data_fim_p + 'T12:00:00') : null,
                progresso_p: r.progresso_p ? Number(r.progresso_p) / 100 : 0,
            });

            row.getCell('data').numFmt = formats.date;
            row.getCell('data_inicio_p').numFmt = formats.date;
            row.getCell('data_fim_p').numFmt = formats.date;
            row.getCell('progresso_p').numFmt = '0%';
            row.getCell('horas').numFmt = formats.hours;
            row.eachCell(cell => cell.border = styles.border);
        });

        wsDados.views = [{ state: 'frozen', ySplit: 1 }];

        const wsResumo = wb.addWorksheet('Resumos');
        wsResumo.columns = [
            { header: 'MÉTRICAS & AGRUPAMENTOS', key: 'desc', width: 45 },
            { header: 'DETALHAMENTO E RESULTADOS GLOBAIS', key: 'horas', width: 65 }
        ];

        wsResumo.getRow(1).height = 25;
        wsResumo.getRow(1).eachCell(cell => {
            cell.fill = styles.executivoHeader.fill;
            cell.font = styles.executivoHeader.font;
            cell.alignment = styles.executivoHeader.alignment;
            cell.border = styles.executivoHeader.border;
        });

        const getFilterNames = (ids, fieldName, allLabel) => {
            if (!ids || ids.length === 0) return allLabel;
            const names = [...new Set(rows.map(r => r[fieldName]))].filter(Boolean);
            return names.length > 0 ? names.join(', ') : allLabel;
        };

        const f_period = (startDate && endDate) ? `${startDate} até ${endDate}` : "Todo o Período";
        const f_clients = getFilterNames(clientIds, 'cliente', 'Todos os Clientes');
        const f_projects = getFilterNames(projectIds, 'projeto', 'Todos os Projetos');
        const f_collabs = getFilterNames(collaboratorIds, 'colaborador', 'Todos os Colaboradores');

        const filterTitle = wsResumo.addRow({ desc: 'FILTROS APLICADOS NESTE RELATÓRIO' });
        filterTitle.eachCell(cell => {
            cell.fill = styles.header.fill;
            cell.font = styles.header.font;
        });

        const addFilterRow = (label, value) => {
            const r = wsResumo.addRow({ desc: label, horas: value });
            r.getCell('desc').font = { bold: true };
            r.eachCell(cell => cell.border = styles.border);
        };

        addFilterRow('Período de Análise:', f_period);
        addFilterRow('Clientes:', f_clients);
        addFilterRow('Projetos:', f_projects);
        addFilterRow('Colaboradores:', f_collabs);
        wsResumo.addRow({});
        wsResumo.addRow({});

        const addResumoSection = (ws, title, map, headerStyle) => {
            const header = ws.addRow({ desc: title.toUpperCase() });
            header.eachCell(cell => {
                cell.fill = headerStyle.fill;
                cell.font = headerStyle.font;
            });

            const sortedEntries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
            sortedEntries.forEach(([name, h], idx) => {
                const r = ws.addRow({ desc: name, horas: h / 24 });
                r.getCell('horas').numFmt = formats.hours;
                r.eachCell(cell => {
                    cell.border = styles.border;
                    cell.fill = idx % 2 === 0 ? styles.zebraWhite.fill : styles.zebraGray.fill;
                });
            });
            ws.addRow({});
        };

        const sortedClients = Array.from(clientProjectHierarchy.entries()).sort((a, b) => b[1].total - a[1].total);
        sortedClients.forEach(([clientName, data]) => {
            const clientHeaderTitle = wsResumo.addRow({ desc: 'RESUMO POR CLIENTE' });
            clientHeaderTitle.eachCell(cell => {
                cell.fill = styles.summaryHeader.fill;
                cell.font = styles.summaryHeader.font;
            });

            const clientDataRow = wsResumo.addRow({ desc: clientName, horas: data.total / 24 });
            clientDataRow.getCell('desc').font = { bold: true };
            clientDataRow.getCell('horas').numFmt = formats.hours;
            clientDataRow.eachCell(cell => {
                cell.border = styles.border;
                cell.fill = styles.zebraWhite.fill;
            });

            wsResumo.addRow({});
            const projectHeaderTitle = wsResumo.addRow({ desc: 'RESUMO POR PROJETO' });
            projectHeaderTitle.eachCell(cell => {
                cell.fill = styles.projectHeader.fill;
                cell.font = styles.projectHeader.font;
            });

            const sortedProjects = Array.from(data.projects.entries()).sort((a, b) => b[1] - a[1]);
            sortedProjects.forEach(([projName, h], idx) => {
                const r = wsResumo.addRow({ desc: projName, horas: h / 24 });
                r.getCell('horas').numFmt = formats.hours;
                r.eachCell(cell => {
                    cell.border = styles.border;
                    cell.fill = idx % 2 === 0 ? styles.zebraWhite.fill : styles.zebraGray.fill;
                });
            });
            wsResumo.addRow({});
        });

        addResumoSection(wsResumo, 'Resumo por Colaborador', collabMap, styles.summaryHeader);
        addResumoSection(wsResumo, 'Resumo por Tarefa', taskMap, styles.summaryHeader);

        const totalRow = wsResumo.addRow({ desc: 'TOTAL GERAL DE HORAS', horas: totalHoursGlobal / 24 });
        totalRow.eachCell(cell => {
            cell.fill = styles.header.fill;
            cell.font = styles.header.font;
            cell.numFmt = formats.hours;
        });

        const wsExecutivo = wb.addWorksheet('Executivo');
        wsExecutivo.columns = [
            { header: 'PARCEIRO', key: 'parceiro', width: 20 },
            { header: 'CLIENTE', key: 'cliente', width: 30 },
            { header: 'PROJETO', key: 'projeto', width: 40 },
            { header: 'FIM PLANEJADO', key: 'fim_p', width: 20 },
            { header: 'PROG. ESTIMADO (%)', key: 'progresso_p', width: 22 },
            { header: 'STATUS REAL', key: 'status_r', width: 18 },
            { header: 'INÍCIO REAL', key: 'inicio_r', width: 18 },
            { header: 'FIM REAL', key: 'fim_r', width: 18 },
            { header: 'PROG. REAL (%)', key: 'progresso_r', width: 22 },
            { header: 'HORAS ORÇADAS', key: 'horas_p', width: 20 },
            { header: 'HORAS CONSUMIDAS', key: 'horas_r', width: 20 },
            { header: 'RECEITA LÍQUIDA', key: 'vendido', width: 22 },
            { header: 'CUSTO TOTAL', key: 'custo_real', width: 20 },
            { header: 'RESULTADO (L. / PREJ.)', key: 'resultado', width: 28 },
            { header: 'MARGEM DE LUCRO', key: 'margem', width: 22 }
        ];

        wsExecutivo.getRow(1).height = 25; // row height for headers
        wsExecutivo.getRow(1).eachCell(cell => {
            cell.fill = styles.executivoHeader.fill;
            cell.font = styles.executivoHeader.font;
            cell.alignment = styles.executivoHeader.alignment;
            cell.border = styles.executivoHeader.border;
        });

        // Congelar cabeçalho para facilitar rolagem de grandes tabelas
        wsExecutivo.views = [{ state: 'frozen', ySplit: 1 }];

        const execMap = new Map();
        rows.forEach(r => {
            const id = r.id_projeto;
            if (!id && !r.projeto) return;
            const pKey = id || r.projeto;

            if (!execMap.has(pKey)) {
                execMap.set(pKey, {
                    parceiro: 'N/A', // Não disponivel via query genérica
                    cliente: r.nome_cliente || r.cliente || 'Sem cliente',
                    projeto: r.nome_projeto || r.projeto || '(Sem nome)',
                    fim_p: r.data_fim_p,
                    progresso_p: r.progresso_p || 0,
                    status_r: 'INICIADO', // Padrão
                    inicio_r: r.data_registro,
                    fim_r: r.data_registro,
                    horas_p: Number(r.horas_projeto_total || 0),
                    horas_r: 0,
                    vendido: Number(r.valor_projeto || 0),
                    custo_real: 0
                });
            }

            const pt = execMap.get(pKey);
            pt.horas_r += Number(r.horas || 0);
            pt.custo_real += Number(r.valor_rateado || 0);

            if (r.data_registro && (!pt.inicio_r || r.data_registro < pt.inicio_r)) {
                pt.inicio_r = r.data_registro;
            }
            if (r.data_registro && (!pt.fim_r || r.data_registro > pt.fim_r)) {
                pt.fim_r = r.data_registro;
            }

            // update status se necessario
            if (r.status_p) {
                const st = r.status_p.toUpperCase();
                if (st === 'CONCLUÍDO' || st === 'CONCLUIDO') pt.status_r = 'CONCLUÍDO';
            }
        });

        Array.from(execMap.values()).forEach((pt, idx) => {
            const rowData = wsExecutivo.addRow({
                parceiro: pt.parceiro,
                cliente: pt.cliente,
                projeto: pt.projeto,
                fim_p: pt.fim_p ? new Date(pt.fim_p + 'T12:00:00') : null,
                progresso_p: Number(pt.progresso_p) / 100,
                status_r: pt.status_r,
                inicio_r: pt.inicio_r ? new Date(pt.inicio_r + 'T12:00:00') : null,
                fim_r: pt.fim_r ? new Date(pt.fim_r + 'T12:00:00') : null,
                progresso_r: pt.horas_p > 0 ? Math.min(pt.horas_r / pt.horas_p, 1) : 0,
                horas_p: pt.horas_p / 24,
                horas_r: pt.horas_r / 24,
                vendido: pt.vendido,
                custo_real: pt.custo_real,
                resultado: pt.vendido - pt.custo_real,
                margem: pt.vendido > 0 ? ((pt.vendido - pt.custo_real) / pt.vendido) : 0
            });

            rowData.getCell('fim_p').numFmt = formats.date;
            rowData.getCell('inicio_r').numFmt = formats.date;
            rowData.getCell('fim_r').numFmt = formats.date;
            rowData.getCell('progresso_p').numFmt = '0%';
            rowData.getCell('progresso_r').numFmt = '0%';
            rowData.getCell('horas_p').numFmt = formats.hours;
            rowData.getCell('horas_r').numFmt = formats.hours;
            rowData.getCell('vendido').numFmt = '"R$" #,##0.00';
            rowData.getCell('custo_real').numFmt = '"R$" #,##0.00';
            rowData.getCell('resultado').numFmt = '"R$" #,##0.00';
            rowData.getCell('margem').numFmt = '0%';

            rowData.eachCell(cell => {
                cell.border = styles.border;
                cell.fill = idx % 2 === 0 ? styles.zebraWhite.fill : styles.zebraGray.fill;
            });
        });

        // Move a aba Executivo para o começo para maior destaque se preferir, ou deixe no fim.
        // O usuário pediu pra "baixar tbm o executivo", vamos deixar na frente
        wb.worksheets.unshift(wb.worksheets.pop());

        return wb;
    }
};
