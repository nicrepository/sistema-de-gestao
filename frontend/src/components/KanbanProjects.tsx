import React, { useState } from 'react';
import { Project, Client, User } from '@/types';
import { Calendar, User as UserIcon, ArrowLeft, Search, Trash2, Plus, Building2, AlertTriangle } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

interface KanbanProjectsProps {
  projects: Project[];
  clients: Client[];
  onProjectClick: (projectId: string) => void;
  onNewProject: () => void;
  filteredClientId?: string | null;
  onBackToAdmin?: () => void;
  onDeleteProject?: (projectId: string) => void;
  user?: User;
  users: User[];
  projectMembers: { id_projeto: string; id_colaborador: string }[];
}

/* ===========================================================
   C O L U N A   D E   P R O J E T O S
=========================================================== */
const ProjectColumn: React.FC<{
  title: string;
  status: string;
  projects: Project[];
  clients: Client[];
  users: User[];
  projectMembers: { id_projeto: string; id_colaborador: string }[];
  onProjectClick: (projectId: string) => void;
  onDeleteClick?: (e: React.MouseEvent, project: Project) => void;
  isAdmin: boolean;
}> = ({ title, status, projects, clients, users, projectMembers, onProjectClick, onDeleteClick, isAdmin }) => {



  const safeProjects = projects || [];
  const safeClients = clients || [];

  const filteredProjects = safeProjects.filter((p) => {
    if (status === 'Em andamento') return p.active !== false;
    if (status === 'Concluído') return p.active === false;
    return true;
  });

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'Em andamento': return 'var(--status-progress)';
      case 'Concluído': return 'var(--status-done)';
      default: return 'var(--surface-2)';
    }
  };

  const getHeaderColor = (s: string) => {
    switch (s) {
      case 'Em andamento': return 'var(--primary)';
      case 'Concluído': return 'var(--success)';
      default: return 'var(--muted)';
    }
  };

  return (
    <div className="flex-1 min-w-[320px] flex flex-col h-full rounded-2xl p-4 border" style={{ backgroundColor: getStatusColor(status), borderColor: 'var(--border)' }}>
      <div className="flex justify-between items-center mb-4" style={{ color: getHeaderColor(status) }}>
        <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
        <span className="px-2 py-1 rounded-md text-xs font-bold shadow-sm" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>{filteredProjects.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {filteredProjects.map((project) => {
          const client = safeClients.find(c => c.id === project.clientId);

          return (
            <div
              key={project.id}
              onClick={() => onProjectClick(project.id)}
              className={`p-4 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-all group relative overflow-hidden`}
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {/* DELETE → Apenas Admin */}
              {isAdmin && onDeleteClick && (
                <button
                  onClick={(e) => onDeleteClick(e, project)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all z-20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Cliente */}
              <div className="flex items-center gap-2 mb-3">
                {client?.logoUrl && (
                  <img
                    src={client.logoUrl}
                    alt={client.name}
                    className="w-6 h-6 rounded-sm object-contain"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <span className="text-xs font-bold truncate max-w-[200px]" style={{ color: 'var(--text)' }}>
                  {client?.name || "Sem Cliente"}
                </span>
              </div>

              {/* Nome do Projeto */}
              <h4 className="font-bold mb-2 text-base leading-snug pr-4" style={{ color: 'var(--text)' }}>
                {project.name}
              </h4>

              {/* Descrição */}
              {project.description && (
                <p className="text-xs mb-3 line-clamp-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {project.description}
                </p>
              )}

              {/* Informações */}
              <div className="space-y-2 mb-3">
                {project.managerClient && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Gestor: {project.managerClient}</span>
                  </div>
                )}
                {project.budget && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                    <span className="font-semibold">Orçamento:</span>
                    <span>R$ {project.budget.toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <div className="flex flex-col" style={{ color: 'var(--muted)' }}>
                    {project.startDate && (
                      <span className="text-[10px]">
                        Início: {new Date(project.startDate).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {project.estimatedDelivery && (
                      <span className="text-[10px]">
                        Entrega: {new Date(project.estimatedDelivery).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-1 rounded-full`}
                  style={{
                    backgroundColor: status === 'Em andamento' ? 'var(--status-progress)' : 'var(--status-done)',
                    color: status === 'Em andamento' ? 'var(--primary)' : 'var(--success)',
                    border: '1px solid var(--border)'
                  }}>
                  {status}
                </span>
              </div>

              {/* Equipe do Projeto */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2 overflow-hidden">
                  {projectMembers
                    .filter(pm => String(pm.id_projeto) === String(project.id))
                    .map(pm => {
                      const member = users.find(u => u.id === String(pm.id_colaborador));
                      if (!member) return null;
                      return (
                        <div
                          key={member.id}
                          className="inline-block h-7 w-7 rounded-full flex items-center justify-center overflow-hidden border-2"
                          style={{ borderColor: 'var(--surface)', backgroundColor: 'var(--surface-2)', color: 'var(--text)' }}
                          title={member.name}
                        >
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt={member.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold">
                              {member.name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>

                {projectMembers.filter(pm => String(pm.id_projeto) === String(project.id)).length === 0 && (
                  <span className="text-[10px] text-slate-400 italic">Sem equipe</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ===========================================================
   K A N B A N   D E   P R O J E T O S
=========================================================== */
const KanbanProjects: React.FC<KanbanProjectsProps> = ({
  projects, clients, onProjectClick, onNewProject,
  filteredClientId, onBackToAdmin, onDeleteProject, user,
  users, projectMembers
}) => {

  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const safeProjects = projects || [];
  const safeClients = clients || [];
  const isAdmin = user?.role === 'admin' || user?.role === 'system_admin' || user?.role === 'ceo';

  // Filtrar por cliente específico (se fornecido)
  const clientFilteredProjects = filteredClientId
    ? safeProjects.filter(p => p.clientId === filteredClientId)
    : safeProjects;

  // Filtrar por busca
  const filteredProjects = clientFilteredProjects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentClient = filteredClientId
    ? safeClients.find(c => c.id === filteredClientId)
    : null;

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (projectToDelete && onDeleteProject) {
      onDeleteProject(projectToDelete.id);
      setDeleteModalOpen(false);
      setProjectToDelete(null);
    }
  };

  const statuses = ['Em andamento', 'Concluído'];

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>

      {/* HEADER */}
      <div className="shrink-0 border-b shadow-sm px-6 py-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-600"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-bold flex items-center gap-3" style={{ color: 'var(--text)' }}>
              {currentClient ? (
                <>
                  {currentClient.logoUrl && (
                    <img
                      src={currentClient.logoUrl}
                      alt={currentClient.name}
                      className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 p-1"
                    />
                  )}
                  {currentClient.name}
                </>
              ) : 'Board de Projetos'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {currentClient
                ? 'Gerencie todos os projetos desta empresa'
                : `${filteredProjects.length} projetos no total`
              }
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-4">
          {/* Search */}
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Filtrar projetos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-xl outline-none text-sm shadow-sm"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>

          <button
            className="bg-[#4c1d95] hover:bg-[#3b1675] text-white px-6 py-2.5 rounded-xl shadow-md transition-colors flex items-center gap-2 font-bold text-base whitespace-nowrap"
            onClick={onNewProject}
          >
            <Plus size={20} />
            Novo Projeto
          </button>
        </div>
      </div>

      {/* KANBAN COLUMNS */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="flex gap-4 h-full overflow-x-auto custom-scrollbar pb-4">
          {statuses.map((status) => (
            <ProjectColumn
              key={status}
              title={status}
              status={status}
              projects={filteredProjects}
              clients={safeClients}
              users={users}
              projectMembers={projectMembers}
              onProjectClick={onProjectClick}
              onDeleteClick={isAdmin ? handleDeleteClick : undefined}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO */}
      {deleteModalOpen && projectToDelete && (
        <ConfirmationModal
          isOpen={deleteModalOpen}
          title="Excluir Projeto"
          message={`Tem certeza que deseja excluir o projeto "${projectToDelete.name}"?`}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleteModalOpen(false);
            setProjectToDelete(null);
          }}
          confirmText="Excluir"
          confirmColor="red"
        />
      )}
    </div>
  );
};

export default KanbanProjects;
