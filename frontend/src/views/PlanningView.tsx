import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Clock, Edit2, X,
  TrendingUp, Users, Calendar, Sun, ChevronDown
} from 'lucide-react'
import { planningApi } from '../services/api'
import { Employee, Schedule } from '../types'
import Modal from '../components/ui/Modal'
import {
  startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks,
  format, isSameDay, parseISO, differenceInMinutes, isToday, addDays
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { useT } from '../i18n'

const HOUR_PX = 56
const TOTAL_HOURS = 24
const WEEK_TARGET_HOURS = 35

type ScheduleForm = {
  employee_id: number
  date: string
  start_time: string
  end_time: string
  notes?: string
}

type EmployeeForm = {
  name: string
  role?: string
  email?: string
  phone?: string
  color: string
}

const COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#14B8A6', '#3B82F6',
]

// ── Employee Stats Card ───────────────────────────────────────────────────────

function EmployeeStatsCard({
  employee, schedules, onEdit, onDelete,
}: {
  employee: Employee; schedules: Schedule[]
  onEdit: () => void; onDelete: () => void
}) {
  const t = useT()
  const emp = schedules.filter((s) => s.employee_id === employee.id)
  const totalMinutes = emp.reduce(
    (a, s) => a + differenceInMinutes(parseISO(s.end_datetime), parseISO(s.start_datetime)), 0
  )
  const totalHours = totalMinutes / 60
  const pct = Math.min(100, (totalHours / WEEK_TARGET_HOURS) * 100)
  const days = new Set(emp.map((s) => format(parseISO(s.start_datetime), 'yyyy-MM-dd'))).size
  const statusColor = totalHours === 0 ? '#475569' : totalHours >= WEEK_TARGET_HOURS ? '#10B981' : '#F59E0B'

  return (
    <div className="group rounded-xl border border-bg-border bg-bg-elevated/30 hover:bg-bg-elevated/60 transition-all p-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: employee.color }} />
          <div className="min-w-0">
            <p className="text-text-primary text-sm font-semibold truncate">{employee.name}</p>
            {employee.role && <p className="text-text-muted text-[11px] truncate">{employee.role}</p>}
          </div>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="btn-ghost p-1 h-auto"><Edit2 size={11} /></button>
          <button onClick={onDelete} className="btn-ghost p-1 h-auto hover:text-danger-400"><Trash2 size={11} /></button>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-[11px]">{emp.length} shift{emp.length !== 1 ? 's' : ''}{days > 0 ? ` · ${days}j` : ''}</span>
          <span className="text-[11px] font-semibold" style={{ color: statusColor }}>{totalHours.toFixed(1)}h</span>
        </div>
        <div className="h-1.5 bg-bg-border rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: employee.color, opacity: totalHours === 0 ? 0.2 : 1 }} />
        </div>
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>0h</span><span>{WEEK_TARGET_HOURS}{t('planning.target_hours')}</span>
        </div>
      </div>
    </div>
  )
}

// ── Week Summary ──────────────────────────────────────────────────────────────

