// routes/AppRoutes.tsx - VERSÃO COMPLETA ADMIN
import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Role } from '@/types';
import { RoleGuard } from '@/guards/RoleGuard';
import { USER_ROLES } from '@/constants/roles';

// Componentes adaptados
import Login from '@/components/Login';
import AdminDashboard from '@/components/AdminDashboard';
import ClientDetailsView from '@/components/ClientDetailsView';
import ClientForm from '@/components/ClientForm';
import AllProjectsView from '@/components/AllProjectsView';
import ProjectDetailView from '@/components/ProjectDetailView';
import DeveloperProjects from '@/components/DeveloperProjects';
import KanbanBoard from '@/components/KanbanBoard';
import TaskDetail from '@/components/TaskDetail';
import MainLayout from '@/components/MainLayout';
import Unauthorized from '@/pages/Unauthorized';

// Componentes de Equipe
import TeamList from '@/components/TeamList';
import TeamMemberDetail from '@/components/TeamMemberDetail';
import UserForm from '@/components/UserForm';
import UserProfile from '@/components/UserProfile';
import AdminFullReport from '@/pages/admin/AdminFullReport';
import AdminSync from '@/pages/admin/AdminSync';
import RHManagement from '@/pages/RHManagement';

import Notes from '@/pages/Notes';

// Componentes de Timesheet
import TimesheetAdminDashboard from '@/components/TimesheetAdminDashboard';
import TimesheetCalendar from '@/components/TimesheetCalendar';
import TimesheetForm from '@/components/TimesheetForm';
import LearningCenter from '@/components/LearningCenter';
import ResetPassword from '@/components/ResetPassword';
import SystemDocs from '@/components/SystemDocs';
import AdminMonitoringView from '@/components/AdminMonitoringView';
import AbsenceManager from '@/components/AbsenceManager';

// Definição de grupos de acesso
const ADMIN_ROLES: Role[] = [
    'admin', 'gestor', 'diretoria', 'pmo', 'financeiro', 'financial', 'tech_lead',
    'system_admin', 'executive', 'ceo'
];

interface ProtectedWrapperProps {
    children: React.ReactNode;
    allowedRoles?: Role[];
}

/**
 * Wrapper para compatibilidade com lógica de token de monitoramento
 * e delegação para RoleGuard
 */
const ProtectedWrapper: React.FC<ProtectedWrapperProps> = ({ children, allowedRoles }) => {
    const { currentUser, isLoading } = useAuth();
    const location = useLocation();

    // Check for monitoring token
    const urlParams = new URLSearchParams(window.location.search);
    const hasValidToken = urlParams.get('token') === 'xyz123';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    if (hasValidToken) {
        return <>{children}</>;
    }

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && allowedRoles.length > 0) {
        return (
            <RoleGuard allowedRoles={allowedRoles} redirectTo="/unauthorized">
                {children}
            </RoleGuard>
        );
    }

    return <>{children}</>;
};

