const fs = require('fs');
const path = 'c:\\Users\\login\\OneDrive\\Área de Trabalho\\Projetos\\sistema-de-gest-o\\frontend\\src\\utils\\capacity.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Remover continuousHours da interface
content = content.replace(/continuousHours: number;/g, '');

// 2. Reformular simulateUserDailyAllocation para ignorar 'continuous' e focar em 'Ocupado' (planned) e 'Livre' (buffer)
// Localizar o loop e a lógica interna
const logicStart = 'let plannedHours = 0;';
const logicEnd = 'allocations.push\\({';

const newLogic = `        let plannedHours = 0;
        let bufferHours = 0;
        let currentCapacity = isAbsent ? 0 : capacityDia;

        if (isWorkingDay) {
            // BUSCA DE TAREFAS ATIVAS NO DIA
            const userTasks = allTasks.filter(t =>
                (String(t.developerId) === String(userId) || t.collaboratorIds?.some(id => String(id) === String(userId))) &&
                t.status !== 'Done' &&
                (t.status as string) !== 'Cancelled' &&
                (t.status as string) !== 'Cancelada' &&
                !t.deleted_at
            );

            // Filtra tarefas que o dia atual (dateStr) está dentro do período (Início até Fim Estimado)
            const activeTasks = userTasks.filter(t => {
                const project = allProjects.find(p => String(p.id) === String(t.projectId));
                if (!project) return false;

                // Se não tem data de início na tarefa, usa a do projeto. Se não tem fim, assume infinito (ocupado).
                const tStart = t.scheduledStart || t.actualStart || project.startDate || '';
                const tEnd = t.estimatedDelivery || '';

                // Se o dia está depois do início E (não tem fim OU está antes do fim)
                return dateStr >= tStart && (tEnd === '' || dateStr <= tEnd);
            });

            if (activeTasks.length > 0) {
                // Se houver qualquer tarefa ativa, o dia é considerado 100% OCUPADO
                plannedHours = currentCapacity;
                bufferHours = 0;
            } else {
                // Sem tarefas: 100% LIVRE
                plannedHours = 0;
                bufferHours = currentCapacity;
            }
        }`;

// Replace the block
const regex = new RegExp('let plannedHours = 0;[\\s\\S]*?if \\(isWorkingDay\\) {[\\s\\S]*?}\\s*(?=allocations\\.push)', 'g');
content = content.replace(regex, newLogic + '\n\n');

// 3. Remover continuousHours do objeto final
content = content.replace(/continuousHours: Number\(continuousHours\.toFixed\(2\)\),/g, '');
content = content.replace(/totalOccupancy: Number\(\(plannedHours \+ continuousHours\)\.toFixed\(2\)\),/g, 'totalOccupancy: Number(plannedHours.toFixed(2)),');

fs.writeFileSync(path, content, 'utf8');
console.log("capacity.ts logic simplified to Ocupado/Livre only.");
