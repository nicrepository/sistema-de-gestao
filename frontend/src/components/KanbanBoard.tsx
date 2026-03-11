// components/KanbanBoard.tsx - Adaptado para Router
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDataController } from '@/controllers/useDataController';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Client, Project, Status, User } from '@/types';
import {
  Calendar,
  User as UserIcon,
  AlertCircle,
  AlertTriangle,
  Search,
  Trash2,
  ArrowLeft,
  GripVertical,
  Clock,
  ChevronDown,
  Check,
  Filter,
  CheckSquare,
  Plus,
  Briefcase,
  Flag,
  Archive,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from './ConfirmationModal';
import { TaskCreationModal } from './TaskCreationModal';

const STATUS_COLUMNS: { id: Status; title: string; color: string; bg: string; badgeColor: string }[] = [
  { id: 'Todo', title: 'Pré-Projeto', color: 'var(--muted)', bg: 'var(--surface-2)', badgeColor: 'var(--muted)' },
  { id: 'Review', title: 'Análise', color: 'var(--muted)', bg: 'var(--surface-2)', badgeColor: 'var(--muted)' },
  { id: 'In Progress', title: 'Andamento', color: 'var(--muted)', bg: 'var(--surface-2)', badgeColor: 'var(--muted)' },
  { id: 'Testing', title: 'Teste', color: 'var(--muted)', bg: 'var(--surface-2)', badgeColor: 'var(--muted)' },
  { id: 'Done', title: 'Concluído', color: 'var(--muted)', bg: 'var(--surface-2)', badgeColor: 'var(--muted)' },
];

const STATUS_ORDER: Status[] = ['Todo', 'Review', 'In Progress', 'Testing', 'Done'];

const PULSE_ANIMATIONS = `
  @keyframes pulse-impediment {
    0% { border-color: #ea580c; box-shadow: 0 0 5px rgba(234, 88, 12, 0.3); background-color: rgba(234, 88, 12, 0.06); }
    50% { border-color: #f97316; box-shadow: 0 0 20px rgba(234, 88, 12, 0.7); background-color: rgba(234, 88, 12, 0.18); }
    100% { border-color: #ea580c; box-shadow: 0 0 5px rgba(234, 88, 12, 0.3); background-color: rgba(234, 88, 12, 0.06); }
  }
  @keyframes pulse-delayed {
    0% { border-color: #dc2626; box-shadow: 0 0 5px rgba(220, 38, 38, 0.3); background-color: rgba(220, 38, 38, 0.06); }
    50% { border-color: #ef4444; box-shadow: 0 0 20px rgba(220, 38, 38, 0.7); background-color: rgba(220, 38, 38, 0.18); }
    100% { border-color: #dc2626; box-shadow: 0 0 5px rgba(220, 38, 38, 0.3); background-color: rgba(220, 38, 38, 0.06); }
  }
  .pulse-impediment {
    animation: pulse-impediment 1.5s infinite ease-in-out;
    border-width: 2px !important;
  }
  .pulse-delayed {
    animation: pulse-delayed 1.5s infinite ease-in-out;
    border-width: 2px !important;
  }
`;

/* ================== CARD ================== */
const KanbanCard = ({
  task,
  client,
  project,
  onTaskClick,
  onDelete,
  isAdmin,
  isHighlighted,
  users,
  currentUserId
}: {
  task: Task;
  client?: Client;
  project?: Project;
  onTaskClick: (id: string) => void;
  onDelete?: (e: React.MouseEvent, t: Task) => void;
  isAdmin: boolean;
  isHighlighted?: boolean;
  users: User[];
  currentUserId?: string;
}) => {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: { type: 'Task', task },
    disabled: false // Todos podem mover tarefas agora
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDelayed = useMemo(() => {
    if (task.status === 'Done' || task.status === 'Review' || (task.progress || 0) >= 100) return false;
    if (!task.estimatedDelivery) return false;
    const parts = task.estimatedDelivery.split('-');
    if (parts.length !== 3) return false;
    const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today > due;
  }, [task]);

  const isStudy = useMemo(() => {
    const name = (project?.name || '').toLowerCase();
    return name.includes('treinamento') || name.includes('capacitação');
  }, [project]);

  const getCardTheme = () => {
    if (task.is_impediment) return { color: '#ea580c', pulseClass: 'pulse-impediment', colored: true };
    if (isDelayed) return { color: '#dc2626', pulseClass: 'pulse-delayed', colored: true };
    if (isStudy) return { color: '#0ea5e9', colored: true };
    return { color: 'var(--border)', colored: false };
  };

  const theme = getCardTheme();

  const handleCreateTimesheet = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `/timesheet/new?taskId=${task.id}&projectId=${task.projectId}&clientId=${task.clientId}&date=${new Date().toISOString().split('T')[0]}`;
    onTaskClick('__NAVIGATE__:' + url);
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, borderColor: 'var(--muted)' }}
        className="opacity-40 border-2 border-dashed rounded-xl h-[180px] w-full"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <style>{PULSE_ANIMATIONS}</style>
      <div
        {...attributes}
        {...listeners}
        className={`
          relative group flex flex-col gap-3 p-4 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing
          transition-all duration-300 ease-out
          ${theme.pulseClass || ''}
        `}
        style={{
          backgroundColor: task.is_impediment
            ? 'rgba(234, 88, 12, 0.06)'
            : isDelayed
              ? 'rgba(220, 38, 38, 0.06)'
              : isStudy
                ? 'rgba(14, 165, 233, 0.06)'
                : isHighlighted
                  ? 'var(--surface-hover)'
                  : 'var(--surface)',
          borderColor: isHighlighted ? 'var(--primary)' : theme.color,
          boxShadow: task.is_impediment || isDelayed
            ? undefined
            : isHighlighted ? '0 0 0 2px var(--primary)' : 'var(--shadow)',
          transform: isHighlighted ? 'scale(1.02)' : 'none',
          borderTopWidth: theme.colored ? '4px' : '0px',
          borderTopColor: theme.colored ? theme.color : 'transparent'
        }}
        onClick={() => onTaskClick(task.id)}
      >
        <div className="flex justify-between items-start text-left">
          <div className="flex items-center gap-2 max-w-[85%]">
            <div style={{ color: 'var(--muted)' }}>
              <GripVertical size={14} />
            </div>
            {client?.logoUrl && (
              <img
                src={client.logoUrl}
                className="w-4 h-4 rounded-sm object-contain"
                alt=""
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.style.display = 'none';
                }}
              />
            )}
            <span className="text-[10px] uppercase font-bold truncate" style={{ color: 'var(--muted)' }}>
              {client?.name || 'Sem Empresa'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {task.is_impediment && (
              <div style={{ color: '#ea580c' }} title="Tarefa Travada / Impedimento">
                <AlertCircle size={14} className="animate-pulse" />
              </div>
            )}
            {isDelayed && (
              <div style={{ color: '#dc2626' }} title="Atrasado">
                <AlertTriangle size={14} />
              </div>
            )}
          </div>
        </div>

        {onDelete && (
          <button
            onClick={(e) => onDelete(e, task)}
            className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
          >
            <Trash2 size={14} />
          </button>
        )}

        <div className="flex text-left">
          <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-md max-w-full truncate"
            style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid var(--border)' }}>
            {project?.name || 'Geral'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-sm leading-snug line-clamp-2 text-left" style={{ color: 'var(--text)' }}>
            {task.title || "(Sem título)"}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
            <div
              className={`h-full rounded-full`}
              style={{
                width: `${task.progress || 0}%`,
                backgroundColor: task.is_impediment
                  ? '#ea580c'
                  : isDelayed
                    ? '#dc2626'
                    : isStudy
                      ? '#0ea5e9'
                      : 'var(--primary)'
              }}
            />
          </div>
          <span className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>{task.progress || 0}%</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t mt-1" style={{ borderColor: 'var(--border)' }}>
          <div className="flex -space-x-1.5 overflow-hidden">
            {/* Responsável Principal */}
            {(() => {
              const dev = users.find(u => u.id === task.developerId);
              return (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/team/${dev?.id || task.developerId}`); }}
                  className="w-6 h-6 rounded-full flex items-center justify-center border hover:z-10 transition-all cursor-pointer bg-white overflow-hidden active:scale-95"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                  title={`Responsável: ${dev?.name || task.developer || 'N/A'}`}
                >
                  {dev?.avatarUrl ? (
                    <img
                      src={dev.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(dev?.name || task.developer || 'Dev')}&background=f8fafc&color=475569`;
                      }}
                    />
                  ) : (
                    <UserIcon size={12} />
                  )}
                </button>
              );
            })()}

            {/* Colaboradores Extras */}
            {(task.collaboratorIds || [])
              .filter(uid => uid !== task.developerId) // Evitar duplicar o dono se ele estiver no array
              .slice(0, 3).map(uid => {
                const u = users.find(user => user.id === uid);
                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/team/${uid}`); }}
                    className="w-6 h-6 rounded-full flex items-center justify-center border hover:z-10 transition-all cursor-pointer bg-slate-50 overflow-hidden active:scale-95"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                    title={`Colaborador: ${u?.name || uid}`}
                  >
                    {u?.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.name || uid)}&background=f8fafc&color=475569`;
                        }}
                      />
                    ) : (
                      <UserIcon size={12} />
                    )}
                  </button>
                );
              })}

            {(task.collaboratorIds?.length || 0) > 3 && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center border bg-slate-100 text-[8px] font-bold"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                +{task.collaboratorIds!.length - 3}
              </div>
            )}
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md`}
            style={{
              backgroundColor: isDelayed
                ? 'rgba(220, 38, 38, 0.1)'
                : isStudy
                  ? 'rgba(14, 165, 233, 0.1)'
                  : 'var(--surface)',
              color: isDelayed
                ? '#dc2626'
                : isStudy
                  ? '#0ea5e9'
                  : 'var(--muted)',
              border: isDelayed
                ? '1px solid #dc2626'
                : isStudy
                  ? '1px solid #0ea5e9'
                  : '1px solid var(--border)'
            }}>
            <Calendar size={10} />
            <span>
              {(() => {
                if (task.status === 'Done') {
                  if (!task.actualDelivery) return 'Concluído';
                  const parts = task.actualDelivery.split('-');
                  if (parts.length !== 3) return 'Concluído';
                  return `Entregue ${parts[2]}/${parts[1]}`;
                }

                if (!task.estimatedDelivery) return '-';

                const parts = task.estimatedDelivery.split('-');
                const deadline = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                const formattedDate = deadline.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                const now = new Date();
                now.setHours(0, 0, 0, 0);

                const diffTime = deadline.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let countdown = '';
                if (diffDays < 0) countdown = 'Atrasado';
                else if (diffDays === 0) countdown = 'Hoje';
                else if (diffDays === 1) countdown = 'Amanhã';
                else if (diffDays <= 3) countdown = `Faltam ${diffDays}d`;

                return countdown ? `${formattedDate} • ${countdown}` : formattedDate;
              })()}
            </span>
          </div>
        </div>

        {task.status !== 'Done' && !isAdmin && (
          // Mostrar botão de apontar APENAS para colaboradores (dev ou co-dev), impedindo para admins
          task.developerId === currentUserId ||
          (task.collaboratorIds || []).includes(currentUserId || '')
        ) && (
            <button
              onClick={handleCreateTimesheet}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-all text-[11px] font-bold border shadow-sm"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--primary)',
                color: 'var(--primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
            >
              <Clock size={12} />
              Apontar Tarefa
            </button>
          )}
      </div>
    </div>
  );
};

/* ================== COLUMN ================== */
const KanbanColumn = ({
  col,
  tasks,
  clients,
  projects,
  onTaskClick,
  onDelete,
  isAdmin,
  highlightedTaskId,
  users,
  onLoadMore,
  hasMore,
  totalCount,
  currentUserId,
  showDoneColumn,
  setShowDoneColumn,
  onClientFilterChange,
  selectedClientFilter,
  availableClients
}: {
  col: typeof STATUS_COLUMNS[0];
  tasks: Task[];
  clients: Client[];
  projects: Project[];
  onTaskClick: (id: string) => void;
  onDelete: (e: React.MouseEvent, t: Task) => void;
  isAdmin: boolean;
  highlightedTaskId: string | null;
  users: User[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  totalCount?: number;
  currentUserId?: string;
  onClientFilterChange?: (clientId: string) => void;
  selectedClientFilter?: string;
  availableClients?: Client[];
  showDoneColumn?: boolean;
  setShowDoneColumn?: (show: boolean) => void;
}) => {
  const { setNodeRef } = useSortable({
    id: col.id,
    data: { type: 'Column', status: col.id },
  });

  return (
    <div
      ref={setNodeRef}
      className="flex-1 min-w-[200px] rounded-2xl flex flex-col h-full transition-all"
      style={{
        backgroundColor: col.bg,
        border: '1px solid var(--border)'
      }}
    >
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: col.badgeColor }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.badgeColor }} />
          {col.title}
        </h3>
        <div className="flex items-center gap-2">
          {/* Filtro de Empresas - Apenas para coluna Done */}
          {col.id === 'Done' && onClientFilterChange && availableClients && availableClients.length > 0 && (
            <select
              value={selectedClientFilter || ''}
              onChange={(e) => onClientFilterChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="px-2 py-1 text-[9px] font-bold rounded-lg border transition-all"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text)'
              }}
            >
              <option value="">Todas</option>
              {availableClients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          )}
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--bg)', color: col.badgeColor, border: '1px solid var(--border)' }}>
            {totalCount !== undefined ? totalCount : tasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              client={clients.find((c) => c.id === task.clientId)}
              project={projects.find((p) => p.id === task.projectId)}
              onTaskClick={onTaskClick}
              onDelete={onDelete}
              isAdmin={isAdmin}
              isHighlighted={highlightedTaskId === task.id}
              users={users}
              currentUserId={currentUserId}
            />
          ))}
        </SortableContext>
        {onLoadMore && hasMore && (
          <button
            onClick={onLoadMore}
            className="w-full py-2 mb-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all hover:bg-black/5 active:scale-95 flex items-center justify-center gap-2"
            style={{ color: col.badgeColor }}
          >
            <Plus className="w-4 h-4" />
            Carregar mais 10
          </button>
        )}
      </div>
    </div>
  );
};

/* ================== BOARD ================== */
export const KanbanBoard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, isAdmin } = useAuth();
  const { tasks, clients, projects, users, timesheetEntries, updateTask, deleteTask, loading } = useDataController();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [showDevMenu, setShowDevMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [devSearchTerm, setDevSearchTerm] = useState('');
  const [showTaskCreationModal, setShowTaskCreationModal] = useState(false);
  const [showOnlyDelayed, setShowOnlyDelayed] = useState(false);
  const [showOnlyImpediments, setShowOnlyImpediments] = useState(false);
  const [doneLimit, setDoneLimit] = useState(10);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('');
  const [showDoneColumn, setShowDoneColumn] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [shouldDeleteHours, setShouldDeleteHours] = useState(false);
  const [isForceDelete, setIsForceDelete] = useState(false);

  // Auxiliar para detectar atraso
  const isTaskDelayed = useCallback((t: Task) => {
    if (t.status === 'Done' || t.status === 'Review' || (t.progress || 0) >= 100) return false;
    if (!t.estimatedDelivery) return false;
    const parts = t.estimatedDelivery.split('-');
    if (parts.length !== 3) return false;
    const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today > due;
  }, []);

  // Memo para estatísticas de filtros
  const stats = useMemo(() => {
    const accessible = tasks.filter(t => {
      const isOwner = t.developerId === currentUser?.id;
      const isCollaborator = t.collaboratorIds?.includes(currentUser?.id || '');
      return isAdmin || isOwner || isCollaborator;
    });

    return {
      delayed: accessible.filter(isTaskDelayed).length,
      impeded: accessible.filter(t => t.is_impediment).length
    };
  }, [tasks, currentUser, isAdmin, isTaskDelayed]);

  // Memo para identificar desenvolvedores com atrasos
  const lateDevelopers = useMemo(() => {
    const devMap = new Map<string, { user: User; count: number }>();
    tasks.forEach(t => {
      if (isTaskDelayed(t) && t.developerId) {
        const u = users.find(user => user.id === t.developerId);
        if (u) {
          const existing = devMap.get(t.developerId) || { user: u, count: 0 };
          devMap.set(t.developerId, { ...existing, count: existing.count + 1 });
        }
      }
    });
    return Array.from(devMap.values()).sort((a, b) => b.count - a.count);
  }, [tasks, users]);

  // Filters from Query Params
  const filteredClientId = searchParams.get('clientId') || searchParams.get('client');
  const filteredProjectId = searchParams.get('projectId') || searchParams.get('project');

  const filteredDeveloperIds = useMemo(() => {
    const ids = searchParams.get('developerIds') || searchParams.get('developerId');
    return ids ? ids.split(',').filter(Boolean) : [];
  }, [searchParams]);

  // New local state for additional filtering - MULTI SELECT
  const [selectedDeveloperIds, setSelectedDeveloperIds] = useState<string[]>(filteredDeveloperIds);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>(filteredDeveloperIds);

  // Sync with URL
  useEffect(() => {
    setSelectedDeveloperIds(filteredDeveloperIds);
    setTempSelectedIds(filteredDeveloperIds);
  }, [filteredDeveloperIds]);

  const filteredTasks = useMemo(() => {
    let result = tasks.filter((t) => {
      // 1. Core filters (Admin sees all, Dev sees ONLY own)
      const isOwner = t.developerId === currentUser?.id;
      const isCollaborator = t.collaboratorIds?.includes(currentUser?.id || '');
      const hasPermission = isAdmin || isOwner || isCollaborator;

      if (!hasPermission) return false;

      // Se não for admin, ele vê APENAS as dele obrigatoriamente
      if (!isAdmin && !isOwner && !isCollaborator) return false;

      // 2. Client/Project context (from URL)
      if (filteredClientId && t.clientId !== filteredClientId) return false;
      if (filteredProjectId && t.projectId !== filteredProjectId) return false;

      // 3. User Filter (from Select) - Multiple Selection Support
      if (selectedDeveloperIds.length > 0) {
        const isSelectedOwner = selectedDeveloperIds.includes(t.developerId || '');
        const isSelectedCollaborator = (t.collaboratorIds || []).some(id => selectedDeveloperIds.includes(id));
        if (!isSelectedOwner && !isSelectedCollaborator) return false;
      }

      // 4. Delayed Filter
      if (showOnlyDelayed && !isTaskDelayed(t)) return false;

      // 5. Impediments Filter
      if (showOnlyImpediments && !t.is_impediment) return false;

      // 6. Global Search - Refinado para Clientes e Projetos ignorando acentos
      if (searchTerm) {
        const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

        // Match no título ou descrição
        const titleMatch = (t.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").includes(term);
        const descMatch = (t.description || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").includes(term);
        if (titleMatch || descMatch) return true;

        // Match no desenvolvedor
        const developer = users.find(u => u.id === t.developerId);
        const devName = (developer?.name || t.developer || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        if (devName.includes(term)) return true;

        // Match no cliente
        const client = clients.find(c => c.id === t.clientId);
        const clientMatch = (client?.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").includes(term);
        if (clientMatch) return true;

        // Match no projeto
        const project = projects.find(p => p.id === t.projectId);
        const projectMatch = (project?.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").includes(term);
        if (projectMatch) return true;

        return false;
      }

      return true;
    });

    return result;
  }, [tasks, currentUser, isAdmin, filteredClientId, filteredProjectId, selectedDeveloperIds, showOnlyDelayed, showOnlyImpediments, searchTerm, users, clients, projects]);

  // Calcular empresas disponíveis para filtro (apenas empresas onde o usuário concluiu tarefas)
  const availableClientsForDoneFilter = useMemo(() => {
    if (!currentUser) return [];

    const doneTasks = filteredTasks.filter(t => t.status === 'Done');
    const clientIds = new Set(doneTasks.map(t => t.clientId));

    return clients
      .filter(c => clientIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTasks, clients, currentUser]);

  const currentClient = useMemo(() => clients.find(c => c.id === filteredClientId), [clients, filteredClientId]);
  const currentProject = useMemo(() => projects.find(p => p.id === filteredProjectId), [projects, filteredProjectId]);

  // Highlight effect
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId) {
      setHighlightedTaskId(highlightId);
      const timer = setTimeout(() => setHighlightedTaskId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // DND Kit setup
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    let newStatus: Status;
    if (STATUS_COLUMNS.some(col => col.id === overId)) {
      newStatus = overId as Status;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      newStatus = overTask?.status as Status;
    }

    if (activeTask.status !== newStatus) {
      // Regra: Não permitir voltar status
      const oldIndex = STATUS_ORDER.indexOf(activeTask.status);
      const newIndex = STATUS_ORDER.indexOf(newStatus);

      if (newIndex < oldIndex) {
        // Permitir voltar apenas se for entre In Progress e Testing
        const isTestingFlow = (activeTask.status === 'Testing' && newStatus === 'In Progress') ||
          (activeTask.status === 'In Progress' && newStatus === 'Testing');

        if (!isTestingFlow) {
          return;
        }
      }

      // Calcular novo progresso automático
      let newProgress = activeTask.progress;
      // Progress calculation removed to allow manual control only

      try {
        const updatePayload: any = {
          status: newStatus,
          progress: newProgress,
        };

        // Automatizar datas reais baseadas no status
        if (newStatus === 'In Progress' && !activeTask.actualStart) {
          updatePayload.actualStart = new Date().toISOString().split('T')[0];
        }

        // Se mudou para "Done", garantir progresso 100% e registrar data real se necessário
        if (newStatus === 'Done') {
          updatePayload.progress = 100;
          if (!activeTask.actualDelivery) {
            updatePayload.actualDelivery = new Date().toISOString().split('T')[0];
          }
        }

        // Atualizar via Controller
        await updateTask(activeId, updatePayload);
      } catch (error) {
        console.error("Erro ao mover tarefa:", error);
      }
    }
  };

  const activeTask = useMemo(() => tasks.find(t => t.id === activeId), [activeId, tasks]);

  const handleDeleteClick = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setTaskToDelete(task);
    const taskHours = timesheetEntries.filter(h => h.taskId === task.id);
    const hasHours = taskHours.length > 0;
    setIsForceDelete(hasHours);
    setShouldDeleteHours(hasHours);
    setDeleteModalOpen(true);
    setDeleteConfirmText('');
  };

  const confirmDelete = async () => {
    if (taskToDelete) {
      if (isForceDelete && !isAdmin) {
        alert("Apenas administradores podem excluir tarefas com horas.");
        return;
      }
      if (isForceDelete && deleteConfirmText !== taskToDelete.title) {
        alert("Digite o nome da tarefa exatamente para confirmar.");
        return;
      }

      try {
        const idToDelete = taskToDelete.id;
        const force = isForceDelete;
        const delHours = shouldDeleteHours;

        // Fecha o modal e limpa estado imediatamente (Otimista)
        setDeleteModalOpen(false);
        setTaskToDelete(null);
        setIsForceDelete(false);
        setDeleteConfirmText('');

        await deleteTask(idToDelete, force, delHours);
      } catch (error: any) {
        console.error('Erro ao excluir tarefa:', error);
        const msg = error.message || "";
        if (msg.includes("horas apontadas") || msg.includes("hasHours")) {
          if (window.confirm("Esta tarefa possui horas apontadas. Deseja excluir a tarefa e TODOS os apontamentos de horas vinculados? Esta ação é irreversível.")) {
            try {
              await deleteTask(taskToDelete.id, true);
              setDeleteModalOpen(false);
              setTaskToDelete(null);
            } catch (forceErr: any) {
              alert('Erro na exclusão forçada: ' + (forceErr.message || 'Erro desconhecido'));
            }
          }
        } else {
          alert(msg || 'Erro ao excluir tarefa.');
        }
      }
    }
  };

  return (
    <div className="h-full flex flex-col p-4" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          {filteredClientId && (
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border rounded-xl transition-all font-medium flex items-center gap-2 shadow-sm"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface)';
                e.currentTarget.style.color = 'var(--text)';
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              {currentClient ? (
                <>
                  <span style={{ color: 'var(--muted)' }}>Tarefas de</span> {currentClient.name}
                  {(currentProject || projects.find(p => p.id === filteredProjectId)) && <span className="opacity-40">/ {(currentProject || projects.find(p => p.id === filteredProjectId))?.name}</span>}
                </>
              ) : (
                'Gestão de Tarefas'
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Busca Global */}
          <div className="relative group min-w-[200px] lg:min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar tarefa, cliente, projeto ou dev..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none text-sm shadow-lg transition-all"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>

          {/* Custom PREMIUM Developer Filter - APENAS PARA ADMINS */}
          {isAdmin && (
            <div className="relative min-w-[240px]">
              <button
                type="button"
                onClick={() => {
                  if (!showDevMenu) setTempSelectedIds(selectedDeveloperIds);
                  setShowDevMenu(!showDevMenu);
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border transition-all shadow-lg group"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)'
                }}
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="w-6 h-6 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedDeveloperIds.length === 1 ? (
                      (() => {
                        const dev = users.find(u => u.id === selectedDeveloperIds[0]);
                        return dev?.avatarUrl ? (
                          <img
                            src={dev.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(dev.name)}&background=f8fafc&color=475569`;
                            }}
                          />
                        ) : (
                          <span className="text-[10px] font-black text-purple-400">
                            {dev?.name.charAt(0).toUpperCase()}
                          </span>
                        );
                      })()
                    ) : selectedDeveloperIds.length > 1 ? (
                      <Users size={12} className="text-purple-400" />
                    ) : (
                      <UserIcon size={12} className="text-slate-400" />
                    )}
                  </div>
                  <span className="text-sm font-bold truncate tracking-tight">
                    {selectedDeveloperIds.length === 0
                      ? 'Todos os Colaboradores'
                      : selectedDeveloperIds.length === 1
                        ? users.find(u => u.id === selectedDeveloperIds[0])?.name
                        : `${selectedDeveloperIds.length} Colaboradores`}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showDevMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showDevMenu && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowDevMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-full max-h-[400px] border rounded-2xl shadow-2xl z-[70] p-2 flex flex-col gap-1 overflow-hidden"
                      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <div className="p-2 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Pesquisar nome..."
                          className="w-full border rounded-lg pl-10 pr-4 py-2 text-xs outline-none focus:border-purple-500 transition-all font-bold"
                          style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                          value={devSearchTerm}
                          onChange={(e) => setDevSearchTerm(e.target.value)}
                        />
                      </div>

                      <div className="overflow-y-auto flex-1 custom-scrollbar pr-1">
                        <button
                          type="button"
                          onClick={() => { setTempSelectedIds([]); }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${tempSelectedIds.length === 0 ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          <span>Todos os Colaboradores</span>
                          {tempSelectedIds.length === 0 && <Check size={14} />}
                        </button>

                        <div className="h-px bg-white/5 my-1 mx-2" />

                        {(() => {
                          const activeRoles = ['admin', 'system_admin', 'gestor', 'diretoria', 'pmo', 'ceo', 'tech_lead', 'resource'];
                          return users
                            .filter(u => u.active !== false &&
                              (u.torre !== 'N/A' || activeRoles.includes(u.role?.toLowerCase() || '')) &&
                              (devSearchTerm === '' || u.name.toLowerCase().includes(devSearchTerm.toLowerCase())))
                            .filter(u => !showOnlyDelayed || lateDevelopers.some(ld => ld.user.id === u.id))
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(user => {
                              const isSelected = tempSelectedIds.includes(user.id);
                              return (
                                <button
                                  key={user.id}
                                  onClick={() => {
                                    setTempSelectedIds(prev =>
                                      prev.includes(user.id)
                                        ? prev.filter(id => id !== user.id)
                                        : [...prev, user.id]
                                    );
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${isSelected ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                  <div className="flex items-center gap-3 truncate">
                                    <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                      {user.avatarUrl ? (
                                        <img
                                          src={user.avatarUrl}
                                          alt=""
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.onerror = null;
                                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=f8fafc&color=475569`;
                                          }}
                                        />
                                      ) : (
                                        <span className="text-[10px] uppercase font-black">{user.name.charAt(0)}</span>
                                      )}
                                    </div>
                                    <span className="truncate">{user.name}</span>
                                  </div>
                                  {isSelected && <Check size={14} />}
                                </button>
                              );
                            });
                        })()}
                      </div>

                      <div className="p-2 border-t mt-1 flex gap-2" style={{ borderColor: 'var(--border)' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDeveloperIds(tempSelectedIds);
                            const newParams = new URLSearchParams(searchParams);
                            if (tempSelectedIds.length > 0) {
                              newParams.set('developerIds', tempSelectedIds.join(','));
                              newParams.delete('developerId'); // Clean up old param
                            } else {
                              newParams.delete('developerIds');
                              newParams.delete('developerId');
                            }
                            setSearchParams(newParams);
                            setShowDevMenu(false);
                            setDevSearchTerm('');
                          }}
                          className="flex-1 py-2 rounded-xl bg-purple-600 text-white text-xs font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTempSelectedIds([]);
                          }}
                          className="px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        >
                          Limpar
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Botão Atrasados Toggle (Para Todos) */}
          <button
            type="button"
            onClick={() => { setShowOnlyDelayed(!showOnlyDelayed); if (!showOnlyDelayed) setShowOnlyImpediments(false); }}
            className={`px-4 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 shadow-lg ${showOnlyDelayed ? 'bg-red-600 text-white border-red-500' : ''}`}
            style={{
              backgroundColor: showOnlyDelayed ? '#dc2626' : 'var(--surface)',
              borderColor: showOnlyDelayed ? '#dc2626' : 'var(--border)',
              color: showOnlyDelayed ? 'white' : 'var(--text)'
            }}
          >
            <AlertTriangle size={16} className={`${showOnlyDelayed ? 'animate-pulse' : ''}`} style={{ color: showOnlyDelayed ? 'white' : '#dc2626' }} />
            <span className="hidden sm:inline" style={{ color: showOnlyDelayed ? 'white' : '#dc2626' }}>Atrasados</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black min-w-[20px] ${showOnlyDelayed ? 'bg-white text-red-700' : 'bg-red-600/10 text-red-600'}`}>
              {stats.delayed}
            </span>
          </button>

          {/* Botão Impedidos Toggle (Para Todos) */}
          <button
            type="button"
            onClick={() => { setShowOnlyImpediments(!showOnlyImpediments); if (!showOnlyImpediments) setShowOnlyDelayed(false); }}
            className={`px-4 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 shadow-lg ${showOnlyImpediments ? 'bg-orange-500 text-white border-orange-400' : ''}`}
            style={{
              backgroundColor: showOnlyImpediments ? '#ea580c' : 'var(--surface)',
              borderColor: showOnlyImpediments ? '#ea580c' : 'var(--border)',
              color: showOnlyImpediments ? 'white' : 'var(--text)'
            }}
          >
            <AlertCircle size={16} className={`${showOnlyImpediments ? 'animate-pulse' : ''}`} style={{ color: showOnlyImpediments ? 'white' : '#ea580c' }} />
            <span className="hidden sm:inline" style={{ color: showOnlyImpediments ? 'white' : '#ea580c' }}>Impedidos</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black min-w-[20px] ${showOnlyImpediments ? 'bg-white text-orange-600' : 'bg-orange-600/10 text-orange-600'}`}>
              {stats.impeded}
            </span>
          </button>

          {/* Botão Arquivo (Toggle Done) */}
          <button
            type="button"
            onClick={() => setShowDoneColumn(!showDoneColumn)}
            className={`p-2.5 rounded-xl border transition-all shadow-lg flex items-center justify-center`}
            style={{
              backgroundColor: showDoneColumn ? 'var(--surface)' : 'var(--primary)',
              borderColor: showDoneColumn ? 'var(--border)' : 'var(--primary)',
              color: showDoneColumn ? 'var(--text)' : 'white'
            }}
            title={showDoneColumn ? "Ocultar Concluídos" : "Exibir Concluídos"}
          >
            <Archive size={18} />
          </button>

          {/* Botão Nova Tarefa (Pode ser criado por admin em qualquer lugar ou dev em sua página) */}
          {(isAdmin || location.pathname.includes('/developer/tasks')) && (
            <button
              className="text-white px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 font-bold text-sm whitespace-nowrap active:scale-95"
              style={{ backgroundColor: 'var(--primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
              onClick={() => setShowTaskCreationModal(true)}
            >
              + Nova Tarefa
            </button>
          )}
        </div>
      </div>

      <TaskCreationModal
        isOpen={showTaskCreationModal}
        onClose={() => setShowTaskCreationModal(false)}
        preSelectedClientId={filteredClientId || undefined}
        preSelectedProjectId={filteredProjectId || undefined}
      />

      {/* NOVO: Lista de Avatares Atrasados - APENAS ADMIN */}
      <AnimatePresence>
        {isAdmin && showOnlyDelayed && lateDevelopers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-4 mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Em Atraso</span>
              <span className="text-xs text-slate-400 font-bold">{lateDevelopers.length} Colaboradores</span>
            </div>
            <div className="h-8 w-px bg-[var(--border)] mx-2" />
            <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar-thin">
              {lateDevelopers.map(({ user, count }) => (
                <button
                  key={user.id}
                  onClick={() => {
                    const newIds = selectedDeveloperIds.includes(user.id)
                      ? selectedDeveloperIds.filter(id => id !== user.id)
                      : [...selectedDeveloperIds, user.id];
                    setSelectedDeveloperIds(newIds);
                    const newParams = new URLSearchParams(searchParams);
                    if (newIds.length > 0) {
                      newParams.set('developerIds', newIds.join(','));
                    } else {
                      newParams.delete('developerIds');
                    }
                    newParams.delete('developerId');
                    setSearchParams(newParams);
                  }}
                  className="flex-shrink-0 relative group"
                  title={`Filtrar tarefas de ${user.name}`}
                >
                  <div className={`w-12 h-12 rounded-full border-2 p-0.5 transition-all duration-300 shadow-lg ${selectedDeveloperIds.includes(user.id)
                    ? 'border-red-500 ring-2 ring-red-500/50 scale-110'
                    : 'border-red-500/50 group-hover:border-red-500'
                    }`}>
                    <div className="w-full h-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-2)' }}>
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=f8fafc&color=475569`;
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-black text-white bg-gradient-to-br from-red-600 to-amber-600">
                          {user.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Badge de Contador */}
                  <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 shadow-lg" style={{ borderColor: 'var(--bg)' }}>
                    {count}
                  </div>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-[9px] px-1.5 py-0.5 rounded text-white whitespace-nowrap z-10">
                    {user.name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board Columns Area */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-4 sm:gap-6 h-full min-w-max md:min-w-0">
            {STATUS_COLUMNS.filter(col => col.id !== 'Done' || showDoneColumn).map((col) => {
              let columnTasks = filteredTasks.filter(t => t.status === col.id);
              const isDone = col.id === 'Done';

              // Aplicar filtro de cliente para tarefas concluídas
              if (isDone && selectedClientFilter) {
                columnTasks = columnTasks.filter(t => t.clientId === selectedClientFilter);
              }

              const displayedTasks = isDone
                ? columnTasks
                  .sort((a, b) => {
                    const dateA = a.actualDelivery ? new Date(a.actualDelivery).getTime() : 0;
                    const dateB = b.actualDelivery ? new Date(b.actualDelivery).getTime() : 0;
                    return dateB - dateA;
                  })
                  .slice(0, doneLimit)
                : columnTasks;

              return (
                <div key={col.id} className={`${col.id === 'Done' ? 'w-[350px]' : 'flex-1 min-w-[300px]'} h-full`}>
                  <KanbanColumn
                    col={col}
                    tasks={displayedTasks}
                    totalCount={isDone ? columnTasks.length : undefined}
                    clients={clients}
                    projects={projects}
                    onTaskClick={(id) => id.startsWith('__NAVIGATE__:') ? navigate(id.replace('__NAVIGATE__:', '')) : navigate(`/tasks/${id}`)}
                    onDelete={handleDeleteClick}
                    isAdmin={isAdmin}
                    highlightedTaskId={highlightedTaskId}
                    users={users}
                    currentUserId={currentUser?.id}
                    onLoadMore={isDone ? () => setDoneLimit(prev => prev + 10) : undefined}
                    hasMore={isDone ? displayedTasks.length < columnTasks.length : false}
                    onClientFilterChange={isDone ? setSelectedClientFilter : undefined}
                    selectedClientFilter={isDone ? selectedClientFilter : undefined}
                    availableClients={isDone ? availableClientsForDoneFilter : undefined}
                    showDoneColumn={showDoneColumn}
                    setShowDoneColumn={setShowDoneColumn}
                  />
                </div>
              );
            })}
          </div>

          <DragOverlay dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: { active: { opacity: '0.5' } },
            }),
          }}>
            {activeTask ? (
              <div className="w-[280px]">
                <KanbanCard
                  task={activeTask}
                  client={clients.find(c => c.id === activeTask.clientId)}
                  project={projects.find(p => p.id === activeTask.projectId)}
                  onTaskClick={() => { }}
                  isAdmin={false}
                  users={users}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        title={isForceDelete ? "⚠️ EXCLUSÃO CRÍTICA (COM HORAS)" : "Excluir Tarefa"}
        message={
          isForceDelete ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border surface-tinted-red">
                <p className="text-red-600 dark:text-red-400 font-black text-[11px] mb-2 uppercase">
                  Atenção: Esta tarefa possui horas apontadas.
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1 mb-3 scrollbar-hide">
                  {timesheetEntries.filter(h => h.taskId === taskToDelete?.id).map(h => (
                    <div key={h.id} className="text-[9px] flex justify-between items-center p-2 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                      <span className="font-bold">{new Date(h.date).toLocaleDateString()}</span>
                      <span className="opacity-70">{h.userName}</span>
                      <span className="font-black text-red-500">{h.totalHours}h</span>
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-red-200 dark:border-red-500/20 hover:border-red-500 transition-all" style={{ backgroundColor: 'var(--surface)' }}>
                  <input
                    type="checkbox"
                    checked={shouldDeleteHours}
                    onChange={e => setShouldDeleteHours(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-600"
                  />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase">Excluir horas apontadas?</span>
                    <span className="text-[8px] opacity-60">Se desmarcado, as horas ficam no banco mas sem tarefa.</span>
                  </div>
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase font-bold opacity-50">Confirme o nome da tarefa:</p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={taskToDelete?.title}
                  className="w-full p-3 rounded-xl border-2 border-red-500/20 outline-none focus:border-red-500 text-xs font-black bg-red-500/5 text-red-600"
                />
              </div>
            </div>
          ) : `Tem certeza que deseja excluir "${taskToDelete?.title}"? Esta ação não pode ser desfeita.`
        }
        confirmText={isForceDelete ? "EXCLUIR TUDO" : "Excluir"}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteModalOpen(false); setTaskToDelete(null); setIsForceDelete(false); }}
        disabled={isForceDelete && (deleteConfirmText !== taskToDelete?.title || !isAdmin)}
      />

      {showTaskCreationModal && (
        <TaskCreationModal
          isOpen={showTaskCreationModal}
          onClose={() => setShowTaskCreationModal(false)}
          preSelectedProjectId={filteredProjectId || undefined}
          preSelectedClientId={filteredClientId || undefined}
        />
      )}
    </div>
  );
};

export default KanbanBoard;
