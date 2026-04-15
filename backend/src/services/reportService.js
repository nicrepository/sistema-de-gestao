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
            progresso_p: Number(r.progresso_p || 0),
            inicio_real: r.inicio_real,
            fim_real: r.fim_real,
            horas_vendidas: Number(r.horas_vendidas || 0),
            valor_total_rs: Number(r.valor_total_rs || 0)
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
            { header: 'CLIENTE', key: 'cliente', width: 30 },
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
                clientProjectHierarchy.set(cliName, { total: 0, projects: new Map(), collaborators: new Map() });
            }
            const cliData = clientProjectHierarchy.get(cliName);
            cliData.total += h;

            if (!cliData.collaborators.has(collName)) cliData.collaborators.set(collName, 0);
            cliData.collaborators.set(collName, cliData.collaborators.get(collName) + h);

            if (!cliData.projects.has(projName)) cliData.projects.set(projName, { hours: 0, collaborators: new Map() });
            const projData = cliData.projects.get(projName);
            projData.hours += h;
            if (!projData.collaborators.has(collName)) projData.collaborators.set(collName, 0);
            projData.collaborators.set(collName, projData.collaborators.get(collName) + h);

            const row = wsDados.addRow({
                data: r.data_registro ? new Date(r.data_registro + 'T12:00:00') : null,
                colaborador: collName,
                tarefa: taskName,
                horas: h / 24,
                projeto: projName,
                cliente: cliName, 
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

            const sortedClientCollabs = Array.from(data.collaborators.entries()).sort((a, b) => b[1] - a[1]);
            sortedClientCollabs.forEach(([collName, h], idx) => {
                const r = wsResumo.addRow({ desc: `  ${collName}`, horas: h / 24 });
                r.getCell('horas').numFmt = formats.hours;
                r.eachCell(cell => {
                    cell.border = styles.border;
                    cell.fill = idx % 2 === 0 ? styles.zebraWhite.fill : styles.zebraGray.fill;
                    cell.font = { italic: true, size: 9, color: { argb: 'FF4338CA' } };
                });
            });

            wsResumo.addRow({});
            const projectHeaderTitle = wsResumo.addRow({ desc: 'RESUMO POR PROJETO' });
            projectHeaderTitle.eachCell(cell => {
                cell.fill = styles.projectHeader.fill;
                cell.font = styles.projectHeader.font;
            });

            const sortedProjects = Array.from(data.projects.entries()).sort((a, b) => b[1].hours - a[1].hours);
            sortedProjects.forEach(([projName, projData], idx) => {
                const r = wsResumo.addRow({ desc: projName, horas: projData.hours / 24 });
                r.getCell('horas').numFmt = formats.hours;
                r.eachCell(cell => {
                    cell.border = styles.border;
                    cell.fill = idx % 2 === 0 ? styles.zebraWhite.fill : styles.zebraGray.fill;
                });

                const sortedProjCollabs = Array.from(projData.collaborators.entries()).sort((a, b) => b[1] - a[1]);
                sortedProjCollabs.forEach(([collName, h], cidx) => {
                    const cr = wsResumo.addRow({ desc: `  ${collName}`, horas: h / 24 });
                    cr.getCell('horas').numFmt = formats.hours;
                    cr.eachCell(cell => {
                        cell.border = styles.border;
                        cell.fill = cidx % 2 === 0
                            ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }
                            : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                        cell.font = { italic: true, size: 9, color: { argb: 'FF065F46' } };
                    });
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
            // 1
            { header: 'Parceiro', key: 'parceiro', width: 20 },
            { header: 'Cliente', key: 'cliente', width: 30 },
            { header: 'Projeto', key: 'projeto', width: 40 },
            // 2
            { header: 'Responsável', key: 'responsavel', width: 25 },
            { header: 'Equipe / Nº de membros', key: 'equipe', width: 25 },
            // 3
            { header: 'Status Real', key: 'status_r', width: 18 },
            { header: 'Progresso Estimado (%)', key: 'progresso_p', width: 22 },
            { header: 'Progresso Real (%)', key: 'progresso_r', width: 22 },
            // 4
            { header: 'Início Planejado', key: 'inicio_p', width: 20 },
            { header: 'Entrega Planejada', key: 'fim_p', width: 20 },
            { header: 'Início Real', key: 'inicio_r', width: 18 },
            { header: 'Entrega Real', key: 'fim_r', width: 18 },
            // 5
            { header: 'Horas Planejadas', key: 'horas_p', width: 20 },
            { header: 'Horas Consumidas', key: 'horas_r', width: 20 },
            // 6
            { header: 'Receita Líquida', key: 'vendido', width: 22 },
            { header: 'Custo Total', key: 'custo_real', width: 20 },
            { header: 'Resultado (Lucro / Prejuízo)', key: 'resultado', width: 30 },
            { header: 'Margem de Lucro (%)', key: 'margem', width: 24 }
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
                    parceiro: r.parceiro || 'N/A',
                    cliente: r.nome_cliente || r.cliente || 'Sem cliente',
                    projeto: r.nome_projeto || r.projeto || '(Sem nome)',
                    responsavel: r.responsavel || 'N/A',
                    equipeRaw: new Set(),
                    inicio_p: r.data_inicio_p,
                    fim_p: r.data_fim_p,
                    progresso_p: r.progresso_p || 0,
                    status_db: r.status_p || 'Ativo',
                    inicio_r_db: r.inicio_real,
                    fim_r_db: r.fim_real,
                    inicio_calc: null,
                    fim_calc: null,
                    horas_p: Number(r.horas_vendidas || 0),
                    horas_r: 0,
                    vendido: Number(r.valor_total_rs || 0),
                    custo_real: 0
                });
            }

            const pt = execMap.get(pKey);
            const entryHours = Number(r.horas || 0);
            const entryCost = entryHours * Number(r.custo_hora_colab || 0);

            pt.horas_r += entryHours;
            pt.custo_real += entryCost;

            if (r.colaborador) {
                pt.equipeRaw.add(r.colaborador);
            }

            if (r.data_registro) {
                if (!pt.inicio_calc || r.data_registro < pt.inicio_calc) pt.inicio_calc = r.data_registro;
                if (!pt.fim_calc || r.data_registro > pt.fim_calc) pt.fim_calc = r.data_registro;
            }
        });

        Array.from(execMap.values()).forEach((pt, idx) => {
            let plannedP = 0;
            if (pt.inicio_p && pt.fim_p) {
                const start = new Date(pt.inicio_p + 'T12:00:00').getTime();
                const end = new Date(pt.fim_p + 'T12:00:00').getTime();
                const now = Date.now();
                if (now > end) {
                    plannedP = 1;
                } else if (now >= start && end > start) {
                    plannedP = (now - start) / (end - start);
                }
            }

            let realP = 0;
            if (pt.horas_p > 0) {
                realP = Math.min(pt.horas_r / pt.horas_p, 1);
            } else if (pt.horas_r > 0) {
                realP = 1;
            }

            // Cálculo do Status Real (aproximado do frontend)
            let statusReal = (pt.status_db || 'Ativo').toUpperCase();
            const now = new Date();
            now.setHours(12, 0, 0, 0);
            const startP = pt.inicio_p ? new Date(pt.inicio_p + 'T12:00:00') : null;
            const endP = pt.fim_p ? new Date(pt.fim_p + 'T12:00:00') : null;

            let actualStart = null;
            if (pt.inicio_r_db) {
                actualStart = new Date(pt.inicio_r_db + 'T12:00:00');
            } else if (pt.inicio_calc) {
                actualStart = new Date(pt.inicio_calc + 'T12:00:00');
            }

            const actualEnd = pt.fim_r_db ? new Date(pt.fim_r_db + 'T12:00:00') : null;

            if (statusReal === 'CONCLUÍDO' || actualEnd) {
                statusReal = 'CONCLUÍDO';
            } else if (endP && now > endP && realP < 1) {
                statusReal = 'ATRASADO';
            } else if (actualStart) {
                statusReal = 'EM ANDAMENTO';
            } else if (startP && now >= startP) {
                statusReal = 'INICIADO';
            } else {
                statusReal = 'NÃO INICIADO';
            }

            const rowData = wsExecutivo.addRow({
                parceiro: pt.parceiro,
                cliente: pt.cliente,
                projeto: pt.projeto,
                responsavel: pt.responsavel,
                equipe: `${pt.equipeRaw.size} membro(s) (${Array.from(pt.equipeRaw).join(', ')})`,
                inicio_p: pt.inicio_p ? new Date(pt.inicio_p + 'T12:00:00') : null,
                fim_p: pt.fim_p ? new Date(pt.fim_p + 'T12:00:00') : null,
                progresso_p: plannedP,
                status_r: statusReal,
                inicio_r: actualStart,
                fim_r: actualEnd,
                progresso_r: realP,
                horas_p: pt.horas_p,
                horas_r: pt.horas_r,
                vendido: pt.vendido,
                custo_real: pt.custo_real,
                resultado: pt.vendido - pt.custo_real,
                margem: pt.vendido > 0 ? ((pt.vendido - pt.custo_real) / pt.vendido) : 0
            });

            rowData.getCell('inicio_p').numFmt = formats.date;
            rowData.getCell('fim_p').numFmt = formats.date;
            rowData.getCell('inicio_r').numFmt = formats.date;
            rowData.getCell('fim_r').numFmt = formats.date;
            rowData.getCell('progresso_p').numFmt = '0%';
            rowData.getCell('progresso_r').numFmt = '0%';
            rowData.getCell('horas_p').numFmt = '#,##0.00';
            rowData.getCell('horas_r').numFmt = '#,##0.00';
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
