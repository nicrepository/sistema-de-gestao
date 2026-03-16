import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { Task, Project, Client, User, TimesheetEntry, Absence, ProjectMember, Holiday, TaskMemberAllocation } from '@/types';
import { enrichProjectsWithTaskDates } from '@/utils/projectUtils';
import { supabase } from '@/services/supabaseClient';
import { mapDbTaskToTask, mapDbProjectToProject, mapDbTimesheetToEntry } from '@/utils/normalizers';


interface DataContextType {
    clients: Client[];
    projects: Project[];
    tasks: Task[];
    users: User[];
    timesheetEntries: TimesheetEntry[];
    projectMembers: ProjectMember[];
    taskMemberAllocations: TaskMemberAllocation[];
    absences: Absence[];
    holidays: Holiday[];
    loading: boolean;
    error: string | null;
    refreshData: (force?: boolean) => Promise<void>;

    // Actions (para updates otimistas se necessário)
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setTimesheetEntries: React.Dispatch<React.SetStateAction<TimesheetEntry[]>>;
    setProjectMembers: React.Dispatch<React.SetStateAction<ProjectMember[]>>;
    setTaskMemberAllocations: React.Dispatch<React.SetStateAction<TaskMemberAllocation[]>>;
    setAbsences: React.Dispatch<React.SetStateAction<Absence[]>>;
    setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    // Hook que faz o fetch centralizado
    const {
        users: loadedUsers,
        clients: loadedClients,
        projects: loadedProjects,
        tasks: loadedTasks,
        timesheetEntries: loadedTimesheets,
        projectMembers: loadedProjectMembers,
        taskMemberAllocations: loadedTaskMemberAllocations,
        absences: loadedAbsences,
        holidays: loadedHolidays,
        refreshData,
        loading: dataLoading,
        error: dataError
    } = useAppData();

    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);
    const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
    const [taskMemberAllocations, setTaskMemberAllocations] = useState<TaskMemberAllocation[]>([]);
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);

    // Sincronizar dados globais quando o carregamento termina
    useEffect(() => {
        if (dataLoading) return;

        setClients(loadedClients);
        setUsers(loadedUsers);
        setTasks(loadedTasks);
        setProjects(enrichProjectsWithTaskDates(loadedProjects, loadedTasks));
        setTimesheetEntries(loadedTimesheets);
        setProjectMembers(loadedProjectMembers || []);
        setTaskMemberAllocations(loadedTaskMemberAllocations || []);
        setAbsences(loadedAbsences || []);

        setHolidays(loadedHolidays || []);
    }, [dataLoading, loadedClients, loadedProjects, loadedTasks, loadedUsers, loadedTimesheets, loadedProjectMembers, loadedAbsences, loadedHolidays]);

    // REALTIME: Escuta avisos do backend para recarregar dados
    useEffect(() => {
        const userMap = new Map(users.map(u => [u.id, u]));

        const channel = supabase.channel('app-updates')
            .on('broadcast', { event: 'refresh' }, ({ payload }) => {
                console.log('[Realtime] Mensagem:', payload);

                const { type, data } = payload;

                // Se não houver dados específicos, faz um refresh total (fallback)
                if (!data) {
                    refreshData();
                    return;
                }

                if (type === 'tasks') {
                    if (data.deleted) {
                        setTasks(prev => prev.filter(t => t.id !== String(data.id)));
                    } else {
                        const taskRow = data.data || data;
                        const normalizedTask = mapDbTaskToTask(taskRow, userMap);
                        setTasks(prev => {
                            const exists = prev.find(t => t.id === normalizedTask.id);
                            if (exists) {
                                return prev.map(t => t.id === normalizedTask.id ? { ...t, ...normalizedTask } : t);
                            }
                            return [...prev, normalizedTask];
                        });
                    }
                } else if (type === 'projects') {
                    if (data.deleted) {
                        setProjects(prev => prev.filter(p => p.id !== String(data.id)));
                    } else {
                        const projectRow = data.data || data;
                        const normalizedProject = mapDbProjectToProject(projectRow);
                        setProjects(prev => {
                            const exists = prev.find(p => p.id === normalizedProject.id);
                            if (exists) {
                                return prev.map(p => p.id === normalizedProject.id ? { ...p, ...normalizedProject } : p);
                            }
                            return [...prev, normalizedProject];
                        });
                    }
                } else if (type === 'timesheet') {
                    if (data.deleted) {
                        setTimesheetEntries(prev => prev.filter(e => e.id !== String(data.id)));
                    } else {
                        const row = data.data || data;
                        const normalizedEntry = mapDbTimesheetToEntry(row);
                        setTimesheetEntries(prev => {
                            const exists = prev.find(e => e.id === normalizedEntry.id);
                            if (exists) {
                                return prev.map(e => e.id === normalizedEntry.id ? { ...e, ...normalizedEntry } : e);
                            }
                            return [normalizedEntry, ...prev];
                        });
                    }
                } else {
                    // Outros tipos ou atualizações genéricas (ex: alocações, feriados)
                    // Forçamos o refresh para ignorar o throttle do useAppData
                    refreshData(true);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] WebSocket Conectado (Broadcast)');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [refreshData]);

    const value = React.useMemo(() => ({
        clients,
        projects: projects.filter(p => p.active !== false),
        tasks: tasks.filter(t => !t.deleted_at),
        users,
        timesheetEntries: timesheetEntries.filter(e => !(e as any).deleted_at),
        projectMembers,
        taskMemberAllocations,
        absences,
        holidays,
        loading: dataLoading,
        error: dataError,
        refreshData,
        setClients,
        setProjects,
        setTasks,
        setUsers,
        setTimesheetEntries,
        setProjectMembers,
        setTaskMemberAllocations,
        setAbsences,
        setHolidays
    }), [clients, projects, tasks, users, timesheetEntries, projectMembers, absences, holidays, dataLoading, dataError, refreshData]);

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) throw new Error('useData must be used within DataProvider');
    return context;
};
