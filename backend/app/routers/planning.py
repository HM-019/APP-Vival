from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database import get_db
from app.models import Employee, Schedule
from app.schemas import EmployeeCreate, EmployeeUpdate, EmployeeOut, ScheduleCreate, ScheduleOut
from app.auth import require_auth

router = APIRouter()


# ── Employees ─────────────────────────────────────────────────────────────────

@router.get("/employees", response_model=list[EmployeeOut])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    result = await db.execute(select(Employee).where(Employee.is_active == True).order_by(Employee.name))
    return [EmployeeOut.model_validate(e) for e in result.scalars().all()]


@router.post("/employees", response_model=EmployeeOut)
async def create_employee(
    body: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    emp = Employee(**body.model_dump())
    db.add(emp)
    await db.flush()
    await db.refresh(emp)
    return EmployeeOut.model_validate(emp)


@router.patch("/employees/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: int,
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    emp = await db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(emp, k, v)
    return EmployeeOut.model_validate(emp)


@router.delete("/employees/{employee_id}")
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    emp = await db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    emp.is_active = False
    return {"ok": True}


# ── Schedules ─────────────────────────────────────────────────────────────────

@router.get("/schedules", response_model=list[ScheduleOut])
async def list_schedules(
    week_start: Optional[str] = Query(None),
    week_end: Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    q = select(Schedule).options(selectinload(Schedule.employee))
    if week_start:
        q = q.where(Schedule.start_datetime >= datetime.fromisoformat(week_start))
    if week_end:
        q = q.where(Schedule.end_datetime <= datetime.fromisoformat(week_end))
    if employee_id:
        q = q.where(Schedule.employee_id == employee_id)
    q = q.order_by(Schedule.start_datetime)
    result = await db.execute(q)
    return [ScheduleOut.model_validate(s) for s in result.scalars().all()]


@router.post("/schedules", response_model=ScheduleOut)
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    if body.end_datetime <= body.start_datetime:
        raise HTTPException(status_code=400, detail="La fin doit être après le début")
    emp = await db.get(Employee, body.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    schedule = Schedule(**body.model_dump())
    db.add(schedule)
    await db.flush()
    result = await db.execute(
        select(Schedule).where(Schedule.id == schedule.id).options(selectinload(Schedule.employee))
    )
    return ScheduleOut.model_validate(result.scalar_one())


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    s = await db.get(Schedule, schedule_id)
    if not s:
        raise HTTPException(status_code=404, detail="Planning introuvable")
    await db.delete(s)
    return {"ok": True}
