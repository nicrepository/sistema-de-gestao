import React from 'react';
import { ReactNode } from 'react';

interface MetricValue {
  label: string;
  value: ReactNode;
  isPrimary?: boolean;
}

interface ExecutiveMetricsCardProps {
  title: string;
  icon?: ReactNode;
  metrics: MetricValue[];
  variant?: 'default' | 'highlighted';
  className?: string;
}

export const ExecutiveMetricsCard: React.FC<ExecutiveMetricsCardProps> = ({
  title,
  icon,
  metrics,
  variant = 'default',
  className = ''
}) => {
  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${className}`}
      style={{
        backgroundColor: variant === 'highlighted' ? 'var(--primary-soft)' : 'var(--surface)',
        borderColor: variant === 'highlighted' ? 'var(--primary)' : 'var(--border)',
        borderWidth: variant === 'highlighted' ? '2px' : '1px'
      }}
    >
      {/* Header with title and icon */}
      <div className="flex items-center gap-2">
        {icon && <div style={{ color: 'var(--primary)' }}>{icon}</div>}
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
          {title}
        </span>
      </div>

      {/* Metrics */}
      <div className="flex flex-col gap-2">
        {metrics.map((metric, idx) => (
          <div key={idx} className={`flex flex-col gap-1 ${idx > 0 ? 'pt-2 border-t' : ''}`} style={{ borderColor: 'var(--border)' }}>
            <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-tight">
              {metric.label}
            </span>
            <span
              className={`text-lg font-black font-mono tracking-tight leading-none ${
                metric.isPrimary ? 'text-[var(--text)]' : 'text-[var(--text-2)]'
              }`}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ExecutiveMetricsGridProps {
  children: ReactNode;
  className?: string;
}

export const ExecutiveMetricsGrid: React.FC<ExecutiveMetricsGridProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full ${className}`}
    >
      {children}
    </div>
  );
};
