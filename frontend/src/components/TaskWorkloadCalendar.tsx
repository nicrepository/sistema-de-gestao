// components/TaskWorkloadCalendar.tsx
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useDataController } from '@/controllers/useDataController';

interface TaskWorkloadCalendarProps {
    taskId: string;
    userId: string;
    selectedDate: string;
    onSelectDate: (date: string) => void;
    onClose: () => void;
}

const TaskWorkloadCalendar: React.FC<TaskWorkloadCalendarProps> = ({
    taskId,
    userId,
    selectedDate,
    onSelectDate,
    onClose
}) => {
    const { tasks, timesheetEntries, users } = useDataController();

    // Get task range
    const task = useMemo(() => tasks.find(t => t.id === taskId), [tasks, taskId]);
    const taskStart = task?.scheduledStart || '';
    const taskEnd = task?.estimatedDelivery || '';

    // Get user meta
    const user = useMemo(() => users.find(u => u.id === userId), [users, userId]);
    const dailyMeta = user?.dailyAvailableHours || 8;

    // Calendar state - RESTORED Navigation
    const [viewDate, setViewDate] = useState(() => {
        if (selectedDate) return new Date(selectedDate + 'T12:00:00');
        if (taskStart) return new Date(taskStart + 'T12:00:00');
        return new Date();
    });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // Calcula limites de navegação baseados no período da tarefa
    const minMonthDate = useMemo(() => {
        if (!taskStart) return new Date(2000, 0, 1);
        const d = new Date(taskStart + 'T12:00:00');
        return new Date(d.getFullYear(), d.getMonth(), 1);
    }, [taskStart]);

    const maxMonthDate = useMemo(() => {
        if (!taskEnd) return new Date(2100, 0, 1);
        const d = new Date(taskEnd + 'T12:00:00');
        return new Date(d.getFullYear(), d.getMonth(), 1);
    }, [taskEnd]);

    const canPrev = (year > minMonthDate.getFullYear()) || (year === minMonthDate.getFullYear() && month > minMonthDate.getMonth());
    const canNext = (year < maxMonthDate.getFullYear()) || (year === maxMonthDate.getFullYear() && month < maxMonthDate.getMonth());

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const prevMonth = () => { if (canPrev) setViewDate(new Date(year, month - 1, 1)); };
    const nextMonth = () => { if (canNext) setViewDate(new Date(year, month + 1, 1)); };

    // Calculate workload per day for this user
    const dayWorkload = useMemo(() => {
        const stats: Record<string, number> = {};
        timesheetEntries
            .filter(e => e.userId === userId)
            .forEach(e => {
                stats[e.date] = (stats[e.date] || 0) + (e.totalHours || 0);
            });
        return stats;
    }, [timesheetEntries, userId]);

    // Check if a date is within the task period
    const isDateInRange = (dateStr: string) => {
        if (!taskStart || !taskEnd) return false;
        const d = dateStr.split('T')[0];
        const s = taskStart.split('T')[0];
        const e = taskEnd.split('T')[0];
        return d >= s && d <= e;
    };

    // Check if date is in the future
    const isFutureDate = (dateStr: string) => {
        const todayStr = new Date().toISOString().split('T')[0];
        return dateStr > todayStr;
    };

    // Calendar generation for 6x7 grid
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const startDayGrid = firstDayOfMonth.getDay();

        const days = [];
        const prevMonthLastDay = new Date(year, month, 0).getDate();

        for (let i = startDayGrid - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            const m = month === 0 ? 11 : month - 1;
            const y = month === 0 ? year - 1 : year;
            days.push({ day: d, month: m, year: y, currentMonth: false });
        }

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, month: month, year: year, currentMonth: true });
        }

        const nextMonthDays = 42 - days.length;
        for (let i = 1; i <= nextMonthDays; i++) {
            const m = month === 11 ? 0 : month + 1;
            const y = month === 11 ? year + 1 : year;
            days.push({ day: i, month: m, year: y, currentMonth: false });
        }

        return days;
    }, [year, month]);

    // Filter out rows that are completely out of range to keep it reasonably compact but showing task period
    const visibleDays = useMemo(() => {
        const weeks = [];
        for (let i = 0; i < calendarDays.length; i += 7) {
            const week = calendarDays.slice(i, i + 7);
            const hasAnyInRange = week.some(dObj => {
                const dateStr = `${dObj.year}-${String(dObj.month + 1).padStart(2, '0')}-${String(dObj.day).padStart(2, '0')}`;
                return isDateInRange(dateStr);
            });
            if (hasAnyInRange) weeks.push(week);
        }
        // Fallback: if task is far in future or past month view, show something sensible
        return weeks.length > 0 ? weeks.flat() : calendarDays.slice(0, 42);
    }, [calendarDays, isDateInRange]);

    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <div className="absolute top-full left-0 mt-2 z-[100] w-72 border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 rounded-xl"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>

            {/* Professional Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                <button
                    type="button"
                    onClick={prevMonth}
                    disabled={!canPrev}
                    className={`p-1.5 rounded-lg transition-all ${canPrev ? 'hover:bg-[var(--surface)] text-[var(--text)]' : 'text-[var(--muted)] opacity-20 cursor-not-allowed'}`}
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text)' }}>
                        {monthNames[month]} {year}
                    </h4>
                </div>
                <button
                    type="button"
                    onClick={nextMonth}
                    disabled={!canNext}
                    className={`p-1.5 rounded-lg transition-all ${canNext ? 'hover:bg-[var(--surface)] text-[var(--text)]' : 'text-[var(--muted)] opacity-20 cursor-not-allowed'}`}
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Grid Header */}
            <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} className="py-2 text-center text-[9px] font-black opacity-40" style={{ color: 'var(--text)' }}>{d}</div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="p-2 grid grid-cols-7 gap-1">
                {visibleDays.map((dObj, idx) => {
                    const { day, month: dMonth, year: dYear } = dObj;
                    const dateStr = `${dYear}-${String(dMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const totalHours = dayWorkload[dateStr] || 0;
                    const isSelected = selectedDate === dateStr;
                    const inRange = isDateInRange(dateStr);
                    const isFuture = isFutureDate(dateStr);
                    const isToday = dateStr === todayStr;

                    let statusBg = 'transparent';
                    let statusText = 'var(--text)';

                    if (totalHours >= dailyMeta) {
                        statusBg = '#10B981'; // emerald-500
                        statusText = 'white';
                    } else if (totalHours > 0) {
                        statusBg = '#F59E0B'; // amber-500
                        statusText = 'white';
                    }

                    return (
                        <button
                            key={idx}
                            type="button"
                            disabled={!inRange || isFuture}
                            onClick={() => { onSelectDate(dateStr); onClose(); }}
                            className={`
                                relative py-2 rounded-lg text-[10px] font-black transition-all h-9 flex items-center justify-center
                                ${isSelected && inRange ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)] z-10' : ''}
                                ${!inRange ? 'opacity-0 pointer-events-none' : (isFuture ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:bg-[var(--surface-2)]')}
                                ${isToday ? 'border border-[var(--primary)] bg-[var(--primary-soft)]/10' : ''}
                            `}
                            style={{
                                backgroundColor: inRange && !isFuture && statusBg !== 'transparent' ? statusBg : undefined,
                                color: inRange ? statusText : undefined
                            }}
                        >
                            {day}

                            {/* Blue Line for TASK RANGE */}
                            {inRange && (
                                <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full ${totalHours > 0 ? (isFuture ? 'bg-[var(--muted)]' : 'bg-white/40') : 'bg-[var(--primary)]/60'}`} />
                            )}

                            {isSelected && (
                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[var(--primary)] rounded-full flex items-center justify-center border-2 border-[var(--surface)] shadow-sm">
                                    <Check className="w-2 h-2 text-white" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Refined Legend */}
            <div className="px-4 py-3 border-t flex items-center justify-center gap-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[9px] font-black uppercase tracking-wider opacity-60" style={{ color: 'var(--text)' }}>Completo</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span className="text-[9px] font-black uppercase tracking-wider opacity-60" style={{ color: 'var(--text)' }}>Parcial</span>
                </div>
            </div>

            <button
                type="button"
                onClick={onClose}
                className="w-full py-3 text-[10px] font-black uppercase tracking-[0.3em] transition-colors hover:text-red-500"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--muted)', borderColor: 'var(--border)' }}
            >
                Fechar
            </button>
        </div>
    );
};

export default TaskWorkloadCalendar;
