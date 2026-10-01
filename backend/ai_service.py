import os
import json
import re
from typing import List, Dict, Any
from .schemas import WorkoutPlanData, WorkoutSessionSchema, ExerciseSchema
from .seed_data import get_eligible_exercises, EXERCISE_CATALOG

def load_env_file():
    """Load .env file from project root if it exists without requiring external packages."""
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k not in os.environ:
                            os.environ[k] = v
        except Exception as e:
            print(f"Error loading .env: {e}")

load_env_file()

def get_ai_provider():
    """Determine AI provider: groq > gemini > mock."""
    load_env_file()
    use_mock = os.getenv("USE_MOCK_AI", "false").lower() == "true"
    if use_mock:
        return "mock"
    
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key and groq_key.strip() and groq_key != "your_groq_api_key_here":
        return "groq"
        
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and gemini_key.strip() and gemini_key != "your_api_key_here":
        return "gemini"
        
    return "mock"

def get_ai_mode():
    return "mock" if get_ai_provider() == "mock" else "live"

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

if GENAI_AVAILABLE and os.getenv("GEMINI_API_KEY"):
    try:
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    except Exception:
        pass

def generate_workout_plan(user: Any, equipment: Any, eligible_exercises: List[Dict[str, Any]]) -> WorkoutPlanData:
    provider = get_ai_provider()
    
    if not eligible_exercises:
        raise ValueError("No eligible exercises found for the given equipment and preferences.")
        
    if provider == "groq" and GROQ_AVAILABLE:
        try:
            return _generate_groq_plan(user, equipment, eligible_exercises)
        except Exception as e:
            print(f"Groq plan generation error: {e}. Falling back to mock plan.")
            return _generate_mock_plan(user, eligible_exercises)
            
    if provider == "gemini" and GENAI_AVAILABLE:
        try:
            return _generate_gemini_plan(user, equipment, eligible_exercises)
        except Exception as e:
            print(f"Gemini plan generation error: {e}. Falling back to mock plan.")
            return _generate_mock_plan(user, eligible_exercises)
            
    return _generate_mock_plan(user, eligible_exercises)

def _generate_mock_plan(user: Any, eligible_exercises: List[Dict[str, Any]]) -> WorkoutPlanData:
    import random
    sessions = []
    num_exercises = min(4, len(eligible_exercises))
    selected = random.sample(eligible_exercises, num_exercises)
    
    exercises = []
    for ex in selected:
        if ex.get("type") == "reps":
            exercises.append(ExerciseSchema(
                id=ex["id"], 
                name=ex["name"], 
                sets=3, 
                reps=10, 
                rest_seconds=60, 
                notes=ex.get("instructions", "Focus on controlled form.")
            ))
        else:
            exercises.append(ExerciseSchema(
                id=ex["id"], 
                name=ex["name"], 
                sets=3, 
                duration_seconds=30, 
                rest_seconds=30,
                notes=ex.get("instructions", "Breathe steadily throughout.")
            ))
            
    sessions.append(WorkoutSessionSchema(
        day=1,
        warmup=["Arm circles (30s)", "High knees (30s)", "Torso twists (30s)"],
        exercises=exercises,
        cooldown=["Hamstring stretch", "Quad stretch", "Deep breathing (1 min)"],
        estimated_time_minutes=25,
        explanation="Full-body activation tailored to your available equipment and space."
    ))
    
    return WorkoutPlanData(
        sessions=sessions,
        general_advice="Stay well-hydrated, control your breathing, and maintain proper form over speed."
    )

def search_online_fitness(query: str, max_results: int = 2) -> str:
    """Search online for current evidence-based workouts, routines, and exercises."""
    try:
        from ddgs import DDGS
        results = list(DDGS().text(f"{query} workout exercises form", max_results=max_results))
        if not results:
            return ""
        snippets = []
        for r in results:
            title = r.get("title", "")
            body = r.get("body", "")
            snippets.append(f"- {title}: {body}")
        return "\n".join(snippets)
    except Exception as e:
        print(f"Online search notice: {e}")
        return ""

