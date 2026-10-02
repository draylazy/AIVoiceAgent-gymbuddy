import sys

with open("backend/ai_service.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "from .schemas import WorkoutPlanData, WorkoutSessionSchema, ExerciseSchema",
    "from typing import Union\nfrom .schemas import WorkoutPlanData, WorkoutSessionSchema, ExerciseSchema, MealPlanData, DailyMealPlanSchema, MealSchema"
)

# 2. Add mock meal plan generator
mock_meal_plan_code = """
def _generate_mock_meal_plan(user: Any) -> MealPlanData:
    meals = [
        MealSchema(id="m1", name="Grilled Chicken Salad", calories=400, protein=45, carbs=15, fat=10, notes="Use light dressing"),
        MealSchema(id="m2", name="Protein Shake", calories=200, protein=30, carbs=10, fat=5, notes="Post-workout")
    ]
    return MealPlanData(
        days=[DailyMealPlanSchema(
            day=1,
            breakfast=["Oatmeal", "Black coffee"],
            meals=meals,
            snacks=["Almonds"],
            total_calories=1800,
            explanation="High protein focus for muscle recovery."
        )],
        general_advice="Drink at least 3 liters of water today."
    )
"""

content = content.replace("def search_online_fitness(", mock_meal_plan_code + "\ndef search_online_fitness(")


# 3. Update offline engine
old_offline_sig = "def _conversational_offline_engine(chat_history: List[Dict[str, str]]) -> Dict[str, Any]:"
new_offline_sig = "def _conversational_offline_engine(chat_history: List[Dict[str, str]], mode: str = \"fitness\") -> Dict[str, Any]:"
content = content.replace(old_offline_sig, new_offline_sig)

offline_plan_logic = """        plan = _generate_mock_plan(None, eligible)
        equip_str = ", ".join(detected_equip) if detected_equip else "bodyweight only"
        return {
            "text": f"I've created a personalized workout plan for you using {equip_str}! Check out your routine and coaching tips on the right. Let's get moving!",
            "plan_data": plan
        }"""
        
new_offline_plan_logic = """        if mode == "nutrition":
            plan = _generate_mock_meal_plan(None)
            return {
                "text": "I've created a personalized meal plan for you! Check out your nutrition guide on the right. Bon appétit!",
                "plan_data": plan
            }
        else:
            plan = _generate_mock_plan(None, eligible)
            equip_str = ", ".join(detected_equip) if detected_equip else "bodyweight only"
            return {
                "text": f"I've created a personalized workout plan for you using {equip_str}! Check out your routine and coaching tips on the right. Let's get moving!",
                "plan_data": plan
            }"""

content = content.replace(offline_plan_logic, new_offline_plan_logic)


# 4. Update groq dynamic
old_groq_dyn_sig = "def _generate_groq_dynamic_plan_from_chat(chat_history: List[Dict[str, str]]) -> WorkoutPlanData:"
new_groq_dyn_sig = "def _generate_groq_dynamic_plan_from_chat(chat_history: List[Dict[str, str]], mode: str = \"fitness\") -> Union[WorkoutPlanData, MealPlanData]:"
content = content.replace(old_groq_dyn_sig, new_groq_dyn_sig)

groq_prompt_repl = """    if mode == "nutrition":
        prompt = f'''
        You are MealBuddy, an expert AI nutrition coach.
        Based on our conversation history and live online research below, dynamically generate a structured daily meal plan.
        
        Conversation History:
        {history_str}
        
        Live Online Research Insights:
        {online_findings if online_findings else "Utilize current nutritional science."}
        
        CRITICAL INSTRUCTION: If the user is asking for a "different", "new", or "changed" plan, you MUST select completely different meals compared to what was discussed previously in the chat history. Provide a novel variation!
        
        Respond STRICTLY in valid JSON matching this schema:
        {{
          "days": [
            {{
              "day": 1,
              "breakfast": ["Oatmeal with berries (300 kcal)", "Black coffee"],
              "meals": [
                {{
                  "id": "meal_1",
                  "name": "Grilled Chicken Salad",
                  "calories": 450,
                  "protein": 40,
                  "carbs": 20,
                  "fat": 15,
                  "notes": "Use light dressing"
                }}
              ],
              "snacks": ["Apple and almonds"],
              "total_calories": 2000,
              "explanation": "High protein focus"
            }}
          ],
          "general_advice": "Drink lots of water"
        }}
        '''
    else:
        prompt = f'''
        You are FitBuddy, an expert AI fitness coach with live internet search capabilities.
        Based on our conversation history and live online research below, dynamically generate a structured workout session plan.
        Tailor exercises to the user's requested muscle groups, equipment, and fitness level.
        
        Conversation History:
        {history_str}
        
        Live Online Research Insights:
        {online_findings if online_findings else "Utilize current exercise science and optimal hypertrophy/strength protocols."}
        
        CRITICAL INSTRUCTION: If the user is asking for a "different", "new", or "changed" plan, you MUST select completely different exercises and/or structure compared to what was discussed previously in the chat history. Provide a novel variation!
        
        Do NOT restrict yourself to any static list. Select the best, scientifically validated exercises from the web for the user's equipment and targets.
        
        Respond STRICTLY in valid JSON matching this schema:
        {{
          "sessions": [
            {{
              "day": 1,
              "warmup": ["Dynamic arm circles (30s)", "Light cardio (2 mins)"],
              "exercises": [
                {{
                  "id": "ex_1",
                  "name": "Exercise Name",
                  "sets": 3,
                  "reps": "10-12",
                  "duration_seconds": null,
                  "rest_seconds": 60,
                  "notes": "Coaching form tip"
                }}
              ],
              "cooldown": ["Static stretches (2 mins)"],
              "estimated_time_minutes": 45,
              "explanation": "Targeted focus and rationale for this session"
            }}
          ],
          "general_advice": "Key coaching tip for consistency and safety"
        }}
        '''"""