function WeekSummary({ schedules, employees }: { schedules: Schedule[]; employees: Employee[] }) {
  const t = useT()
  const totalHours = schedules.reduce(
    (a, s) => a + differenceInMinutes(parseISO(s.end_datetime), parseISO(s.start_datetime)) / 60, 0
  )
  const activeDays = new Set(schedules.map((s) => format(parseISO(s.start_datetime), 'yyyy-MM-dd'))).size
  const topEmployee = employees.map((e) => ({
    ...e,
    hours: schedules.filter((s) => s.employee_id === e.id)
      .reduce((a, s) => a + differenceInMinutes(parseISO(s.end_datetime), parseISO(s.start_datetime)) / 60, 0),
  })).sort((a, b) => b.hours - a.hours)[0]

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Clock, label: t('planning.hours'), value: `${totalHours.toFixed(0)}h`, color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { icon: Calendar, label: t('planning.days'), value: `${activeDays}/7`, color: 'text-success-400', bg: 'bg-success-500/10' },
          { icon: TrendingUp, label: t('planning.shifts_label'), value: String(schedules.length), color: 'text-warning-400', bg: 'bg-warning-500/10' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="card p-3 text-center">
            <div className={`inline-flex p-1.5 rounded-lg ${bg} mb-1.5`}><Icon size={13} className={color} /></div>
            <p className="text-text-primary font-bold text-base leading-none">{value}</p>
            <p className="text-text-muted text-[10px] mt-1">{label}</p>
          </div>
        ))}
      </div>
      {topEmployee && topEmployee.hours > 0 && (
        <div className="card p-3 flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-brand-500/10"><Users size={13} className="text-brand-400" /></div>
          <div>
            <p className="text-text-muted text-[10px] uppercase tracking-wide">{t('planning.top_week')}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full" style={{ background: topEmployee.color }} />
              <p className="text-text-primary font-semibold text-sm">{topEmployee.name}</p>
              <span className="text-text-muted text-xs">— {topEmployee.hours.toFixed(1)}h</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Calendar Grid ─────────────────────────────────────────────────────────────

function CalendarGrid({
  days, schedules, employees, onDayClick, onDeleteSchedule, gridRef,
}: {
  days: Date[]
  schedules: Schedule[]
  employees: Employee[]
  onDayClick: (day: Date) => void
  onDeleteSchedule: (id: number) => void
  gridRef?: React.RefObject<HTMLDivElement>
}) {
  const t = useT()

  const getSchedulesForDay = (day: Date) =>
    schedules.filter((s) => isSameDay(parseISO(s.start_datetime), day))

  const scheduleToStyle = (s: Schedule) => {
    const start = parseISO(s.start_datetime)
    const end = parseISO(s.end_datetime)
    const startH = start.getHours() + start.getMinutes() / 60
    const endH = end.getHours() + end.getMinutes() / 60
    return {
      top: `${startH * HOUR_PX}px`,
      height: `${Math.max(HOUR_PX * 0.4, (endH - startH) * HOUR_PX)}px`,
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Day headers */}
      <div className="overflow-x-auto shrink-0">
        <div className="grid border-b border-bg-border" style={{ gridTemplateColumns: '44px repeat(7, minmax(80px, 1fr))', minWidth: '620px' }}>
          <div className="border-r border-bg-border bg-bg-elevated/30 py-3" />
          {days.map((day) => {
            const today = isToday(day)
            const count = getSchedulesForDay(day).length
            return (
              <div
                key={day.toISOString()}
                className={`py-3 text-center border-r border-bg-border last:border-r-0 cursor-pointer hover:bg-bg-elevated/40 transition-colors ${today ? 'bg-brand-600/5' : ''}`}
                onClick={() => onDayClick(day)}
              >
                <p className={`text-[10px] font-semibold uppercase tracking-widest ${today ? 'text-brand-400' : 'text-text-muted'}`}>
                  {format(day, 'EEE', { locale: fr })}
                </p>
                <p className={`text-lg font-bold mt-0.5 leading-none ${today ? 'text-brand-400' : 'text-text-primary'}`}>
                  {format(day, 'd')}
                </p>
                <p className="text-[10px] text-text-muted mt-1">
                  {count > 0 ? `${count} shift${count > 1 ? 's' : ''}` : '—'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Scrollable time grid */}
      <div className="flex-1 overflow-auto" ref={gridRef}>
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: '44px repeat(7, minmax(80px, 1fr))',
            minWidth: '620px',
            height: `${TOTAL_HOURS * HOUR_PX}px`,
          }}
        >
          {/* Hour labels */}
          <div className="relative border-r border-bg-border bg-bg-elevated/10">
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute right-1.5 text-[10px] text-text-muted font-mono -translate-y-2.5"
                style={{ top: `${i * HOUR_PX}px` }}
              >
                {String(i).padStart(2, '0')}h
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const daySchedules = getSchedulesForDay(day)
            const today = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className={`relative border-r border-bg-border/50 last:border-r-0 cursor-pointer group/col ${today ? 'bg-brand-600/[0.03]' : ''}`}
                onClick={() => onDayClick(day)}
              >
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-bg-border/25" style={{ top: `${i * HOUR_PX}px` }} />
                ))}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div key={`h${i}`} className="absolute inset-x-0 border-t border-bg-border/10" style={{ top: `${(i + 0.5) * HOUR_PX}px` }} />
                ))}
                <div className="absolute inset-0 bg-brand-500/0 group-hover/col:bg-brand-500/[0.02] transition-colors pointer-events-none" />

                {daySchedules.map((schedule) => {
                  const style = scheduleToStyle(schedule)
                  const emp = employees.find((e) => e.id === schedule.employee_id)
                  const start = parseISO(schedule.start_datetime)
                  const end = parseISO(schedule.end_datetime)
                  const duration = differenceInMinutes(end, start) / 60
                  return (
                    <div
                      key={schedule.id}
                      className="absolute inset-x-1 rounded-lg overflow-hidden group/shift hover:z-10 hover:shadow-lg hover:inset-x-0.5 transition-all"
                      style={{
                        ...style,
                        background: `${emp?.color ?? '#6366F1'}22`,
                        borderLeft: `3px solid ${emp?.color ?? '#6366F1'}`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-1.5 h-full flex flex-col justify-between">
                        <div>
                          <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: emp?.color ?? '#6366F1' }}>
                            {emp?.name ?? '—'}
                          </p>
                          <p className="text-[10px] text-text-muted leading-tight mt-0.5">
                            {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                          </p>
                        </div>
                        {duration >= 1.5 && (
                          <p className="text-[10px] font-medium" style={{ color: emp?.color }}>{duration.toFixed(1)}h</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(t('planning.delete_shift_confirm'))) onDeleteSchedule(schedule.id) }}
                        className="absolute top-1 right-1 opacity-0 group-hover/shift:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded bg-danger-500/20 hover:bg-danger-500/40"
                      >
                        <X size={9} className="text-danger-400" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function PlanningView() {
  const t = useT()
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [showTeam, setShowTeam] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = 7 * HOUR_PX - 30
    }
  }, [])

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => planningApi.listEmployees().then((r) => r.data),
  })

  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ['schedules', format(weekStart, 'yyyy-MM-dd')],
    queryFn: () => planningApi.listSchedules({ week_start: weekStart.toISOString(), week_end: weekEnd.toISOString() }).then((r) => r.data),
  })

  const scheduleForm = useForm<ScheduleForm>({
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd'), start_time: '09:00', end_time: '17:00' },
  })

  const createScheduleMut = useMutation({
    mutationFn: (data: ScheduleForm) => {
      const start = new Date(`${data.date}T${data.start_time}:00`)
      const end = new Date(`${data.date}T${data.end_time}:00`)
      return planningApi.createSchedule({
        employee_id: Number(data.employee_id),
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        notes: data.notes,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); setShowAddSchedule(false); scheduleForm.reset() },
  })

  const deleteScheduleMut = useMutation({
    mutationFn: (id: number) => planningApi.deleteSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const employeeForm = useForm<EmployeeForm>({ defaultValues: { color: '#6366F1' } })
  const createEmployeeMut = useMutation({
    mutationFn: (data: EmployeeForm) => planningApi.createEmployee(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setShowAddEmployee(false); employeeForm.reset({ color: '#6366F1' }) },
  })
  const updateEmployeeMut = useMutation({
    mutationFn: (data: EmployeeForm) => planningApi.updateEmployee(editEmployee!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setEditEmployee(null) },
  })
  const deleteEmployeeMut = useMutation({
    mutationFn: (id: number) => planningApi.deleteEmployee(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })

  const openAddSchedule = (day?: Date) => {
    scheduleForm.reset({
      date: format(day ?? new Date(), 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '17:00',
      employee_id: employees[0]?.id,
    })
    setShowAddSchedule(true)
  }

  const WeekNav = () => (
    <div className="flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-1.5">
        <button onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} className="btn-secondary p-2">
          <ChevronLeft size={15} />
        </button>
        <div className="px-3 py-2 bg-bg-card border border-bg-border rounded-lg text-center min-w-[160px] md:min-w-[200px]">
          <p className="text-text-primary font-semibold text-xs md:text-sm">
            {format(weekStart, 'dd MMM', { locale: fr })} — {format(weekEnd, 'dd MMM yyyy', { locale: fr })}
          </p>
          <p className="text-text-muted text-[10px] mt-0.5">{t('planning.week_label')} {format(weekStart, 'w', { locale: fr })}</p>
        </div>
        <button onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} className="btn-secondary p-2">
          <ChevronRight size={15} />
        </button>
      </div>
      <button onClick={() => setCurrentWeek(new Date())} className="btn-ghost text-sm text-brand-400 gap-1.5">
        <Sun size={13} />
        <span className="hidden sm:inline">{t('planning.today')}</span>
      </button>
    </div>
  )

  return (
    <div className="animate-slide-up h-full flex flex-col">

      {/* ── Mobile layout ── */}
      <div className="flex flex-col gap-3 h-full md:hidden">
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} className="btn-secondary p-2">
            <ChevronLeft size={15} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-text-primary font-semibold text-xs">
              {format(weekStart, 'dd MMM', { locale: fr })} — {format(weekEnd, 'dd MMM', { locale: fr })}
            </p>
            <p className="text-text-muted text-[10px]">{t('planning.week_short')} {format(weekStart, 'w', { locale: fr })}</p>
          </div>
          <button onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} className="btn-secondary p-2">
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => openAddSchedule()} className="btn-primary flex-1 gap-1.5 py-2">
            <Plus size={15} /> {t('planning.add_shift_btn')}
          </button>
          <button
            onClick={() => setShowTeam(!showTeam)}
            className={`btn-secondary gap-1.5 px-3 ${showTeam ? 'border-brand-600/40 text-brand-400' : ''}`}
          >
            <Users size={15} />
            <span className="text-xs">{employees.length}</span>
            <ChevronDown size={12} className={`transition-transform ${showTeam ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => setCurrentWeek(new Date())} className="btn-ghost px-2.5 text-brand-400">
            <Sun size={15} />
          </button>
        </div>

        {showTeam && (
          <div className="card space-y-2 max-h-56 overflow-auto shrink-0">
            {schedules.length > 0 && <WeekSummary schedules={schedules} employees={employees} />}
            {employees.length === 0 ? (
              <p className="text-text-muted text-xs text-center py-4">{t('planning.no_employees')}</p>
            ) : (
              employees.map((emp) => (
                <EmployeeStatsCard
                  key={emp.id} employee={emp} schedules={schedules}
                  onEdit={() => { setEditEmployee(emp); employeeForm.reset({ name: emp.name, role: emp.role ?? '', email: emp.email ?? '', phone: emp.phone ?? '', color: emp.color }) }}
                  onDelete={() => { if (confirm(t('planning.deactivate_confirm').replace('{name}', emp.name))) deleteEmployeeMut.mutate(emp.id) }}
                />
              ))
            )}
            <button onClick={() => { setShowAddEmployee(true); employeeForm.reset({ color: '#6366F1' }) }} className="btn-secondary w-full gap-1.5 text-xs py-2">
              <Plus size={13} /> {t('planning.add_employee')}
            </button>
          </div>
        )}

        <div className="card p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
          <CalendarGrid
            days={days} schedules={schedules} employees={employees}
            onDayClick={openAddSchedule}
            onDeleteSchedule={(id) => deleteScheduleMut.mutate(id)}
          />
        </div>
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden md:flex gap-5 flex-1 min-h-0">
        <div className="w-64 shrink-0 flex flex-col gap-3 min-h-0">
          {schedules.length > 0 && <WeekSummary schedules={schedules} employees={employees} />}

          <div className="card flex-1 overflow-auto p-4 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <p className="text-text-secondary text-xs font-medium uppercase tracking-wide">{t('planning.team')} ({employees.length})</p>
              <button onClick={() => { setShowAddEmployee(true); employeeForm.reset({ color: '#6366F1' }) }} className="btn-ghost p-1 h-auto">
                <Plus size={14} className="text-brand-400" />
              </button>
            </div>
            {employees.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <Users size={28} className="text-text-muted mb-2 opacity-40" />
                <p className="text-text-muted text-xs">{t('planning.no_employees')}</p>
                <button onClick={() => setShowAddEmployee(true)} className="btn-primary mt-3 py-1.5 px-3 text-xs">
                  <Plus size={12} /> {t('common.add')}
                </button>
              </div>
            ) : (
              <div className="space-y-2 flex-1 overflow-auto">
                {employees.map((emp) => (
                  <EmployeeStatsCard
                    key={emp.id} employee={emp} schedules={schedules}
                    onEdit={() => { setEditEmployee(emp); employeeForm.reset({ name: emp.name, role: emp.role ?? '', email: emp.email ?? '', phone: emp.phone ?? '', color: emp.color }) }}
                    onDelete={() => { if (confirm(t('planning.deactivate_confirm').replace('{name}', emp.name))) deleteEmployeeMut.mutate(emp.id) }}
                  />
                ))}
              </div>
            )}
          </div>

          <button onClick={() => openAddSchedule()} className="btn-primary w-full shrink-0 gap-1.5">
            <Plus size={15} /> {t('planning.add_shift_btn')}
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
          <WeekNav />
          <div className="card p-0 overflow-hidden flex-1 flex flex-col min-h-0">
            <CalendarGrid
              days={days} schedules={schedules} employees={employees}
              onDayClick={openAddSchedule}
              onDeleteSchedule={(id) => deleteScheduleMut.mutate(id)}
              gridRef={gridRef}
            />
          </div>
        </div>
      </div>

      {/* ── Add Schedule Modal ── */}
      <Modal open={showAddSchedule} onClose={() => setShowAddSchedule(false)} title={t('planning.add_shift_btn')} size="sm">
        <form onSubmit={scheduleForm.handleSubmit((d) => createScheduleMut.mutate(d))} className="space-y-4">
          <div>
            <label className="label">{t('planning.employee')} *</label>
            <select {...scheduleForm.register('employee_id', { required: true, valueAsNumber: true })} className="input">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}{e.role ? ` — ${e.role}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('planning.date')} *</label>
            <input type="date" {...scheduleForm.register('date', { required: true })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('planning.start')} *</label>
              <input type="time" {...scheduleForm.register('start_time', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">{t('planning.end')} *</label>
              <input type="time" {...scheduleForm.register('end_time', { required: true })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">{t('planning.note')}</label>
            <input type="text" {...scheduleForm.register('notes')} className="input" placeholder={t('planning.shift_notes_placeholder')} />
          </div>
          {employees.length === 0 && (
            <p className="text-warning-400 text-xs bg-warning-500/10 border border-warning-500/20 rounded-lg px-3 py-2">
              {t('planning.no_employee_warning')}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowAddSchedule(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button type="submit" disabled={createScheduleMut.isPending || employees.length === 0} className="btn-primary flex-1">
              {createScheduleMut.isPending ? t('planning.creating') : t('planning.create_shift')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Add / Edit Employee Modal ── */}
      <Modal
        open={showAddEmployee || !!editEmployee}
        onClose={() => { setShowAddEmployee(false); setEditEmployee(null) }}
        title={editEmployee ? `${t('common.edit')} — ${editEmployee.name}` : t('planning.new_employee')}
        size="sm"
      >
        <form onSubmit={employeeForm.handleSubmit((d) => editEmployee ? updateEmployeeMut.mutate(d) : createEmployeeMut.mutate(d))} className="space-y-4">
          <div>
            <label className="label">{t('planning.name')} *</label>
            <input type="text" {...employeeForm.register('name', { required: true })} className="input" placeholder={t('planning.name_placeholder')} />
          </div>
          <div>
            <label className="label">{t('planning.role')}</label>
            <input type="text" {...employeeForm.register('role')} className="input" placeholder={t('planning.role_placeholder')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('planning.email')}</label>
              <input type="email" {...employeeForm.register('email')} className="input" placeholder="mail@..." />
            </div>
            <div>
              <label className="label">{t('planning.phone')}</label>
              <input type="tel" {...employeeForm.register('phone')} className="input" placeholder="06 ..." />
            </div>
          </div>
          <div>
            <label className="label">{t('planning.color')}</label>
            <div className="flex gap-2 flex-wrap mt-1">
              {COLORS.map((c) => {
                const selected = employeeForm.watch('color') === c
                return (
                  <button key={c} type="button" onClick={() => employeeForm.setValue('color', c)}
                    className="w-8 h-8 rounded-full transition-all relative"
                    style={{ background: c, outline: selected ? `2px solid ${c}` : '2px solid transparent', outlineOffset: '2px' }}
                  >
                    {selected && <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => { setShowAddEmployee(false); setEditEmployee(null) }} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button type="submit" disabled={createEmployeeMut.isPending || updateEmployeeMut.isPending} className="btn-primary flex-1">
              {editEmployee ? t('common.save') : t('planning.create')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
