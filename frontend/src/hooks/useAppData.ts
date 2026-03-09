// hooks/useAppData.ts
// Hook principal para carregar dados do Backend
import { useEffect, useState } from "react";
import {
  Client,
  Project,
  Task,
  TimesheetEntry,
  User,
  Absence,
  ProjectMember,
  TaskMemberAllocation,
  Holiday
} from "@/types";

import {
  fetchClients,
  fetchProjects,
  fetchTasks,
  fetchUsers,
  fetchTimesheets,
  fetchTaskCollaborators,
  fetchProjectMembers,
  fetchAbsences,
  fetchHolidays,
  fetchAllocations,
  DbTaskRow,
} from "@/services/api";
import { useAuth } from '@/contexts/AuthContext';
import {
  formatDate,
  mapDbTaskToTask,
  mapDbAbsenceToAbsence
} from "@/utils/normalizers";

interface AppData {
  users: User[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  timesheetEntries: TimesheetEntry[];
  projectMembers: ProjectMember[];
  taskMemberAllocations: TaskMemberAllocation[];
  absences: Absence[];
  holidays: Holiday[];
  loading: boolean;
  error: string | null;
}

const MOCK_TIMESHEETS: TimesheetEntry[] = [];

export function useAppData(): AppData {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>(MOCK_TIMESHEETS);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [taskMemberAllocations, setTaskMemberAllocations] = useState<TaskMemberAllocation[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser, isLoading: authLoading } = useAuth();

  const CACHE_KEY = 'nic_labs_app_data';
  const CACHE_VERSION = '3.0'; // bump: remove timesheets do cache

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.version === CACHE_VERSION) {
          setUsers(parsed.users || []);
          setClients(parsed.clients || []);
          setProjects(parsed.projects || []);
          setTasks(parsed.tasks || []);
          setTimesheetEntries(parsed.timesheetEntries || []);
          setProjectMembers(parsed.projectMembers || []);
          setTaskMemberAllocations(parsed.taskMemberAllocations || []);
          setAbsences(parsed.absences || []);
          setHolidays(parsed.holidays || []);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn('[useAppData] Erro ao carregar cache:', e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const urlParams = new URLSearchParams(window.location.search);
        const hasValidToken = urlParams.get('token') === 'xyz123';
        const localToken = localStorage.getItem('nic_labs_auth_token');

        if (!localToken && !currentUser && !hasValidToken) {
          setLoading(false);
          return;
        }

        const results = await Promise.allSettled([
          fetchUsers(),
          fetchClients(),
          fetchProjects(),
          fetchTasks(),
          fetchTaskCollaborators(),
          fetchProjectMembers(),
          fetchTimesheets(),
          fetchAbsences(),
          fetchHolidays(),
          fetchAllocations()
        ]);

        const safeResult = <T>(result: PromiseSettledResult<T>, fallback: T, name: string): T => {
          if (result.status === 'rejected') {
            console.warn(`[useAppData] ${name} falhou:`, result.reason?.message || result.reason);
            return fallback;
          }
          return result.value ?? fallback;
        };

        const usersData = safeResult(results[0], [] as any[], 'fetchUsers');
        const clientsData = safeResult(results[1], [] as any[], 'fetchClients');
        const projectsData = safeResult(results[2], [] as any[], 'fetchProjects');
        const tasksData = safeResult(results[3], [] as any[], 'fetchTasks');
        const tasksCollaboratorsData = safeResult(results[4], [] as any[], 'fetchTaskCollaborators');
        const membersData = safeResult(results[5], null as any, 'fetchProjectMembers');
        const rawTimesheets = safeResult(results[6], [] as any[], 'fetchTimesheets');
        const absencesData = safeResult(results[7], [] as any[], 'fetchAbsences');
        const holidaysData = safeResult(results[8], [] as any[], 'fetchHolidays');
        const allocationsData = safeResult(results[9], [] as any[], 'fetchAllocations');

        if (!isMounted) return;

        const userMap = new Map(usersData.map((u) => [u.id, u]));

        const tasksMapped: Task[] = tasksData.map((row: DbTaskRow) => {
          const r = row as any;
          const projectName = r.ID_Projeto ? projectsData.find((p) => p.id === String(r.ID_Projeto))?.name : undefined;
          const clientName = r.ID_Cliente ? clientsData.find((c) => c.id === String(r.ID_Cliente))?.name : undefined;
          return mapDbTaskToTask(row, userMap, projectName, clientName);
        });

        const collaboratorsMap = new Map<string, string[]>();
        (tasksCollaboratorsData || []).forEach(tc => {
          if (!collaboratorsMap.has(tc.taskId)) collaboratorsMap.set(tc.taskId, []);
          collaboratorsMap.get(tc.taskId)?.push(tc.userId);
        });

        tasksMapped.forEach(t => {
          t.collaboratorIds = collaboratorsMap.get(t.id) || [];
        });

        const taskExternalMap = new Map(tasksData.filter(t => t.ID_Tarefa).map(t => [String(t.ID_Tarefa).toLowerCase(), String(t.id_tarefa_novo)]));

        const timesheetMapped: TimesheetEntry[] = (rawTimesheets || []).map((r: any) => {
          // Helper para pegar valor de coluna de forma case-insensitive
          const getV = (obj: any, keys: string[]) => {
            const lowerObj: any = {};
            Object.keys(obj).forEach(k => lowerObj[k.toLowerCase()] = obj[k]);
            for (const k of keys) {
              const val = lowerObj[k.toLowerCase()];
              if (val !== undefined && val !== null) return val;
            }
            return null;
          };

          let taskId = String(getV(r, ['id_tarefa_novo', 'taskId']) || '');
          if (!taskId || taskId === 'null' || taskId === '0') {
            const extId = String(getV(r, ['ID_Tarefa', 'id_tarefa']) || '').toLowerCase();
            if (extId && taskExternalMap.has(extId)) {
              taskId = taskExternalMap.get(extId)!;
            } else {
              taskId = extId;
            }
          }

          const userId = String(getV(r, ['ID_Colaborador', 'id_colaborador', 'userId']) || '').trim();
          const clientId = String(getV(r, ['ID_Cliente', 'id_cliente', 'clientId']) || '').trim();
          const projectId = String(getV(r, ['ID_Projeto', 'id_projeto', 'projectId']) || '').trim();
          const entryId = String(getV(r, ['ID_Horas_Trabalhadas', 'id_horas_trabalhadas', 'id']) || crypto.randomUUID()).trim();
          const rawDate = getV(r, ['Data', 'data', 'date']);

          return {
            id: entryId,
            userId: userId,
            userName: userMap.get(userId)?.name || getV(r, ['userName', 'nome_colaborador']) || '',
            clientId: clientId,
            projectId: projectId,
            taskId: taskId,
            date: rawDate ? (String(rawDate).includes('T') ? String(rawDate).split('T')[0] : String(rawDate).split(' ')[0]) : formatDate(null),
            startTime: getV(r, ['Hora_Inicio', 'startTime']) || '09:00',
            endTime: getV(r, ['Hora_Fim', 'endTime']) || '18:00',
            totalHours: Number(getV(r, ['Horas_Trabalhadas', 'hours', 'totalHours']) || 0),
            lunchDeduction: !!getV(r, ['Almoco_Deduzido', 'lunchDeduction']),
            description: getV(r, ['Descricao', 'description']) || undefined,
          };
        });

        const absencesMapped = (absencesData || []).map(mapDbAbsenceToAbsence);
        const holidaysMapped: Holiday[] = (holidaysData || []).map((r: any) => ({
          id: String(r.id),
          name: r.nome,
          date: r.data,
          endDate: r.data_fim || r.data,
          type: r.tipo,
          observations: r.observacoes,
          period: r.periodo,
          endTime: r.hora_fim
        }));

        const deduplicateById = <T extends { id: string }>(items: T[]): T[] => {
          return Array.from(new Map(items.map(i => [i.id, i])).values());
        };

        setUsers(deduplicateById(usersData));
        setClients(deduplicateById(clientsData));
        setProjects(deduplicateById(projectsData));
        setTasks(deduplicateById(tasksMapped));
        setTimesheetEntries(deduplicateById(timesheetMapped));
        setAbsences(deduplicateById(absencesMapped));
        setHolidays(deduplicateById(holidaysMapped));
        setTaskMemberAllocations((allocationsData || []).map((row: any) => ({
          id: String(row.id),
          taskId: String(row.task_id),
          userId: String(row.user_id),
          reservedHours: Number(row.reserved_hours),
        })));

        if (membersData) {
          const membersMapped: ProjectMember[] = membersData.map((row: any) => ({
            id_pc: row.id_pc,
            id_projeto: row.id_projeto,
            id_colaborador: row.id_colaborador,
            allocation_percentage: row.allocation_percentage,
            start_date: row.start_date,
            end_date: row.end_date,
            role_in_project: row.role_in_project
          }));

          const uniqueMembers = Array.from(new Map(membersMapped.map((m) => [`${m.id_projeto}-${m.id_colaborador}`, m])).values());
          setProjectMembers(uniqueMembers);

          const cacheData = {
            version: CACHE_VERSION,
            timestamp: Date.now(),
            users: usersData,
            clients: clientsData,
            projects: projectsData,
            tasks: tasksMapped,
            // timesheets NÃO são cacheados (volume excessivo para localStorage)
            projectMembers: uniqueMembers,
            taskMemberAllocations: allocationsData,
            absences: absencesMapped,
            holidays: holidaysMapped
          };
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
          } catch (quotaErr) {
            // Se o localStorage estiver cheio, limpa caches antigos e tenta novamente
            console.warn('[useAppData] localStorage cheio, limpando cache antigo...');
            localStorage.removeItem(CACHE_KEY);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData)); } catch { /* ignora */ }
          }
        }

      } catch (err) {
        console.error('[useAppData] Erro:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Falha ao carregar dados do banco.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (!authLoading) {
      loadData();
    }

    return () => {
      isMounted = false;
    };
  }, [authLoading, currentUser?.id]);

  return {
    users,
    clients,
    projects,
    tasks,
    timesheetEntries,
    projectMembers,
    taskMemberAllocations,
    absences,
    holidays,
    loading,
    error,
  };
}