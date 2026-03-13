// ExecutiveDashboard.tsx - Excel-style Executive Dashboard
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataController } from '@/controllers/useDataController';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react';
import { Project } from '@/types';
import { formatDecimalToTime } from '@/utils/normalizers';
import * as CapacityUtils from '@/utils/capacity';

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

const ExecutiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projects, tasks, clients, users, timesheetEntries } = useDataController();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'margin', direction: 'desc' });
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'critical'>('all');
  const { projectMembers } = useDataController();



  // Calculate project metrics
  const projectMetrics = useMemo(() => {
    return projects
      .filter(p => p.active !== false)
      .map(p => {
        const client = clients.find(c => c.id === p.clientId);
        const pTasks = tasks.filter(t => t.projectId === p.id);
        const pTimesheets = timesheetEntries.filter(e => e.projectId === p.id);

        const hoursConsumed = pTimesheets.reduce((acc, e) => acc + (Number(e.totalHours) || 0), 0);
        const hoursSold = p.horas_vendidas || 0;
        const hoursRemaining = hoursSold - hoursConsumed;
        const burnRate = hoursSold > 0 ? (hoursConsumed / hoursSold) * 100 : 0;

        const cost = pTimesheets.reduce((acc, e) => {
          const user = users.find(u => u.id === e.userId);
          return acc + (e.totalHours * (user?.hourlyCost || 0));
        }, 0);

        const revenue = p.valor_total_rs || 0;
        const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
        const profit = revenue - cost;

        const totalTasks = pTasks.length;
        const completedTasks = pTasks.filter(t => t.status === 'Done').length;
        const progress = totalTasks > 0 ? CapacityUtils.calculateProjectWeightedProgress(p.id, tasks as any) : 0;

        const overdueTasks = pTasks.filter(t => {
          if (t.status === 'Done' || !t.estimatedDelivery) return false;
          return new Date(t.estimatedDelivery) < new Date();
        }).length;

        const now = new Date();
        const startP = p.startDate ? new Date(p.startDate) : null;
        const endP = p.estimatedDelivery ? new Date(p.estimatedDelivery) : null;
        let plannedProgress = 0;
        if (startP && endP && startP < endP) {
          if (now > endP) plannedProgress = 100;
          else if (now > startP) {
            const total = endP.getTime() - startP.getTime();
            const elapsed = now.getTime() - startP.getTime();
            plannedProgress = (elapsed / total) * 100;
          }
        }
        const isProjectDelayed = progress < (plannedProgress - 5);

        const isCritical = overdueTasks > 0 || burnRate > 90 || margin < 15 || isProjectDelayed;

        return {
          id: p.id,
          projectName: p.name,
          clientName: client?.name || 'N/A',
          status: p.status || 'Ativo',
          progress,
          hoursSold,
          hoursConsumed,
          hoursRemaining,
          burnRate,
          revenue,
          cost,
          margin,
          profit,
          totalTasks,
          completedTasks,
          overdueTasks,
          isCritical,
          isProjectDelayed,

        };
      });
  }, [projects, clients, tasks, timesheetEntries, users]);

  // Filter and sort
  const filteredProjects = useMemo(() => {
    let filtered = projectMetrics;

    if (filterStatus === 'active') {
      filtered = filtered.filter(p => p.progress < 100);
    } else if (filterStatus === 'critical') {
      filtered = filtered.filter(p => p.isCritical);
    }

    return filtered.sort((a, b) => {
      const aValue = a[sortConfig.key as keyof typeof a];
      const bValue = b[sortConfig.key as keyof typeof b];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });
  }, [projectMetrics, sortConfig, filterStatus]);

  // Summary metrics
  const summary = useMemo(() => {
    return {
      totalRevenue: projectMetrics.reduce((sum, p) => sum + p.revenue, 0),
      totalCost: projectMetrics.reduce((sum, p) => sum + p.cost, 0),
      totalProfit: projectMetrics.reduce((sum, p) => sum + p.profit, 0),
      avgMargin: projectMetrics.length > 0
        ? projectMetrics.reduce((sum, p) => sum + p.margin, 0) / projectMetrics.length
        : 0,
      totalProjects: projectMetrics.length,
      criticalProjects: projectMetrics.filter(p => p.isCritical).length,
      totalHoursSold: projectMetrics.reduce((sum, p) => sum + p.hoursSold, 0),
      totalHoursConsumed: projectMetrics.reduce((sum, p) => sum + p.hoursConsumed, 0)
    };
  }, [projectMetrics]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-8 py-6 border-b" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text)' }}>
              Painel Executivo de Gestão
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Visão consolidada de projetos, receitas e margens
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm transition-all"
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)'
            }}
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4" style={{ color: 'var(--success)' }} />
              <span className="text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>Receita Total</span>
            </div>
            <div className="text-2xl font-black" style={{ color: 'var(--text)' }}>
              {summary.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
            </div>
          </div>

          <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4" style={{ color: summary.avgMargin >= 25 ? 'var(--success)' : 'var(--warning)' }} />
              <span className="text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>Margem Média</span>
            </div>
            <div className="text-2xl font-black" style={{ color: summary.avgMargin >= 25 ? 'var(--success)' : 'var(--warning)' }}>
              {summary.avgMargin.toFixed(1)}%
            </div>
          </div>

          <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4" style={{ color: 'var(--info)' }} />
              <span className="text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>Horas Consumidas</span>
            </div>
            <div className="text-2xl font-black" style={{ color: 'var(--text)' }}>
              {formatDecimalToTime(summary.totalHoursConsumed)} / {formatDecimalToTime(summary.totalHoursSold)}
            </div>
          </div>

          <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4" style={{ color: 'var(--danger)' }} />
              <span className="text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>Projetos Críticos</span>
            </div>
            <div className="text-2xl font-black" style={{ color: 'var(--danger)' }}>
              {summary.criticalProjects} / {summary.totalProjects}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 border-b flex items-center gap-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <Filter className="w-4 h-4" style={{ color: 'var(--muted)' }} />
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'active', label: 'Ativos' },
            { value: 'critical', label: 'Críticos' }
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value as any)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${filterStatus === filter.value ? 'shadow-sm' : ''
                }`}
              style={{
                backgroundColor: filterStatus === filter.value ? 'var(--primary)' : 'var(--surface-2)',
                color: filterStatus === filter.value ? 'white' : 'var(--text-2)'
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm font-medium" style={{ color: 'var(--muted)' }}>
          {filteredProjects.length} projetos
        </span>
      </div>

      {/* Table - Excel Style */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full border-collapse" style={{ backgroundColor: 'var(--surface)' }}>
          <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--surface-2)' }}>
            <tr>
              {[
                { key: 'projectName', label: 'Projeto', width: '200px' },
                { key: 'clientName', label: 'Cliente', width: '150px' },
                { key: 'status', label: 'Status', width: '100px' },
                { key: 'progress', label: 'Progresso', width: '100px' },
                { key: 'hoursSold', label: 'H. Vendidas', width: '100px' },
                { key: 'hoursConsumed', label: 'H. Consumidas', width: '110px' },
                { key: 'burnRate', label: 'Burn Rate', width: '100px' },
                { key: 'revenue', label: 'Receita', width: '120px' },
                { key: 'cost', label: 'Custo', width: '120px' },
                { key: 'margin', label: 'Margem %', width: '100px' },
                { key: 'profit', label: 'Lucro', width: '120px' },
                { key: 'overdueTasks', label: 'Atrasos', width: '80px' }
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider cursor-pointer hover:bg-opacity-80 transition-all border-b"
                  style={{
                    color: 'var(--text)',
                    borderColor: 'var(--border)',
                    minWidth: col.width
                  }}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    <SortIcon columnKey={col.key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project, idx) => (
              <tr
                key={project.id}
                onClick={() => navigate(`/admin/projects/${project.id}`)}
                className="cursor-pointer hover:bg-opacity-50 transition-all border-b"
                style={{
                  backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)',
                  borderColor: 'var(--border)'
                }}
              >
                <td className="px-4 py-3 font-bold" style={{ color: 'var(--text)' }}>
                  <div className="flex items-center gap-2">
                    {project.isCritical && <AlertCircle className="w-4 h-4" style={{ color: 'var(--danger)' }} />}

                    {project.isProjectDelayed && (
                      <span title="Projeto com Atraso de Cronograma">
                        <Clock className="w-4 h-4 text-red-500 animate-pulse" />
                      </span>
                    )}
                    {project.projectName}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-2)' }}>
                  {project.clientName}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--primary-soft)',
                      color: 'var(--primary)'
                    }}
                  >
                    {project.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text)' }}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-2)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${project.progress}%`,
                          backgroundColor: project.progress >= 75 ? 'var(--success)' : project.progress >= 50 ? 'var(--info)' : 'var(--warning)'
                        }}
                      />
                    </div>
                    <span className="w-12 text-right">{project.progress.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-right" style={{ color: 'var(--text)' }}>
                  {formatDecimalToTime(project.hoursSold)}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-right" style={{ color: 'var(--text)' }}>
                  {formatDecimalToTime(project.hoursConsumed)}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-right" style={{
                  color: project.burnRate > 90 ? 'var(--danger)' : project.burnRate > 75 ? 'var(--warning)' : 'var(--success)'
                }}>
                  {project.burnRate.toFixed(0)}%
                </td>
                <td className="px-4 py-3 text-sm font-mono text-right font-bold" style={{ color: 'var(--success)' }}>
                  {project.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-right" style={{ color: 'var(--text-2)' }}>
                  {project.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-sm font-black text-right" style={{
                  color: project.margin >= 30 ? 'var(--success)' : project.margin >= 20 ? 'var(--warning)' : 'var(--danger)'
                }}>
                  {project.margin.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-sm font-mono text-right font-bold" style={{
                  color: project.profit > 0 ? 'var(--success)' : 'var(--danger)'
                }}>
                  {project.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-center">
                  {project.overdueTasks > 0 ? (
                    <span className="px-2 py-1 rounded-full text-xs font-black" style={{
                      backgroundColor: 'var(--danger-bg)',
                      color: 'var(--danger)'
                    }}>
                      {project.overdueTasks}
                    </span>
                  ) : (
                    <CheckCircle className="w-4 h-4 mx-auto" style={{ color: 'var(--success)' }} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