GROQ_PRIMARY_MODELS = [
    os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
]

def get_groq_model():
    return GROQ_PRIMARY_MODELS[0]

def _groq_call_with_fallback(client, messages, response_format=None, temperature=0.7, max_tokens=400):
    """Try each groq model in order, returning the first successful completion."""
    for model in GROQ_PRIMARY_MODELS:
        try:
            kwargs = dict(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            if response_format:
                kwargs["response_format"] = response_format
            return client.chat.completions.create(**kwargs)
        except Exception as e:
            print(f"Groq model {model} failed: {e}. Trying next...")
    raise RuntimeError("All Groq models failed.")

def _generate_groq_plan(user: Any, equipment: Any, eligible_exercises: List[Dict[str, Any]]) -> WorkoutPlanData:
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    goal = getattr(user, 'goal', 'general fitness')
    equip = getattr(equipment, 'equipment_list', 'bodyweight')
    
    # Search online for the best, most up-to-date workouts and exercises
    online_findings = search_online_fitness(f"{goal} with {equip}", max_results=2)
    
    prompt = f"""
    You are FitBuddy, an expert AI fitness coach with live internet research capabilities.
    Create a {getattr(user, 'workout_days', 3)}-day weekly workout plan for a user based on modern exercise science and online research.
    User Goal: {goal}
    Experience Level: {getattr(user, 'experience_level', 'beginner')}
    Minutes per session: {getattr(user, 'minutes_per_session', 30)}
    Preferences: {getattr(user, 'preferences', 'none')}
    Equipment Available: {equip}
    
    Online Research & Best Practice Insights:
    {online_findings if online_findings else "Utilize evidence-based exercise science and optimal hypertrophy/strength protocols."}
    
    Do NOT restrict yourself to a static list. Pick the best, most effective, and safe exercises found online or in modern fitness science.
    
    Respond STRICTLY in valid JSON matching this schema:
    {{
      "sessions": [
        {{
          "day": 1,
          "warmup": ["Dynamic movement (e.g. arm circles, leg swings)"],
          "exercises": [
            {{
              "id": "ex_1",
              "name": "Exercise Name",
              "sets": 3,
              "reps": "10-12", 
              "duration_seconds": null,
              "rest_seconds": 60,
              "notes": "Evidence-based coaching form tip"
            }}
          ],
          "cooldown": ["Targeted static stretches"],
          "estimated_time_minutes": 45, // MUST accurately calculate total time based on sets, reps, rests, warmup, and cooldown
          "explanation": "Scientific rationale for this session"
        }}
      ],
      "general_advice": "Evidence-based recovery and consistency advice"
    }}
    """
    
    completion = _groq_call_with_fallback(
        client,
        [{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.3,
        max_tokens=800
    )
    raw = completion.choices[0].message.content.strip()
    data = json.loads(raw)
    if "workout_plan" in data and isinstance(data["workout_plan"], dict):
        data = data["workout_plan"]
    elif "plan" in data and isinstance(data["plan"], dict):
        data = data["plan"]
    return WorkoutPlanData(**data)

def get_gemini_model():
    """Get the active Gemini model supported by current API."""
    for model_name in ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash']:
        try:
            return genai.GenerativeModel(model_name)
        except Exception:
            continue
    return genai.GenerativeModel('gemini-3.8-flash')

def _generate_gemini_plan(user: Any, equipment: Any, eligible_exercises: List[Dict[str, Any]]) -> WorkoutPlanData:
    model = get_gemini_model()
    catalog_str = json.dumps([{"id": e["id"], "name": e["name"], "type": e["type"]} for e in eligible_exercises])
    
    prompt = f"""
    You are FitBuddy, an expert fitness coach. Create a {getattr(user, 'workout_days', 3)}-day weekly workout plan for a user.
    User Goal: {getattr(user, 'goal', 'general fitness')}
    Experience Level: {getattr(user, 'experience_level', 'beginner')}
    Minutes per session: {getattr(user, 'minutes_per_session', 30)}
    Preferences: {getattr(user, 'preferences', 'none')}
    Equipment Available: {getattr(equipment, 'equipment_list', 'bodyweight')}
    
    You MUST ONLY use exercises from this eligible catalog:
    {catalog_str}
    
    Respond STRICTLY in valid JSON matching this schema:
    {{
      "sessions": [
        {{
          "day": 1,
          "warmup": ["string"],
          "exercises": [
            {{
              "id": "must match an id from the catalog",
              "name": "name of exercise",
              "sets": 3,
              "reps": 10, 
              "duration_seconds": null,
              "rest_seconds": 60,
              "notes": "brief form tip"
            }}
          ],
          "cooldown": ["string"],
          "estimated_time_minutes": 45, // MUST accurately calculate total time based on sets, reps, rests, warmup, and cooldown
          "explanation": "brief reason for this session"
        }}
      ],
      "general_advice": "brief weekly advice"
    }}
    """
    
    response = model.generate_content(prompt)
    text = response.text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
        
    data = json.loads(text.strip())
    return WorkoutPlanData(**data)

def _detect_equipment_in_text(text: str) -> List[str]:
    equipment = []
    text_lower = text.lower()
    if "dumbbell" in text_lower:
        equipment.append("Dumbbells")
    if "bench" in text_lower:
        equipment.append("Bench")
    if "mat" in text_lower or "yoga" in text_lower:
        equipment.append("Exercise mat")
    if "band" in text_lower or "resistance" in text_lower:
        equipment.append("Resistance bands")
    if "pull up" in text_lower or "pull-up" in text_lower:
        equipment.append("Pull-up bar")
    if "kettlebell" in text_lower:
        equipment.append("Kettlebell")
    return equipment

def _conversational_offline_engine(chat_history: List[Dict[str, str]]) -> Dict[str, Any]:
    last_message = chat_history[-1]["content"].strip()
    msg_lower = last_message.lower()
    
    all_user_text = " ".join([m["content"] for m in chat_history if m["role"] == "user"])
    detected_equip = _detect_equipment_in_text(all_user_text)
    
    if any(q in msg_lower for q in ["hear me", "can you hear", "test", "testing", "mic check", "are you there"]):
        return {
            "text": "Yes, I hear you loud and clear! I'm FitBuddy, your equipment-aware fitness coach. What workout goals or equipment are we working with today?"
        }
        
    if any(q in msg_lower for q in ["hello", "hi", "hey", "who are you", "what can you do", "what is your name"]):
        return {
            "text": "Hey there! I'm FitBuddy, your AI fitness coach. I can design customized workout plans based on the equipment you actually have. Tell me what gear you have around, or ask me any workout question!"
        }
        
    if any(q in msg_lower for q in ["plan", "workout", "routine", "exercise", "give me", "create", "start", "training", "program"]):
        eligible = get_eligible_exercises(user_equipment=detected_equip)
        if not eligible:
            eligible = [e for e in EXERCISE_CATALOG if not e.get("required_equipment")]
            
        plan = _generate_mock_plan(None, eligible)
        equip_str = ", ".join(detected_equip) if detected_equip else "bodyweight only"
        return {
            "text": f"I've created a personalized workout plan for you using {equip_str}! Check out your routine and coaching tips on the right. Let's get moving!",
            "plan_data": plan
        }
        
    new_equip = _detect_equipment_in_text(msg_lower)
    if new_equip or any(q in msg_lower for q in ["no equipment", "bodyweight", "nothing", "home"]):
        if new_equip:
            gear = ", ".join(new_equip)
            return {
                "text": f"Got it, {gear}! That's plenty to get a great session in. Would you like a full-body workout or should we focus on a specific muscle group?"
            }
        else:
            return {
                "text": "Bodyweight workouts are fantastic for building functional strength, endurance, and mobility! Ready for me to generate your bodyweight plan?"
            }
            
    if "push up" in msg_lower or "pushup" in msg_lower:
        return {
            "text": "For clean push-ups, keep your body in a straight plank, tuck your elbows at a 45-degree angle, and lower your chest until it almost touches the floor. Push up explosively!"
        }
    if "squat" in msg_lower:
        return {
            "text": "For great squat form, keep your chest proud, feet shoulder-width apart, and sit back into your hips while tracking your knees over your toes. Drive up through your heels."
        }
    if "plank" in msg_lower:
        return {
            "text": "When holding a plank, brace your abs like you're taking a punch, squeeze your glutes, and keep a straight line from your shoulders down to your heels."
        }
    if "cardio" in msg_lower or "lose weight" in msg_lower or "fat" in msg_lower:
        return {
            "text": "For fat loss and cardio health, combine regular resistance training with daily steps and a moderate caloric deficit. Consistency wins every time!"
        }
    if "muscle" in msg_lower or "bulk" in msg_lower or "gains" in msg_lower:
        return {
            "text": "To build muscle, focus on progressive overload with 8 to 12 challenging reps per set, eat plenty of protein, and make sure you get 7 to 9 hours of quality sleep."
        }
        
    if any(q in msg_lower for q in ["thank", "thanks", "awesome", "great", "cool", "let's go", "ready", "good"]):
        return {
            "text": "You're very welcome! I'm here whenever you need form tips, workout motivation, or plan adjustments. Just tap Push to Talk!"
        }
        
    clean_msg = last_message.rstrip(".?!")
    return {
        "text": f"I heard you say '{clean_msg}'. As your fitness coach, I'm here to build routines tailored to your equipment and goals. What equipment do you have ready, or what exercises would you like to do?"
    }

def _generate_groq_dynamic_plan_from_chat(chat_history: List[Dict[str, str]]) -> WorkoutPlanData:
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in chat_history])
    user_msgs = [msg['content'] for msg in chat_history if msg['role'] == 'user']
    search_query = user_msgs[-1] if user_msgs else "best workout routine"
    
    online_findings = search_online_fitness(search_query, max_results=2)
    
    prompt = f"""
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
          "estimated_time_minutes": 45, // MUST accurately calculate total time based on sets, reps, rests, warmup, and cooldown
          "explanation": "Targeted focus and rationale for this session"
        }}
      ],
      "general_advice": "Key coaching tip for consistency and safety"
    }}
    """
    
    completion = _groq_call_with_fallback(
        client,
        [{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=1500
    )
        
    raw = completion.choices[0].message.content.strip()
    data = json.loads(raw)
    if "workout_plan" in data and isinstance(data["workout_plan"], dict):
        data = data["workout_plan"]
    elif "plan" in data and isinstance(data["plan"], dict):
        data = data["plan"]
        
    return WorkoutPlanData(**data)

def _generate_gemini_dynamic_plan_from_chat(chat_history: List[Dict[str, str]]) -> WorkoutPlanData:
    model = get_gemini_model()
    history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in chat_history])
    user_msgs = [msg['content'] for msg in chat_history if msg['role'] == 'user']
    search_query = user_msgs[-1] if user_msgs else "best workout routine"
    online_findings = search_online_fitness(search_query, max_results=2)
    
    prompt = f"""
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
          "estimated_time_minutes": 45, // MUST accurately calculate total time based on sets, reps, rests, warmup, and cooldown
          "explanation": "Targeted focus for this session"
        }}
      ],
      "general_advice": "Key coaching tip"
    }}
    """
    
    response = model.generate_content(prompt)
    text = response.text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    data = json.loads(text.strip())
    if "workout_plan" in data and isinstance(data["workout_plan"], dict):
        data = data["workout_plan"]
    elif "plan" in data and isinstance(data["plan"], dict):
        data = data["plan"]
    return WorkoutPlanData(**data)

def _get_system_prompt_for_mode(mode: str) -> str:
    if mode == "nutrition":
        return """You are MealBuddy — a highly knowledgeable, energetic, and conversational AI nutrition and diet coach.

Your personality:
- You speak naturally and warmly, like a real chef or dietitian talking to a client.
- You respond DIRECTLY to exactly what the user just said — never give generic filler.
- You have a great memory: you track everything from the conversation.
- You give SPECIFIC, actionable advice on food, macros, and diet.

CRITICAL DOMAIN RESTRICTION:
- You are STRICTLY a nutrition and diet coach. 
- You MUST ONLY answer questions related to food, cooking, diet, macros, and meal planning. 
- If the user asks about workouts, gym routines, lifting, exercises, or anything physical, YOU MUST POLITELY DECLINE. Tell them you are a chef/nutrition coach and suggest they click the 'Workout' tab at the top of the screen to talk to FitBuddy for exercise advice. Do NOT give them a workout plan.
"""
    
    return """You are FitBuddy — a highly knowledgeable, energetic, and conversational AI fitness coach.

Your personality:
- You speak naturally and warmly, like a real personal trainer talking to a client.
- You respond DIRECTLY to exactly what the user just said — never give generic filler.
- You have a great memory: you track everything from the conversation (equipment mentioned, muscle groups, goals, level).
- You give SPECIFIC, actionable advice — not vague platitudes.

CRITICAL DOMAIN RESTRICTION:
- You are STRICTLY a fitness and gym coach. 
- You MUST ONLY answer questions related to fitness, workouts, exercises, recovery, and gym equipment. 
- If the user asks about food, diet, macros, cooking, or meal plans, YOU MUST POLITELY DECLINE. Tell them you are a gym coach and suggest they click the 'Nutrition' tab at the top of the screen to talk to MealBuddy for diet advice. Do NOT give them a meal plan.
"""


def _get_voice_rules_for_mode(mode: str) -> str:
    if mode == "nutrition":
        return """
Voice rules (replies will be read aloud via text-to-speech):
- Keep responses to 1-3 focused sentences. Be punchy, clear, energetic.
- Never use bullet points, markdown, or lists in your spoken reply.
- If a user mentions a specific food or diet (e.g., keto, chicken breast), give a KEY nutritional tip immediately.
- If a user says what their goal is, give 2-3 top food choices for it.

CRITICAL SYSTEM INSTRUCTION regarding Meal Plans:
You have a connected app interface that can display a meal plan visually to the user.
Whenever the user asks you to:
1. Create a meal plan
2. Make a diet routine
3. Change their current meal plan
4. Give them a new day of meals

You MUST, WITHOUT FAIL, append this exact string to the very end of your response:
[GENERATE_PLAN]

Example: "Let's switch gears and build some serious muscle with a high-protein diet! I've updated your meal plan on the right. [GENERATE_PLAN]"

Do NOT add the tag for simple food tips or single recipe questions.
Never say "I heard you say..." — respond naturally as a chef would."""
    
    return """
Voice rules (replies will be read aloud via text-to-speech):
- Keep responses to 1-3 focused sentences. Be punchy, clear, energetic.
- Never use bullet points, markdown, or lists in your spoken reply.
- If a user mentions a specific exercise (e.g., bench press, squat), give a KEY form cue immediately.
- If a user says what muscle they want to train, give 2-3 top exercises for it WITH form tips.

CRITICAL SYSTEM INSTRUCTION regarding Workout Plans:
You have a connected app interface that can display a workout plan visually to the user.
Whenever the user asks you to:
1. Create a workout plan
2. Make a routine
3. Change their current workout plan
4. Give them a new day (e.g. "give me a leg day")

You MUST, WITHOUT FAIL, append this exact string to the very end of your response:
[GENERATE_PLAN]

Example: "Let's switch gears and build some serious lower body strength! I've updated your plan on the right. [GENERATE_PLAN]"

Do NOT add the tag for simple form tips or single exercise questions.
Never say "I heard you say..." — respond naturally as a coach would."""


def _generate_groq_chat(chat_history: List[Dict[str, str]], mode: str = "fitness") -> Dict[str, Any]:
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    
    # Run live web research — always search to keep answers fresh and non-static
    last_msg = chat_history[-1]["content"]
    online_context = search_online_fitness(last_msg, max_results=2)

    system_prompt = _get_system_prompt_for_mode(mode) + _get_voice_rules_for_mode(mode)

    if online_context:
        system_prompt += f"\n\nLatest fitness research you can reference:\n{online_context}"
    
    # Build messages — map "assistant" correctly, skip any non-standard roles
    messages = [{"role": "system", "content": system_prompt}]
    for msg in chat_history:
        role = msg["role"]
        if role not in ("user", "assistant"):
            continue
        messages.append({"role": role, "content": msg["content"]})
        
    completion = _groq_call_with_fallback(client, messages, temperature=0.75, max_tokens=300)
    text = completion.choices[0].message.content.strip()
    
    if "[GENERATE_PLAN]" in text:
        clean_text = text.replace("[GENERATE_PLAN]", "").strip()
        if not clean_text:
            clean_text = "I've created a new personalized workout plan for you! Check it out on the right."
            
        try:
            plan = _generate_groq_dynamic_plan_from_chat(chat_history)
            return {"text": clean_text, "plan_data": plan}
        except Exception as e:
            print(f"Error dynamically generating Groq plan: {e}")
            all_user_text = " ".join([m["content"] for m in chat_history if m["role"] == "user"])
            detected_equip = _detect_equipment_in_text(all_user_text)
            eligible = get_eligible_exercises(user_equipment=detected_equip)
            if not eligible:
                eligible = [e for e in EXERCISE_CATALOG if not e.get("required_equipment")]
            plan = _generate_mock_plan(None, eligible)
            return {"text": clean_text, "plan_data": plan}
        
    return {"text": text}

def _generate_gemini_chat(chat_history: List[Dict[str, str]], mode: str = "fitness") -> Dict[str, Any]:
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = get_gemini_model()
    
    history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in chat_history])
    
    prompt = f"""
    {_get_system_prompt_for_mode(mode)}
    
    You are speaking with the user through voice synthesis (text-to-speech).
    Keep your replies concise, natural, and direct (1 to 3 sentences max) so they sound great when read aloud.
    Directly address and answer what the user asked or said.
    
    Conversation history:
    {history_str}
    
    Respond directly to the last message, continuing the persona:
    
    {_get_voice_rules_for_mode(mode)}
    """
    
    response = model.generate_content(prompt)
    text = response.text.strip()
    
    if "[GENERATE_PLAN]" in text:
        clean_text = text.replace("[GENERATE_PLAN]", "").strip()
        if not clean_text:
            clean_text = "I've created a new personalized workout plan for you! Check it out on the right."
            
        try:
            plan = _generate_gemini_dynamic_plan_from_chat(chat_history)
            return {"text": clean_text, "plan_data": plan}
        except Exception as e:
            print(f"Error dynamically generating Gemini plan: {e}")
            all_user_text = " ".join([m["content"] for m in chat_history if m["role"] == "user"])
            detected_equip = _detect_equipment_in_text(all_user_text)
            eligible = get_eligible_exercises(user_equipment=detected_equip)
            if not eligible:
                eligible = [e for e in EXERCISE_CATALOG if not e.get("required_equipment")]
            plan = _generate_mock_plan(None, eligible)
            return {"text": clean_text, "plan_data": plan}
        
    return {"text": text}

def generate_conversational_response(chat_history: List[Dict[str, str]], mode: str = "fitness") -> Dict[str, Any]:
    provider = get_ai_provider()
    
    if provider == "groq" and GROQ_AVAILABLE:
        try:
            return _generate_groq_chat(chat_history, mode)
        except Exception as e:
            print(f"Groq chat error: {e}. Falling back to conversational dialogue engine.")
            return _conversational_offline_engine(chat_history)
            
    if provider == "gemini" and GENAI_AVAILABLE:
        try:
            return _generate_gemini_chat(chat_history, mode)
        except Exception as e:
            print(f"Gemini live error: {e}. Falling back to conversational dialogue engine.")
            return _conversational_offline_engine(chat_history)
            
    return _conversational_offline_engine(chat_history)
