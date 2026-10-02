# FitBuddy: An Equipment-Aware AI Voice Fitness Coach

FitBuddy is an educational AI fitness assistant built as a school project. It helps users generate and manage workout plans that strictly adhere to their available equipment, space, and personal preferences, using voice interaction and a friendly animated avatar.

## Architecture & Tech Stack
- **Backend**: Python 3, FastAPI, SQLAlchemy (SQLite), Pydantic.
- **Frontend**: Plain HTML, CSS, JavaScript (Vanilla, no framework).
- **AI Integration**: Google Gemini API via `google-generativeai` SDK. Includes a fallback rule-based mode for local deterministic demonstration without API keys.
- **Database**: SQLite. Data is persisted locally in `fitbuddy.db`.
- **Voice/Audio**: Browser Web Speech API (`SpeechRecognition` for STT, `SpeechSynthesis` for TTS). Entirely local to the browser.
- **Avatar**: Lightweight CSS-animated SVG integrated directly into the HTML structure.

## Setup Instructions for Windows

1. **Install Python**: Ensure you have Python 3.10+ installed. Check by running `python --version` in your terminal.
2. **Clone/Download the repository** to your local machine.
3. **Open Terminal (PowerShell)** and navigate to the project directory:
   ```powershell
   cd path\to\AIVoiceAgent-gymbuddy
   ```
4. **Create and Activate a Virtual Environment**:
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```
5. **Install Dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```
6. **Configuration**:
   - Copy `.env.example` to `.env`.
   - By default, `USE_MOCK_AI=true` is set to run without requiring a paid/active AI key.
   - If you want live AI, get a key from [Google AI Studio](https://aistudio.google.com/) and update `GEMINI_API_KEY` in `.env`, and set `USE_MOCK_AI=false`.
7. **Run the Server**:
   ```powershell
   uvicorn backend.main:app --reload
   ```
8. **Open in Browser**: Navigate to `http://localhost:8000/`

## Database Explanation
The database (`fitbuddy.db`) is structured with SQLAlchemy and contains:
- **users**: Stores demographic data, goals, and experience level.
- **equipment_profiles**: Allows users to save multiple setups (e.g., "Home", "Gym").
- **workout_plans**: Stores the JSON output of the AI-generated (or mock-generated) weekly plan, linked to a specific user and equipment profile.
- **workout_sessions**: Tracks recorded actual workouts (future enhancement).

## API Documentation
The FastAPI backend auto-generates interactive API documentation. When the server is running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

Core endpoints:
- `POST /users/`: Create a user profile.
- `POST /users/{user_id}/equipment`: Save available equipment.
- `POST /users/{user_id}/generate_plan`: Trigger AI generation based strictly on eligible exercises.
- `POST /chat`: Interact with the voice coach contextually.

## Demonstration Script (Mock AI Mode)
To ensure a reliable presentation, run the app in Mock Mode (`USE_MOCK_AI=true`):
1. **Profile**: Enter "Alex", check "18 or older", select "Beginner", and click "Save Profile".
2. **Equipment**: Check "Exercise mat" and "Dumbbells", name it "Home", and click "Save Equipment".
3. **Chat**: Click "Push to Talk" and say "Hi FitBuddy". Ensure your microphone permission is granted. The avatar will listen, think, and speak back a rule-based response.
4. **Plan**: Click "Generate Plan". The backend will instantly build a valid dumbbell/bodyweight-only plan. Notice how no barbells or machines are included.

## Troubleshooting
- **Microphone not working**: Ensure your browser (Chrome/Edge recommended) has microphone permissions allowed for `localhost`.
- **"Connection Error" / "API Error"**: Ensure the backend server is running via Uvicorn. Check the terminal for Python errors.
- **Speech Synthesis is silent**: Some browsers require a user interaction (like clicking a button) before playing audio. Ensure volume is up.

## Verification of External Services (As of current setup)
- **Google Gemini API**: Verified free tier availability via Google AI Studio. SDK used: `google-generativeai`. Data handling: Google states free tier data may be used for model training; do not enter personal medical info.
- **Web Speech API**: Standard across modern Chrome, Edge, and Safari. No external paid services required.

## Known Limitations & Future Improvements
- **Strict Equipment Verification**: Currently rudimentary. An AI model could theoretically hallucinate. We mitigate this by sending the AI *only* the eligible list and validating the JSON format.
- **Multi-user Isolation**: Currently built for a single local user. Needs authentication (JWT/OAuth) for public deployment.
- **Persistence of Sessions**: While models exist, UI for recording daily completions is not fully implemented in this MVP vertical slice.
- **Medical Disclaimer**: This is an educational tool. It does not replace professional medical or fitness advice.