# Find the old prompt block
old_groq_prompt_start = "prompt = f\"\"\""
old_groq_prompt_end = "    \"\"\""
# This is tricky, let's use regex for prompt replacement or just str replace if possible.
import re
content = re.sub(r'prompt = f"""\s+You are FitBuddy, an expert AI fitness coach.*?general_advice": "Key coaching tip for consistency and safety"\n    }}\n    """', groq_prompt_repl, content, flags=re.DOTALL, count=1)

# Now modify the return statement of groq dynamic to handle MealPlanData
content = content.replace("return WorkoutPlanData(**data)", "return MealPlanData(**data) if mode == 'nutrition' else WorkoutPlanData(**data)", 1)


# 5. Update gemini dynamic
old_gem_dyn_sig = "def _generate_gemini_dynamic_plan_from_chat(chat_history: List[Dict[str, str]]) -> WorkoutPlanData:"
new_gem_dyn_sig = "def _generate_gemini_dynamic_plan_from_chat(chat_history: List[Dict[str, str]], mode: str = \"fitness\") -> Union[WorkoutPlanData, MealPlanData]:"
content = content.replace(old_gem_dyn_sig, new_gem_dyn_sig)

gemini_prompt_repl = """    if mode == "nutrition":
        prompt = f'''
        You are MealBuddy, an expert AI nutrition coach.
        Based on our conversation history and online research below, dynamically generate a structured daily meal plan in JSON format.
        
        Conversation History:
        {history_str}
        
        Live Online Research Insights:
        {online_findings if online_findings else "Utilize current nutritional science."}
        
        Respond STRICTLY in valid JSON matching this schema:
        {{
          "days": [
            {{
              "day": 1,
              "breakfast": ["Oatmeal with berries (300 kcal)", "Black coffee"],
              "meals": [
                {{
                  "id": "meal_1",
                  "name": "Grilled Chicken Salad",
                  "calories": 450,
                  "protein": 40,
                  "carbs": 20,
                  "fat": 15,
                  "notes": "Use light dressing"
                }}
              ],
              "snacks": ["Apple and almonds"],
              "total_calories": 2000,
              "explanation": "High protein focus"
            }}
          ],
          "general_advice": "Drink lots of water"
        }}
        '''
    else:
        prompt = f'''
        You are FitBuddy, an expert AI fitness coach with live internet access.
        Based on our conversation history and online research below, dynamically generate a structured workout session plan in JSON format.
        
        Conversation History:
        {history_str}
        
        Live Online Research Insights:
        {online_findings if online_findings else "Utilize evidence-based fitness science."}
        
        Respond STRICTLY in valid JSON matching this schema:
        {{
          "sessions": [
            {{
              "day": 1,
              "warmup": ["string"],
              "exercises": [
                {{
                  "id": "ex_1",
                  "name": "Exercise Name",
                  "sets": 3,
                  "reps": "10-12",
                  "duration_seconds": null,
                  "rest_seconds": 60,
                  "notes": "Form tip"
                }}
              ],
              "cooldown": ["string"],
              "estimated_time_minutes": 45,
              "explanation": "Targeted focus for this session"
            }}
          ],
          "general_advice": "Key coaching tip"
        }}
        '''"""

content = re.sub(r'prompt = f"""\s+You are FitBuddy, an expert AI fitness coach.*?general_advice": "Key coaching tip"\n    }}\n    """', gemini_prompt_repl, content, flags=re.DOTALL, count=1)
content = content.replace("return WorkoutPlanData(**data)", "return MealPlanData(**data) if mode == 'nutrition' else WorkoutPlanData(**data)", 1)

# 6. Update calls in _generate_groq_chat and _generate_gemini_chat
content = content.replace("_generate_groq_dynamic_plan_from_chat(chat_history)", "_generate_groq_dynamic_plan_from_chat(chat_history, mode)")
content = content.replace("_generate_gemini_dynamic_plan_from_chat(chat_history)", "_generate_gemini_dynamic_plan_from_chat(chat_history, mode)")

# Fallback inside groq chat and gemini chat
old_fallback = """            if not eligible:
                eligible = [e for e in EXERCISE_CATALOG if not e.get("required_equipment")]
            plan = _generate_mock_plan(None, eligible)
            return {"text": clean_text, "plan_data": plan}"""
new_fallback = """            if mode == 'nutrition':
                plan = _generate_mock_meal_plan(None)
                return {"text": clean_text, "plan_data": plan}
            else:
                if not eligible:
                    eligible = [e for e in EXERCISE_CATALOG if not e.get("required_equipment")]
                plan = _generate_mock_plan(None, eligible)
                return {"text": clean_text, "plan_data": plan}"""
content = content.replace(old_fallback, new_fallback)

# 7. Update engine calls in generate_conversational_response
content = content.replace("_conversational_offline_engine(chat_history)", "_conversational_offline_engine(chat_history, mode)")

with open("backend/ai_service.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Done.")
