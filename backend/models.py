from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    display_name = Column(String, index=True)
    age_confirmed = Column(Boolean, default=False)
    goal = Column(String) # e.g., general fitness, strength
    experience_level = Column(String) # beginner, intermediate, advanced
    workout_days = Column(Integer, default=3)
    minutes_per_session = Column(Integer, default=30)
    preferences = Column(Text, nullable=True) # e.g., low-impact
    avoid_movements = Column(Text, nullable=True)
    
    equipment_profiles = relationship("EquipmentProfile", back_populates="user")
    workout_plans = relationship("WorkoutPlan", back_populates="user")

class EquipmentProfile(Base):
    __tablename__ = "equipment_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String) # e.g., "Home", "Gym"
    equipment_list = Column(Text) # JSON list of strings or comma-separated
    space_limitations = Column(String, nullable=True)
    
    user = relationship("User", back_populates="equipment_profiles")

class WorkoutPlan(Base):
    __tablename__ = "workout_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    equipment_profile_id = Column(Integer, ForeignKey("equipment_profiles.id"))
    plan_data = Column(Text) # JSON structure containing the full plan
    is_active = Column(Boolean, default=True)
    is_valid = Column(Boolean, default=True) # Set to false if equipment changes
    
    user = relationship("User", back_populates="workout_plans")
    equipment_profile = relationship("EquipmentProfile")

class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    plan_id = Column(Integer, ForeignKey("workout_plans.id"), nullable=True)
    date_completed = Column(String) # ISO 8601 date string
    session_data = Column(Text) # JSON recording of what was done
    difficulty_rating = Column(Integer, nullable=True) # 1-10
