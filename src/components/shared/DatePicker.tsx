import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../../store/languageStore';

const FALLBACK_MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const FALLBACK_MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const FALLBACK_WEEKDAYS_AR = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
const FALLBACK_WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseDateStr(str: string): { year: number; month: number; day: number } {
  if (!str || str.length < 10) {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return {
    year: y || new Date().getFullYear(),
    month: (m || 1) - 1,
    day: d || 1,
  };
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function DatePicker({ value, onChange, placeholder, className = '', id, disabled }: DatePickerProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const months = useMemo(() => {
    const fromI18n = t('datePicker.months', { returnObjects: true });
    if (Array.isArray(fromI18n) && fromI18n.length === 12) return fromI18n as string[];
    return language === 'ar' ? FALLBACK_MONTHS_AR : FALLBACK_MONTHS_EN;
  }, [t, language]);

  const weekdayLabels = useMemo(() => {
    const fromI18n = t('datePicker.weekdaysShort', { returnObjects: true });
    if (Array.isArray(fromI18n) && fromI18n.length === 7) return fromI18n as string[];
    return language === 'ar' ? FALLBACK_WEEKDAYS_AR : FALLBACK_WEEKDAYS_EN;
  }, [t, language]);

  const ph = placeholder ?? t('datePicker.placeholder');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { year, month } = parseDateStr(value);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  const yearRange = Array.from({ length: 102 }, (_, i) => 1945 + i);
  const yearListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (yearDropdownOpen && yearListRef.current) {
      const btn = yearListRef.current.querySelector(`[data-year="${viewYear}"]`);
      if (btn) btn.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [yearDropdownOpen, viewYear]);

  useEffect(() => {
    if (value) {
      const p = parseDateStr(value);
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setMonthDropdownOpen(false);
        setYearDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectDay = (d: number) => {
    const str = toDateStr(viewYear, viewMonth, d);
    onChange(str);
  };

  const selectToday = () => {
    const d = new Date();
    onChange(toDateStr(d.getFullYear(), d.getMonth(), d.getDate()));
  };

  const clearDate = () => {
    onChange('');
    setIsOpen(false);
  };

  const days = daysInMonth(viewYear, viewMonth);
  const firstDay = firstDayOfMonth(viewYear, viewMonth);
  const leadingEmpty = firstDay;
  const cells: (number | null)[] = [];
  for (let i = 0; i < leadingEmpty; i++) cells.push(null);
  for (let i = 1; i <= days; i++) cells.push(i);

  return (
    <div ref={containerRef} className={`relative ${className}`} dir="rtl">
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
        className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:ring-2 focus:ring-primary-gold bg-white text-right flex items-center gap-2 disabled:opacity-50"
      >
        <Calendar size={18} className="text-primary-gold shrink-0" />
        <span className={value ? 'text-dark-charcoal' : 'text-secondary-gray'}>{value || ph}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-primary-gold/30 overflow-hidden min-w-[280px]">
          {/* Header: Month & Year dropdowns */}
          <div className="p-3 bg-primary-gold/10 border-b border-primary-gold/20 flex gap-2">
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => { setYearDropdownOpen(false); setMonthDropdownOpen((o) => !o); }}
                className="w-full px-3 py-2 rounded-lg bg-white border border-primary-gold/50 text-dark-charcoal text-sm font-medium hover:bg-accent-sand/30"
              >
                {months[viewMonth]}
              </button>
              {monthDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-primary-gold/30 rounded-lg shadow-lg z-10">
                  {months.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setViewMonth(i); setMonthDropdownOpen(false); }}
                      className={`w-full px-3 py-2 text-right text-sm hover:bg-accent-sand/30 ${viewMonth === i ? 'bg-primary-gold text-white' : 'text-dark-charcoal'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => { setMonthDropdownOpen(false); setYearDropdownOpen((o) => !o); }}
                className="w-full px-3 py-2 rounded-lg bg-white border border-primary-gold/50 text-dark-charcoal text-sm font-medium hover:bg-accent-sand/30"
              >
                {viewYear}
              </button>
              {yearDropdownOpen && (
                <div ref={yearListRef} className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-primary-gold/30 rounded-lg shadow-lg z-10">
                  {yearRange.map((y) => (
                    <button
                      key={y}
                      type="button"
                      data-year={y}
                      onClick={() => { setViewYear(y); setYearDropdownOpen(false); }}
                      className={`w-full px-3 py-2 text-right text-sm hover:bg-accent-sand/30 ${viewYear === y ? 'bg-primary-gold text-white' : 'text-dark-charcoal'}`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 p-2 border-b border-secondary-gray/30">
            {weekdayLabels.map((l) => (
              <div key={l} className="text-center text-xs font-medium text-dark-charcoal/70 py-1">
                {l}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1 p-2">
            {cells.map((d, idx) =>
              d === null ? (
                <div key={`empty-${idx}`} className="aspect-square" />
              ) : (
                <button
                  key={d}
                  type="button"
                  onClick={() => selectDay(d)}
                  className={`aspect-square rounded-lg text-sm font-medium transition-colors
                    ${value && parseDateStr(value).year === viewYear && parseDateStr(value).month === viewMonth && parseDateStr(value).day === d
                      ? 'bg-primary-gold text-white'
                      : 'text-dark-charcoal hover:bg-accent-sand/50'
                    }`}
                >
                  {d}
                </button>
              )
            )}
          </div>

          {/* Footer: Clear / Today */}
          <div className="p-2 border-t border-secondary-gray/30 flex gap-2">
            <button
              type="button"
              onClick={clearDate}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-secondary-gray text-dark-charcoal text-sm hover:bg-secondary-gray/20"
            >
              <X size={14} aria-hidden /> {t('datePicker.clear')}
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="flex-1 px-3 py-2 rounded-lg bg-primary-gold text-white text-sm hover:bg-primary-gold/90"
            >
              {t('datePicker.today')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
