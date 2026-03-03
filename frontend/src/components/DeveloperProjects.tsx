// components/DeveloperProjects.tsx - Simplificado para parecer com AdminProjects
import React from 'react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDataController } from '@/controllers/useDataController';
import { Briefcase, CheckSquare, LayoutGrid, List, Building2, FolderKanban } from 'lucide-react';

type ViewMode = 'grid' | 'list';

const DeveloperProjects: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const { tasks, projects, clients, projectMembers, users, loading } = useDataController();

  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    const saved = localStorage.getItem('project_view_mode_dev');
    return (saved as ViewMode) || 'list';
  });

  const handleToggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('project_view_mode_dev', mode);
  };

  const isProjectIncomplete = (p: any) => {
    return (
      !p.name?.trim() ||
      !p.clientId ||
      !p.partnerId ||
      !p.valor_total_rs ||
      !p.horas_vendidas ||
      !p.startDate ||
      !p.estimatedDelivery ||
      !p.responsibleNicLabsId ||
      !p.managerClient ||
      projectMembers.filter(pm => String(pm.id_projeto) === p.id).length === 0
    );
  };

  // === FILTRAGEM DE DADOS (Limitação do Colaborador) ===
  const myTasks = React.useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return tasks;
    return tasks.filter(t =>
      t.developerId === currentUser.id ||
      (t.collaboratorIds && t.collaboratorIds.includes(currentUser.id))
    );
  }, [tasks, currentUser, isAdmin]);

  const myProjectIdsFromTasks = React.useMemo(() => new Set(myTasks.map(t => t.projectId)), [myTasks]);

  const myMemberProjectIds = React.useMemo(() => {
    if (!currentUser || !projectMembers) return new Set<string>();
    return new Set(
      projectMembers
        .filter(pm => String(pm.id_colaborador) === String(currentUser.id))
        .map(pm => String(pm.id_projeto))
    );
  }, [projectMembers, currentUser]);

  const myProjects = React.useMemo(() => {
    if (!currentUser) return [];
    let filtered = projects;
    if (!isAdmin) {
      // Projetos onde tem tarefa OU é membro
      filtered = projects.filter(p => myProjectIdsFromTasks.has(p.id) || myMemberProjectIds.has(p.id));
    }
    // Ocultar projetos "fora do fluxo" por padrão
    return filtered.filter(p => !p.fora_do_fluxo);
  }, [projects, myProjectIdsFromTasks, myMemberProjectIds, currentUser, isAdmin]);

  const myClients = React.useMemo(() => {
    const clientIds = new Set(myProjects.map(p => p.clientId));
    return clients.filter(c => clientIds.has(c.id));
  }, [clients, myProjects]);

  return (
    <div className="h-full flex flex-col p-8 bg-[var(--bgApp)]">

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--textTitle)' }}>
            <Briefcase className="w-6 h-6" style={{ color: 'var(--brand)' }} />
            Meus Projetos
          </h1>
          <p className="mt-1" style={{ color: 'var(--textMuted)' }}>
            Você está vinculado a {myProjects.length} projetos
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white/10 p-1 rounded-xl border mr-2" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => handleToggleViewMode('grid')}
              className={`p-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-[#4c1d95] text-white shadow-md' : 'text-[var(--textMuted)] hover:bg-white/5'}`}
              title="Visualização em Blocos"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-xs font-bold hidden md:block">Blocos</span>
            </button>
            <button
              onClick={() => handleToggleViewMode('list')}
              className={`p-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-[#4c1d95] text-white shadow-md' : 'text-[var(--textMuted)] hover:bg-white/5'}`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
              <span className="text-xs font-bold hidden md:block">Lista</span>
            </button>
          </div>
        </div>
      </div>


      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--brand)' }}></div>
              <p className="animate-pulse" style={{ color: 'var(--textMuted)' }}>Carregando seus projetos...</p>
            </div>
          </div>
        ) : myProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--textMuted)' }}>
            <FolderKanban className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-2 text-center">Nenhum projeto vinculado a você.</p>
            <p className="text-sm">Solicite acesso a um administrador.</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-8 pb-10">
            {myClients.map(client => {
              const clientProjects = myProjects.filter(p => p.clientId === client.id);
              return (
                <div key={client.id} className="space-y-4">
                  <div className="flex items-center gap-4 py-3 px-4 border-l-4 rounded-r-xl bg-white/5 border-[var(--brand)]" style={{ borderColor: 'var(--brand)' }}>
                    <div className="w-10 h-10 rounded-lg border p-1.5 flex items-center justify-center bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
                      {client.logoUrl ? (
                        <img src={client.logoUrl} alt={client.name} className="w-full h-full object-contain" />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg" style={{ color: 'var(--textTitle)' }}>{client.name}</h3>
                      <p className="text-xs" style={{ color: 'var(--textMuted)' }}>{clientProjects.length} projetos vinculados</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pl-4 md:pl-10">
                    {clientProjects.map(project => {
                      const allProjectTasks = tasks.filter(t => t.projectId === project.id);
                      const myProjectTasks = isAdmin ? allProjectTasks : allProjectTasks.filter(t =>
                        t.developerId === currentUser?.id ||
                        (t.collaboratorIds && t.collaboratorIds.includes(currentUser?.id || ''))
                      );
                      const myDoneTasks = myProjectTasks.filter(t => t.status === 'Done').length;

                      const getStatusColor = () => {
                        const hasDelayed = myProjectTasks.some(t => {
                          if (t.status === 'Done' || t.status === 'Review') return false;
                          if (!t.estimatedDelivery) return false;
                          const parts = t.estimatedDelivery.split('-');
                          if (parts.length !== 3) return false;
                          const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return today > due;
                        });
                        if (hasDelayed) return { borderColor: '#ef4444', shadowColor: 'rgba(239, 68, 68, 0.2)', borderWidth: '2px' };

                        const hasImpediment = myProjectTasks.some(t => t.is_impediment);
                        if (hasImpediment) return { borderColor: '#f59e0b', shadowColor: 'rgba(245, 158, 11, 0.2)', borderWidth: '2px' };

                        const hasInProgress = myProjectTasks.some(t => t.status === 'In Progress' || t.status === 'Review');
                        if (hasInProgress) return { borderColor: '#3b82f6', shadowColor: 'rgba(59, 130, 246, 0.2)', borderWidth: '2px' };

                        const isAllDone = myProjectTasks.length > 0 && myProjectTasks.every(t => t.status === 'Done');
                        if (isAllDone) return { borderColor: '#10b981', shadowColor: 'rgba(16, 185, 129, 0.2)', borderWidth: '2px' };

                        return { borderColor: 'var(--border)', shadowColor: 'rgba(0,0,0,0.05)', borderWidth: '1px' };
                      };

                      const statusStyle = getStatusColor();

                      return (
                        <button
                          key={project.id}
                          onClick={() => navigate(`/developer/projects/${project.id}`)}
                          className="rounded-xl p-5 hover:shadow-lg transition-all text-left group relative overflow-hidden"
                          style={{
                            backgroundColor: 'var(--surface)',
                            borderColor: statusStyle.borderColor,
                            borderWidth: statusStyle.borderWidth,
                            borderStyle: 'solid',
                            boxShadow: `0 4px 6px -1px ${statusStyle.shadowColor}`
                          }}
                        >
                          <h3 className="text-lg font-bold mb-2 group-hover:text-[var(--brand)]" style={{ color: 'var(--textTitle)' }}>
                            {project.name}
                          </h3>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                              <CheckSquare className="w-4 h-4 text-green-500" />
                              <span>{myDoneTasks}/{myProjectTasks.length} minhas tarefas</span>
                            </div>
                            {project.status && (
                              <div className="text-xs" style={{ color: 'var(--textMuted)' }}>
                                Status: <span className="font-medium" style={{ color: 'var(--text)' }}>{project.status}</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex -space-x-2">
                              {projectMembers
                                .filter(pm => String(pm.id_projeto) === String(project.id))
                                .map(pm => {
                                  const member = users.find(u => u.id === String(pm.id_colaborador));
                                  if (!member) return null;
                                  return (
                                    <div
                                      key={member.id}
                                      className="w-7 h-7 rounded-full border-2 flex items-center justify-center overflow-hidden"
                                      style={{
                                        backgroundColor: 'var(--bgApp)',
                                        borderColor: 'var(--surface)'
                                      }}
                                      title={member.name}
                                    >
                                      {member.avatarUrl ? (
                                        <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-[10px] font-bold" style={{ color: 'var(--textMuted)' }}>
                                          {member.name.substring(0, 2).toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myProjects.map(project => {
              const client = clients.find(c => c.id === project.clientId);
              const allProjectTasks = tasks.filter(t => t.projectId === project.id);
              const myProjectTasks = isAdmin ? allProjectTasks : allProjectTasks.filter(t =>
                t.developerId === currentUser?.id ||
                (t.collaboratorIds && t.collaboratorIds.includes(currentUser?.id || ''))
              );
              const myDoneTasks = myProjectTasks.filter(t => t.status === 'Done').length;

              const getStatusColor = () => {
                const hasDelayed = myProjectTasks.some(t => {
                  if (t.status === 'Done' || t.status === 'Review') return false;
                  if (!t.estimatedDelivery) return false;
                  const parts = t.estimatedDelivery.split('-');
                  if (parts.length !== 3) return false;
                  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return today > due;
                });
                if (hasDelayed) return { borderColor: '#ef4444', shadowColor: 'rgba(239, 68, 68, 0.2)', borderWidth: '2px' };

                const hasImpediment = myProjectTasks.some(t => t.is_impediment);
                if (hasImpediment) return { borderColor: '#f59e0b', shadowColor: 'rgba(245, 158, 11, 0.2)', borderWidth: '2px' };

                const hasInProgress = myProjectTasks.some(t => t.status === 'In Progress' || t.status === 'Review');
                if (hasInProgress) return { borderColor: '#3b82f6', shadowColor: 'rgba(59, 130, 246, 0.2)', borderWidth: '2px' };

                const isAllDone = myProjectTasks.length > 0 && myProjectTasks.every(t => t.status === 'Done');
                if (isAllDone) return { borderColor: '#10b981', shadowColor: 'rgba(16, 185, 129, 0.2)', borderWidth: '2px' };

                return { borderColor: 'var(--border)', shadowColor: 'rgba(0,0,0,0.05)', borderWidth: '1px' };
              };

              const statusStyle = getStatusColor();

              return (
                <button
                  key={project.id}
                  onClick={() => navigate(`/developer/projects/${project.id}`)}
                  className="rounded-xl p-6 hover:shadow-lg transition-all text-left group relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: statusStyle.borderColor,
                    borderWidth: statusStyle.borderWidth,
                    borderStyle: 'solid',
                    boxShadow: `0 4px 6px -1px ${statusStyle.shadowColor}`
                  }}
                >
                  {client && (
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                      <div className="w-8 h-8 rounded p-1 flex items-center justify-center bg-[var(--bgApp)]">
                        {client.logoUrl ? (
                          <img src={client.logoUrl} alt={client.name} className="w-full h-full object-contain" />
                        ) : (
                          <Building2 className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <span className="text-xs" style={{ color: 'var(--textMuted)' }}>{client.name}</span>
                    </div>
                  )}

                  <h3 className="text-lg font-bold mb-2 group-hover:text-[var(--brand)]" style={{ color: 'var(--textTitle)' }}>
                    {project.name}
                  </h3>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                      <CheckSquare className="w-4 h-4 text-green-500" />
                      <span>{myDoneTasks}/{myProjectTasks.length} minhas tarefas</span>
                    </div>

                    {project.status && (
                      <div className="text-xs" style={{ color: 'var(--textMuted)' }}>
                        Status: <span className="font-medium" style={{ color: 'var(--text)' }}>{project.status}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex -space-x-2">
                      {projectMembers
                        .filter(pm => String(pm.id_projeto) === String(project.id))
                        .map(pm => {
                          const member = users.find(u => u.id === String(pm.id_colaborador));
                          if (!member) return null;
                          return (
                            <div
                              key={member.id}
                              className="w-7 h-7 rounded-full border-2 flex items-center justify-center overflow-hidden"
                              style={{
                                backgroundColor: 'var(--bgApp)',
                                borderColor: 'var(--surface)'
                              }}
                              title={member.name}
                            >
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-bold" style={{ color: 'var(--textMuted)' }}>
                                  {member.name.substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeveloperProjects;
