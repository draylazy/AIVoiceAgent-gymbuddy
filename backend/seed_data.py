from typing import List, Dict, Any

EXERCISE_CATALOG = [
    {
        "id": "push_up",
        "name": "Push-up",
        "movement_pattern": "Horizontal Push",
        "muscle_groups": ["Chest", "Shoulders", "Triceps", "Core"],
        "difficulty": "beginner",
        "required_equipment": [],
        "space_requirement": "mat-size",
        "impact": "low",
        "instructions": "Start in a plank position. Lower your body until your chest nearly touches the floor. Push back up.",
        "common_mistakes": ["Sagging lower back", "Flaring elbows out too wide"],
        "cautions": "Avoid if you have wrist pain.",
        "substitutions": ["knee_push_up", "dumbbell_bench_press"],
        "type": "reps"
    },
    {
        "id": "knee_push_up",
        "name": "Knee Push-up",
        "movement_pattern": "Horizontal Push",
        "muscle_groups": ["Chest", "Shoulders", "Triceps", "Core"],
        "difficulty": "beginner",
        "required_equipment": [],
        "space_requirement": "mat-size",
        "impact": "low",
        "instructions": "Start on your knees with hands shoulder-width apart. Lower your body and push back up.",
        "common_mistakes": ["Not keeping a straight line from knees to head"],
        "cautions": "Use a mat to protect knees.",
        "substitutions": ["push_up", "wall_push_up"],
        "type": "reps"
    },
    {
        "id": "squat",
        "name": "Bodyweight Squat",
        "movement_pattern": "Squat",
        "muscle_groups": ["Quads", "Glutes", "Hamstrings"],
        "difficulty": "beginner",
        "required_equipment": [],
        "space_requirement": "small",
        "impact": "low",
        "instructions": "Stand with feet shoulder-width apart. Lower your hips as if sitting in a chair, then stand back up.",
        "common_mistakes": ["Knees caving inward", "Heels lifting off the floor"],
        "cautions": "Keep chest up and avoid rounding the lower back.",
        "substitutions": ["goblet_squat", "lunges"],
        "type": "reps"
    },
    {
        "id": "goblet_squat",
        "name": "Dumbbell Goblet Squat",
        "movement_pattern": "Squat",
        "muscle_groups": ["Quads", "Glutes", "Hamstrings", "Core"],
        "difficulty": "intermediate",
        "required_equipment": ["Dumbbells"],
        "space_requirement": "small",
        "impact": "low",
        "instructions": "Hold a dumbbell vertically against your chest. Squat down until thighs are parallel to the floor.",
        "common_mistakes": ["Letting the weight pull you forward"],
        "cautions": "Maintain a strong core.",
        "substitutions": ["squat", "barbell_back_squat"],
        "type": "reps"
    },
    {
        "id": "dumbbell_row",
        "name": "Bent-over Dumbbell Row",
        "movement_pattern": "Horizontal Pull",
        "muscle_groups": ["Back", "Biceps"],
        "difficulty": "intermediate",
        "required_equipment": ["Dumbbells", "Bench"],
        "space_requirement": "small",
        "impact": "low",
        "instructions": "Place one knee and hand on a bench. Row the dumbbell up to your hip with the other hand.",
        "common_mistakes": ["Jerking the weight", "Rounding the back"],
        "cautions": "Keep back flat.",
        "substitutions": ["barbell_row", "band_row"],
        "type": "reps"
    },
    {
        "id": "jumping_jacks",
        "name": "Jumping Jacks",
        "movement_pattern": "Full Body",
        "muscle_groups": ["Calves", "Shoulders", "Cardio"],
        "difficulty": "beginner",
        "required_equipment": [],
        "space_requirement": "small",
        "impact": "high",
        "instructions": "Jump while spreading your arms and legs, then return to a standing position.",
        "common_mistakes": ["Landing too hard on heels"],
        "cautions": "High impact, avoid if you have knee or ankle issues.",
        "substitutions": ["step_jacks", "high_knees"],
        "type": "time"
    },
    {
        "id": "plank",
        "name": "Forearm Plank",
        "movement_pattern": "Core Isometric",
        "muscle_groups": ["Core", "Shoulders"],
        "difficulty": "beginner",
        "required_equipment": ["Exercise mat"],
        "space_requirement": "mat-size",
        "impact": "low",
        "instructions": "Hold a straight body position resting on your forearms and toes.",
        "common_mistakes": ["Hips sagging", "Hips raised too high"],
        "cautions": "Breathe normally throughout.",
        "substitutions": ["push_up_plank", "deadbug"],
        "type": "time"
    }
]

def get_eligible_exercises(user_equipment: List[str], user_preferences: str = "", avoid_movements: str = "") -> List[Dict[str, Any]]:
    eligible = []
    
    # Normalize inputs
    equip_lower = [e.lower() for e in user_equipment]
    pref_lower = user_preferences.lower() if user_preferences else ""
    avoid_lower = avoid_movements.lower() if avoid_movements else ""
    
    for ex in EXERCISE_CATALOG:
        # Check equipment
        reqs = ex["required_equipment"]
        has_equipment = True
        for req in reqs:
            if req.lower() not in equip_lower:
                has_equipment = False
                break
        
        if not has_equipment:
            continue
            
        # Check impact
        if "low-impact" in pref_lower or "no-jumping" in pref_lower:
            if ex["impact"] == "high":
                continue
                
        # Basic check for avoided movements (very rudimentary)
        if avoid_lower and any(avoid_word in ex["name"].lower() for avoid_word in avoid_lower.split(",")):
            continue
            
        eligible.append(ex)
        
    return eligible