const AppRoutes: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Routes>
            {/* Rota Pública Check */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword onComplete={() => navigate('/login', { replace: true })} />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Rota Direta para Monitoramento (TV Mode) - Sem o Menu Lateral */}
            <Route
                path="/monitoring"
                element={
                    <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                        <AdminMonitoringView />
                    </ProtectedWrapper>
                }
            />

            {/* Rota Raiz - Redireciona baseado no role */}
            <Route path="/" element={
                <ProtectedWrapper>
                    <RoleBasedRedirect />
                </ProtectedWrapper>
            } />

            {/* Redirecionamento inteligente */}
            <Route path="/dashboard" element={
                <ProtectedWrapper>
                    <RoleBasedRedirect />
                </ProtectedWrapper>
            } />

            {/* === ROTAS ADMIN === */}
            <Route path="/admin" element={<Navigate to="/admin/clients" replace />} />

            <Route
                path="/"
                element={
                    <ProtectedWrapper>
                        <MainLayout />
                    </ProtectedWrapper>
                }
            >
                {/* NOVO: Dashboard de Monitoramento */}
                <Route
                    path="admin/monitoring"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <AdminMonitoringView />
                        </ProtectedWrapper>
                    }
                />

                {/* Dashboard Admin (Clientes) */}
                <Route
                    index
                    path="admin/clients"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <AdminDashboard />
                        </ProtectedWrapper>
                    }
                />

                {/* Detalhes do Cliente */}
                <Route
                    path="admin/clients/:clientId"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <ClientDetailsView />
                        </ProtectedWrapper>
                    }
                />

                {/* Novo Cliente */}
                <Route
                    path="admin/clients/new"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <ClientForm />
                        </ProtectedWrapper>
                    }
                />

                {/* Editar Cliente */}
                <Route
                    path="admin/clients/:clientId/edit"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <ClientForm />
                        </ProtectedWrapper>
                    }
                />

                {/* Novo Projeto (a partir do cliente) */}
                <Route
                    path="admin/clients/:clientId/projects/new"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <ProjectDetailView />
                        </ProtectedWrapper>
                    }
                />

                {/* --- PROJETOS (ADMIN) --- */}

                {/* Todos os Projetos */}
                <Route
                    path="admin/projects"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <AllProjectsView key="all-projects-view" />
                        </ProtectedWrapper>
                    }
                />

                {/* Detalhes do Projeto */}
                <Route
                    path="admin/projects/:projectId"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <ProjectDetailView />
                        </ProtectedWrapper>
                    }
                />

                {/* Novo Projeto (Geral) */}
                <Route
                    path="admin/projects/new"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <ProjectDetailView />
                        </ProtectedWrapper>
                    }
                />

                {/* Editar Projeto */}
                <Route
                    path="admin/projects/:projectId/edit"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <ProjectDetailView />
                        </ProtectedWrapper>
                    }
                />

                {/* === ROTAS DE EQUIPE === */}

                {/* Lista de Colaboradores */}
                <Route
                    path="admin/team"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <TeamList />
                        </ProtectedWrapper>
                    }
                />

                {/* Criar Colaborador */}
                <Route
                    path="admin/team/new"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <UserForm />
                        </ProtectedWrapper>
                    }
                />

                {/* Detalhes do Colaborador */}
                <Route
                    path="admin/team/:userId"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <TeamMemberDetail />
                        </ProtectedWrapper>
                    }
                />

                {/* Editar Colaborador */}
                <Route
                    path="admin/team/:userId/edit"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <UserForm />
                        </ProtectedWrapper>
                    }
                />

                {/* Perfil do Usuário (Acessível a todos) */}
                <Route
                    path="profile"
                    element={
                        <ProtectedWrapper>
                            <UserProfile />
                        </ProtectedWrapper>
                    }
                />

                <Route
                    path="absences"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <AbsenceManager />
                        </ProtectedWrapper>
                    }
                />

                {/* === TIMESHEET (ADMIN) === */}
                <Route
                    path="admin/timesheet"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <TimesheetAdminDashboard />
                        </ProtectedWrapper>
                    }
                />

                {/* === RELATÓRIOS (ADMIN) === */}
                <Route
                    path="admin/reports"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <AdminFullReport />
                        </ProtectedWrapper>
                    }
                />


                {/* Sincronização Admin */}
                <Route
                    path="admin/sync"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <AdminSync />
                        </ProtectedWrapper>
                    }
                />

                {/* Gestão RH */}
                <Route
                    path="admin/rh"
                    element={
                        <ProtectedWrapper allowedRoles={ADMIN_ROLES}>
                            <RHManagement />
                        </ProtectedWrapper>
                    }
                />

                {/* === ROTAS DEVELOPER E COMPARTILHADAS === */}

                {/* Projetos do Developer */}
                <Route
                    path="developer/projects"
                    element={
                        <ProtectedWrapper>
                            <DeveloperProjects />
                        </ProtectedWrapper>
                    }
                />

                {/* Detalhes do Projeto (Developer) */}
                <Route
                    path="developer/projects/:projectId"
                    element={
                        <ProtectedWrapper>
                            <ProjectDetailView />
                        </ProtectedWrapper>
                    }
                />

                {/* Tarefas do Developer (Kanban já filtra por usuário) */}
                <Route
                    path="developer/tasks"
                    element={
                        <ProtectedWrapper>
                            <KanbanBoard />
                        </ProtectedWrapper>
                    }
                />

                {/* Central de Estudos */}
                <Route
                    path="developer/learning"
                    element={
                        <ProtectedWrapper>
                            <LearningCenter />
                        </ProtectedWrapper>
                    }
                />

                {/* Kanban Board (Tarefas) - Rota geral */}
                <Route
                    path="tasks"
                    element={
                        <ProtectedWrapper>
                            <KanbanBoard />
                        </ProtectedWrapper>
                    }
                />

                {/* Nova Tarefa */}
                <Route
                    path="tasks/new"
                    element={
                        <ProtectedWrapper>
                            <TaskDetail />
                        </ProtectedWrapper>
                    }
                />

                {/* Detalhes da Tarefa */}
                <Route
                    path="tasks/:taskId"
                    element={
                        <ProtectedWrapper>
                            <TaskDetail />
                        </ProtectedWrapper>
                    }
                />

                {/* === TIMESHEET (Todos) === */}
                <Route
                    path="timesheet"
                    element={
                        <ProtectedWrapper>
                            <TimesheetCalendar />
                        </ProtectedWrapper>
                    }
                />

                <Route
                    path="timesheet/new"
                    element={
                        <ProtectedWrapper>
                            <TimesheetForm />
                        </ProtectedWrapper>
                    }
                />

                <Route
                    path="timesheet/:entryId"
                    element={
                        <ProtectedWrapper>
                            <TimesheetForm />
                        </ProtectedWrapper>
                    }
                />

                {/* Notas */}
                <Route
                    path="notes"
                    element={
                        <ProtectedWrapper>
                            <Notes />
                        </ProtectedWrapper>
                    }
                />

                {/* Documentação */}
                <Route
                    path="docs"
                    element={
                        <ProtectedWrapper>
                            <SystemDocs />
                        </ProtectedWrapper>
                    }
                />

                {/* === OUTRAS ROTAS (TODO) === */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />

            </Route>
        </Routes>
    );
};

// Pequeno componente auxiliar para redirecionar baseado no role
const RoleBasedRedirect = () => {
    const { currentUser } = useAuth();
    if (!currentUser) return <Navigate to="/login" replace />;

    const adminRoles: Role[] = ADMIN_ROLES;

    if (adminRoles.includes(currentUser.role)) {
        return <Navigate to="/admin/clients" replace />;
    }
    return <Navigate to="/developer/projects" replace />;
}

export default AppRoutes;
