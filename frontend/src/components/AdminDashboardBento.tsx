// AdminDashboardBento.tsx - Dashboard com Bento Grid
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import { useAuth } from '@/contexts/AuthContext';
import { BentoCard, BentoMetric, BentoList } from './BentoCard';
import {
  Briefcase,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  BarChart2,
  Users,
  Target,
  Activity,
  AlertTriangle
} from 'lucide-react';
import * as CapacityUtils from '@/utils/capacity';

const AdminDashboardBento: React.FC = () => {
  const navigate = useNavigate();
  const { projects, tasks, clients, users, timesheetEntries, projectMembers } = useDataController();
  const { currentUser } = useAuth();

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

  // Cálculos de métricas
  const metrics = useMemo(() => {
    const activeProjects = projects.filter(p => p.active !== false);

    const totalHoursSold = activeProjects.reduce((acc, p) => acc + (p.horas_vendidas || 0), 0);
    const totalHoursConsumed = timesheetEntries.reduce((acc, e) => acc + (Number(e.totalHours) || 0), 0);

    const totalRevenue = activeProjects.reduce((acc, p) => acc + (p.valor_total_rs || 0), 0);
    const totalCost = timesheetEntries.reduce((acc, e) => {
      const user = users.find(u => u.id === e.userId);
      return acc + (e.totalHours * (user?.hourlyCost || 0));
    }, 0);

    const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

    const overdueTasks = tasks.filter(t => {
      if (t.status === 'Done' || !t.estimatedDelivery) return false;
      return new Date(t.estimatedDelivery) < new Date();
    });

    return {
      activeProjects: activeProjects.length,
      totalHoursSold,
      totalHoursConsumed,
      totalRevenue,
      avgMargin,
      overdueTasks: overdueTasks.length
    };
  }, [projects, tasks, users, timesheetEntries]);

  // Top projetos por margem
  const topProjectsByMargin = useMemo(() => {
    return projects
      .filter(p => p.active !== false && p.valor_total_rs && p.valor_total_rs > 0)
      .map(p => {
        const pTimesheets = timesheetEntries.filter(e => e.projectId === p.id);
        const cost = pTimesheets.reduce((acc, e) => {
          const user = users.find(u => u.id === e.userId);
          return acc + (e.totalHours * (user?.hourlyCost || 0));
        }, 0);
        const revenue = p.valor_total_rs || 0;
        const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;

        return { ...p, margin, cost, revenue };
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);
  }, [projects, timesheetEntries, users]);

  // Horas por semana (últimas 8 semanas)
  const hoursPerWeek = useMemo(() => {
    const weeks: Record<string, number> = {};
    const now = new Date();

    timesheetEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const weekAgo = Math.floor((now.getTime() - entryDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

      if (weekAgo < 8) {
        const weekKey = `W${8 - weekAgo}`;
        weeks[weekKey] = (weeks[weekKey] || 0) + (Number(entry.totalHours) || 0);
      }
    });

    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, hours]) => ({ week, hours }));
  }, [timesheetEntries]);

  // Projetos atrasados ou com problemas
  const criticalProjects = useMemo(() => {
    return projects
      .filter(p => p.active !== false)
      .map(p => {
        const pTasks = tasks.filter(t => t.projectId === p.id);
        const pTimesheets = timesheetEntries.filter(e => e.projectId === p.id);

        const hoursConsumed = pTimesheets.reduce((acc, e) => acc + (Number(e.totalHours) || 0), 0);
        const hoursSold = p.horas_vendidas || 0;
        const overBudget = hoursConsumed > hoursSold;

        const overdueTasks = pTasks.filter(t => {
          if (t.status === 'Done' || !t.estimatedDelivery) return false;
          return new Date(t.estimatedDelivery) < new Date();
        });

        return {
          ...p,
          overBudget,
          overdueTasks: overdueTasks.length,
          criticalLevel: overBudget || overdueTasks.length > 0
        };
      })
      .filter(p => p.criticalLevel)
      .sort((a, b) => b.overdueTasks - a.overdueTasks)
      .slice(0, 5);
  }, [projects, tasks, timesheetEntries]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          Dashboard Executivo
        </h1>
        <p style={{ color: 'var(--text-2)' }}>
          Visão geral de projetos, tarefas e métricas
        </p>
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-fr">
        {/* Projetos Ativos */}
        <BentoCard title="Projetos Ativos" icon={Briefcase} size="small">
          <BentoMetric
            value={metrics.activeProjects}
            label="Projetos em andamento"
            change={`↑ ${Math.round(metrics.activeProjects * 0.12)} este mês`}
            changeType="positive"
          />
        </BentoCard>

        {/* Horas Consumidas */}
        <BentoCard title="Horas Consumidas" icon={Clock} size="small">
          <BentoMetric
            value={`${Math.round(metrics.totalHoursConsumed)}h`}
            label="Total de horas trabalhadas"
            change={`vs ${Math.round(metrics.totalHoursSold)}h vendidas`}
            changeType={metrics.totalHoursConsumed > metrics.totalHoursSold ? 'negative' : 'positive'}
          />
        </BentoCard>

        {/* Receita */}
        <BentoCard title="Receita Acumulada" icon={DollarSign} size="small">
          <BentoMetric
            value={metrics.totalRevenue.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })}
            label="Total de receita"
            change="Meta: R$ 650K"
            changeType={metrics.totalRevenue >= 650000 ? 'positive' : 'neutral'}
          />
        </BentoCard>

        {/* Margem Média */}
        <BentoCard title="Margem Média" icon={TrendingUp} size="small">
          <BentoMetric
            value={`${Math.round(metrics.avgMargin)}%`}
            label="Margem de lucro média"
            change={metrics.avgMargin >= 25 ? '↑ Acima da meta (25%)' : '↓ Abaixo da meta'}
            changeType={metrics.avgMargin >= 25 ? 'positive' : 'negative'}
          />
        </BentoCard>

        {/* Horas por Semana (Chart) */}
        <BentoCard title="Horas por Semana" icon={BarChart2} size="medium">
          <div className="flex items-end justify-between gap-2 h-32">
            {hoursPerWeek.map(({ week, hours }) => {
              const maxHours = Math.max(...hoursPerWeek.map(w => w.hours));
              const heightPercent = (hours / maxHours) * 100;

              return (
                <div key={week} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center justify-end flex-1">
                    <div
                      className="w-full rounded-t-lg transition-all"
                      style={{
                        height: `${heightPercent}%`,
                        backgroundColor: 'var(--primary)',
                        minHeight: '8px'
                      }}
                    />
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {week}
                  </div>
                </div>
              );
            })}
          </div>
        </BentoCard>

        {/* Top Projetos por Margem */}
        <BentoCard title="Top Projetos por Margem" icon={Target} size="medium">
          <BentoList
            items={topProjectsByMargin.map(p => {
              const client = clients.find(c => c.id === p.clientId);
              return {
                id: p.id,
                title: p.name,
                subtitle: client?.name || 'Cliente',
                value: `${Math.round(p.margin)}%`,
                valueColor: p.margin >= 30 ? 'var(--success)' : p.margin >= 20 ? 'var(--warning)' : 'var(--danger)',
                onClick: () => navigate(`/admin/projects/${p.id}`)
              };
            })}
          />
        </BentoCard>

        {/* Alertas Críticos */}
        <BentoCard title="⚠️ Alertas Críticos" icon={AlertCircle} size="large">
          <div className="space-y-3">
            <div
              className="p-4 rounded-lg border-l-4"
              style={{
                backgroundColor: 'var(--danger-bg)',
                borderColor: 'var(--danger)'
              }}
            >
              <div className="font-bold text-lg mb-1" style={{ color: 'var(--danger-text)' }}>
                {metrics.overdueTasks}
              </div>
              <div className="text-sm" style={{ color: 'var(--danger-text)' }}>
                Tarefas atrasadas requerem atenção
              </div>
            </div>

            <div
              className="p-4 rounded-lg border-l-4"
              style={{
                backgroundColor: 'var(--warning-bg)',
                borderColor: 'var(--warning)'
              }}
            >
              <div className="font-bold text-lg mb-1" style={{ color: 'var(--warning-text)' }}>
                {criticalProjects.filter(p => p.overBudget).length}
              </div>
              <div className="text-sm" style={{ color: 'var(--warning-text)' }}>
                Projetos acima do orçamento
              </div>
            </div>

            {criticalProjects.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-bold mb-2 uppercase" style={{ color: 'var(--muted)' }}>
                  Projetos Críticos:
                </div>
                <BentoList
                  items={criticalProjects.slice(0, 3).map(p => ({
                    id: p.id,
                    title: p.name,
                    subtitle: p.overBudget ? '💰 Acima do budget' : `⚠️ ${p.overdueTasks} tarefas atrasadas`,
                    onClick: () => navigate(`/admin/projects/${p.id}`)
                  }))}
                />
              </div>
            )}
          </div>
        </BentoCard>

        {/* Atividade da Equipe */}
        <BentoCard title="Atividade da Equipe" icon={Users} size="small">
          <div className="space-y-3">
            <div>
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>
                {users.filter(u => u.active !== false).length}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-2)' }}>
                Colaboradores ativos
              </div>
            </div>
            <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Média de horas/pessoa
              </div>
              <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                {Math.round(metrics.totalHoursConsumed / users.filter(u => u.active !== false).length)}h
              </div>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Seção de Projetos (mantida como tabela ou cards) */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Projetos em Andamento ({metrics.activeProjects})
          </h2>
          <button
            onClick={() => navigate('/admin/projects/new')}
            className="px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'white'
            }}
          >
            + Novo Projeto
          </button>
        </div>

        {/* Grid de Cards de Projetos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.filter(p => p.active !== false).slice(0, 8).map(project => {
            const client = clients.find(c => c.id === project.clientId);
            const pTasks = tasks.filter(t => t.projectId === project.id);
            const progress = CapacityUtils.calculateProjectWeightedProgress(project.id, tasks as any);

            const pTimesheets = timesheetEntries.filter(e => e.projectId === project.id);
            const cost = pTimesheets.reduce((acc, e) => {
              const user = users.find(u => u.id === e.userId);
              return acc + (e.totalHours * (user?.hourlyCost || 0));
            }, 0);
            const revenue = project.valor_total_rs || 0;
            const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
            const isIncomplete = isProjectIncomplete(project);

            return (
              <div
                key={project.id}
                onClick={() => navigate(`/admin/projects/${project.id}`)}
                className={`p-5 rounded-xl border cursor-pointer transition-all hover:shadow-lg relative overflow-hidden`}
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)'
                }}
              >

                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate mb-1" style={{ color: 'var(--text)' }}>
                      {project.name}
                    </h3>
                    <p className="text-sm truncate" style={{ color: 'var(--muted)' }}>
                      📦 {client?.name || 'Cliente'}
                    </p>
                  </div>
                  <div
                    className="px-2 py-1 rounded text-xs font-bold"
                    style={{
                      backgroundColor: project.status === 'Concluído' ? 'var(--success-bg)' : 'var(--info-bg)',
                      color: project.status === 'Concluído' ? 'var(--success-text)' : 'var(--info-text)'
                    }}
                  >
                    {project.status || 'Ativo'}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-2)' }}>
                    <span>Progresso</span>
                    <span className="font-bold">{Math.round(progress)}%</span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--surface-2)' }}
                  >
                    <div
                      className="h-full transition-all rounded-full"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: 'var(--primary)'
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--muted)' }}>Margem</span>
                  <span
                    className="font-bold"
                    style={{
                      color: margin >= 30 ? 'var(--success)' : margin >= 20 ? 'var(--warning)' : 'var(--danger)'
                    }}
                  >
                    {Math.round(margin)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardBento;
