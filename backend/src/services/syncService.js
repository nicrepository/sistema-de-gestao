import ExcelJS from "exceljs";
import { randomUUID } from "crypto";
import { syncRepository } from "../repositories/syncRepository.js";

const normalizeKey = (key) => key?.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[-_]/g, '').replace(/\s/g, '') || '';

export const syncService = {
    translations: {
        'idtarefa': 'ID_Tarefa',
        'idprojeto': 'ID_Projeto',
        'idcliente': 'ID_Cliente',
        'idcolaborador': 'ID_Colaborador',
        'idcolaborado': 'ID_Colaborador',
        'oqueprecisaserfeito': 'Afazer',
        'tarefa': 'Afazer',
        'atividades': 'Afazer',
        'titulo': 'Afazer',
        'nome': 'Afazer',
        'statustaref': 'StatusTarefa',
        'contatoprincipal': 'contato_principal',
        'inicioprevist': 'inicio_previsto',
        'inicioreal': 'inicio_real',
        'entregaestim': 'entrega_estimada',
        'entregareal': 'entrega_real',
        'porcentagem': 'Porcentagem',
        'prioridade': 'Prioridade',
        'impacto': 'Impacto',
        'riscos': 'Riscos',
        'idhorastrabalhadas': 'ID_Horas_Trabalhadas',
        'idhorastrabalhada': 'ID_Horas_Trabalhadas',
        'horastrabalhadas': 'Horas_Trabalhadas',
        'horastrabalhada': 'Horas_Trabalhadas',
        'pais': 'Pais',
        'nomeprojeto': 'NomeProjeto',
        'nomecliente': 'NomeCliente',
        'email': 'email',
        'data': 'Data',
        'descricao': 'Descricao',
        'horainicio': 'Hora_Inicio',
        'horafim': 'Hora_Fim',
        'almocodeduzido': 'Almoco_Deduzido',
        'papel': 'role',
        'role': 'role',
        'funcao': 'role'
    },

    async processExcel(buffer) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const mapping = {
            "dim_clientes": "ID_Cliente",
            "dim_colaboradores": "email",
            "dim_projetos": "ID_Projeto",
            "fato_tarefas": "ID_Tarefa",
            "horas_trabalhadas": "ID_Horas_Trabalhadas"
        };

        const priority = {
            "dim_clientes": 1,
            "dim_colaboradores": 2,
            "dim_projetos": 3,
            "fato_tarefas": 4,
            "horas_trabalhadas": 5
        };

        const sheets = workbook.worksheets.sort((a, b) => {
            const nameA = Object.keys(mapping).find(m => normalizeKey(a.name) === normalizeKey(m));
            const nameB = Object.keys(mapping).find(m => normalizeKey(b.name) === normalizeKey(m));
            return (priority[nameA] || 99) - (priority[nameB] || 99);
        });

        const results = {};
        for (const sheet of sheets) {
            const normName = normalizeKey(sheet.name);
            const tableKey = Object.keys(mapping).find(m => normalizeKey(m) === normName);
            if (tableKey) {
                const count = await this.syncTable(sheet, tableKey, mapping[tableKey]);
                results[tableKey] = count;
            }
        }
        return results;
    },

    async syncTable(sheet, tableName, onConflict) {
        const rows = [];
        const excelHeaders = {};

        sheet.getRow(1).eachCell((cell, colNumber) => {
            const norm = normalizeKey(cell.value);
            excelHeaders[colNumber] = this.translations[norm] || cell.value?.toString().trim();
        });

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const rowData = {};
            let hasData = false;

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const dbField = excelHeaders[colNumber];
                if (!dbField || dbField === 'id_tarefa_novo') return;

                let val = cell.value;
                if (val && typeof val === 'object' && val.result !== undefined) val = val.result;
                if (val && typeof val === 'object' && val.text !== undefined) val = val.text;
                if (val && typeof val === 'object' && val.hyperlink !== undefined) val = val.hyperlink;

                if (dbField === 'Data') {
                    if (val instanceof Date) {
                        const y = val.getUTCFullYear();
                        const m = String(val.getUTCMonth() + 1).padStart(2, '0');
                        const d = String(val.getUTCDate()).padStart(2, '0');
                        val = `${y}-${m}-${d}`;
                    } else if (typeof val === 'string' && val.includes('/')) {
                        const p = val.split('/');
                        if (p.length === 3) {
                            const d = p[0].padStart(2, '0');
                            const m = p[1].padStart(2, '0');
                            const y = p[2].length === 2 ? `20${p[2]}` : p[2];
                            val = `${y}-${m}-${d}`;
                        }
                    }
                }

                rowData[dbField] = val;
                hasData = true;
            });

            if (hasData) {
                if (tableName === 'horas_trabalhadas' && !rowData['ID_Horas_Trabalhadas']) {
                    rowData['ID_Horas_Trabalhadas'] = randomUUID();
                }

                const filtered = this.filterAllowedFields(tableName, rowData);
                rows.push(filtered);
            }
        });

        if (rows.length === 0) return 0;

        if (tableName === 'horas_trabalhadas') {
            const taskMap = await syncRepository.getTaskMap();
            rows.forEach(r => {
                const oldId = r.ID_Tarefa?.toString().toLowerCase();
                if (oldId && taskMap[oldId]) {
                    r.id_tarefa_novo = taskMap[oldId];
                }
            });
        }

        const uniqueRows = onConflict ? Array.from(new Map(rows.reverse().map(r => [r[onConflict], r])).values()).reverse() : rows;
        await syncRepository.upsert(tableName, uniqueRows, onConflict);

        return uniqueRows.length;
    },

    filterAllowedFields(tableName, rowData) {
        const mapping = {
            'dim_clientes': ['ID_Cliente', 'NomeCliente', 'contato_principal', 'ativo', 'Contrato', 'Criado', 'NewLogo', 'Pais', 'Desativado'],
            'dim_colaboradores': ['id_colaborador', 'nome_colaborador', 'email', 'cargo', 'role', 'ativo', 'avatar_url', 'auth_user_id'],
            'dim_projetos': ['ID_Projeto', 'ID_Cliente', 'NomeProjeto', 'StatusProjeto', 'budget', 'startDate', 'estimatedDelivery', 'manager', 'description', 'ativo', 'valor_total_rs'],
            'fato_tarefas': ['ID_Tarefa', 'ID_Cliente', 'ID_Projeto', 'Afazer', 'ID_Colaborador', 'inicio_previsto', 'inicio_real', 'entrega_estimada', 'entrega_real', 'Prioridade', 'Impacto', 'Riscos', 'Porcentagem', 'StatusTarefa', 'id_tarefa_novo'],
            'horas_trabalhadas': ['ID_Horas_Trabalhadas', 'Data', 'ID_Colaborador', 'ID_Cliente', 'ID_Projeto', 'ID_Tarefa', 'Horas_Trabalhadas', 'Hora_Inicio', 'Hora_Fim', 'Almoco_Deduzido', 'Descricao', 'id_tarefa_novo']
        };

        const allowed = mapping[tableName];
        if (!allowed) return rowData;

        // Mapeamento específico para lidar com cabeçalhos de importação
        const colabRemap = {
            'ID_Colaborador': 'id_colaborador',
            'NomeColaborador': 'nome_colaborador',
            'Cargo': 'cargo'
        };

        const filtered = {};
        Object.keys(rowData).forEach(key => {
            let targetKey = key;
            if (tableName === 'dim_colaboradores' && colabRemap[key]) {
                targetKey = colabRemap[key];
            }
            if (allowed.includes(targetKey)) {
                filtered[targetKey] = rowData[key];
            }
        });
        return filtered;
    },


    async generateExport() {
        const workbook = new ExcelJS.Workbook();
        const tableNames = ['dim_clientes', 'dim_colaboradores', 'dim_projetos', 'fato_tarefas', 'horas_trabalhadas'];

        for (const tableName of tableNames) {
            const data = await syncRepository.findAll(tableName);
            if (!data || data.length === 0) continue;

            const sheet = workbook.addWorksheet(tableName);
            const allColumns = Object.keys(data[0]);

            sheet.columns = allColumns.map(col => ({
                header: col,
                key: col,
                width: col.length > 20 ? 25 : 15
            }));

            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

            data.forEach(row => {
                const rowData = {};
                allColumns.forEach(col => {
                    let value = row[col];
                    if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                        value = value.split('T')[0];
                    }
                    rowData[col] = value ?? '';
                });
                sheet.addRow(rowData);
            });

            sheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
                        };
                    });
                    if (rowNumber % 2 === 0) {
                        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    }
                }
            });
        }
        return workbook;
    }
};
