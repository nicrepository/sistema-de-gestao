import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface CalendarPickerProps {
    selectedDate: string;
    onSelectDate: (date: string) => void;
    onClose: () => void;
    minDate?: string;
    maxDate?: string;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({
    selectedDate,
    onSelectDate,
    onClose,
    minDate,
    maxDate,
}) => {
    const [viewDate, setViewDate] = useState(() => {
        if (selectedDate) return new Date(selectedDate + 'T12:00:00');
        if (minDate) return new Date(minDate + 'T12:00:00');
        return new Date();
    });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const isDateInRange = (dateStr: string) => {
        if (!minDate || !maxDate) return true;
        const d = dateStr.split('T')[0];
        const s = minDate.split('T')[0];
        const e = maxDate.split('T')[0];
        return d >= s && d <= e;
    };

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

    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] w-72 border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 rounded-xl"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>

            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--text)] transition-all">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text)' }}>
                        {monthNames[month]}
                    </span>
                    <span className="text-[8px] font-bold opacity-40 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                        {year}
                    </span>
                </div>
                <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--text)] transition-all">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} className="py-2 text-center text-[9px] font-black opacity-40" style={{ color: 'var(--text)' }}>{d}</div>
                ))}
            </div>

            <div className="p-2 grid grid-cols-7 gap-1">
                {calendarDays.map((dObj, idx) => {
                    const { day, month: dMonth, year: dYear, currentMonth } = dObj;
                    const dateStr = `${dYear}-${String(dMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = selectedDate === dateStr;
                    const inRange = isDateInRange(dateStr);
                    const isToday = dateStr === todayStr;

                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => { if (inRange) { onSelectDate(dateStr); onClose(); } }}
                            className={`
                                relative py-2 rounded-lg text-[10px] font-black transition-all h-9 flex items-center justify-center
                                ${isSelected ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20' : ''}
                                ${!inRange ? 'opacity-10 cursor-not-allowed bg-slate-500/5' : (currentMonth ? 'text-[var(--text)] hover:bg-[var(--surface-2)]' : 'text-[var(--text)] opacity-30 hover:bg-[var(--surface-2)]')}
                                ${isToday && !isSelected ? 'border border-[var(--primary)] text-[var(--primary)]' : ''}
                            `}
                        >
                            {day}
                            {isSelected && (
                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center shadow-sm">
                                    <Check className="w-2 h-2 text-[var(--primary)]" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={onClose}
                className="w-full py-3 text-[10px] font-black uppercase tracking-[0.3em] transition-colors hover:bg-slate-500/10 border-t"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--muted)', borderColor: 'var(--border)' }}
            >
                Confirmar
            </button>
        </div>
    );
};

export default CalendarPicker;
