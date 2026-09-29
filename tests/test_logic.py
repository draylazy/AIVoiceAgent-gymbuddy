import pytest
from backend.seed_data import get_eligible_exercises, EXERCISE_CATALOG

def test_no_equipment_plan():
    # Only bodyweight exercises should be returned
    eligible = get_eligible_exercises(user_equipment=[])
    
    # Push-up, knee push-up, squat, jumping jacks, plank shouldn't require equipment
    # (Wait, plank requires 'Exercise mat' in our catalog. Let's see.)
    for ex in eligible:
        assert len(ex["required_equipment"]) == 0

def test_dumbbell_only_plan():
    # Dumbbell Goblet Squat requires dumbbells but no bench.
    # Bent-over Dumbbell Row requires dumbbells AND bench.
    eligible = get_eligible_exercises(user_equipment=["Dumbbells"])
    
    ids = [ex["id"] for ex in eligible]
    assert "goblet_squat" in ids
    assert "dumbbell_row" not in ids # Because no bench

def test_multiple_equipment_requirements():
    # Both dumbbell and bench
    eligible = get_eligible_exercises(user_equipment=["Dumbbells", "Bench"])
    
    ids = [ex["id"] for ex in eligible]
    assert "dumbbell_row" in ids

def test_low_impact_preference():
    # Jumping jacks is high impact
    eligible = get_eligible_exercises(user_equipment=[], user_preferences="low-impact")
    
    ids = [ex["id"] for ex in eligible]
    assert "jumping_jacks" not in ids
    assert "squat" in ids
