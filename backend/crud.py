from sqlalchemy.orm import Session
from . import models, schemas
import json

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_equipment_profiles(db: Session, user_id: int):
    return db.query(models.EquipmentProfile).filter(models.EquipmentProfile.user_id == user_id).all()

def create_equipment_profile(db: Session, profile: schemas.EquipmentProfileCreate, user_id: int):
    db_profile = models.EquipmentProfile(**profile.model_dump(), user_id=user_id)
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    return db_profile

def get_active_plan(db: Session, user_id: int):
    return db.query(models.WorkoutPlan).filter(models.WorkoutPlan.user_id == user_id, models.WorkoutPlan.is_active == True).first()

def create_workout_plan(db: Session, plan_data: schemas.WorkoutPlanData, user_id: int, equipment_profile_id: int):
    # Deactivate old plans
    old_plans = db.query(models.WorkoutPlan).filter(models.WorkoutPlan.user_id == user_id).all()
    for p in old_plans:
        p.is_active = False
    
    db_plan = models.WorkoutPlan(
        user_id=user_id,
        equipment_profile_id=equipment_profile_id,
        plan_data=plan_data.model_dump_json(),
        is_active=True,
        is_valid=True
    )
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan
