// Use relative path for production, localhost for local development if needed
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? (window.location.port ? window.location.origin : 'http://localhost:8000') 
    : window.location.origin;
let sessionId = "user_" + Math.floor(Math.random() * 10000); // Simple anonymous session

// Speech APIs
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synthesis = window.speechSynthesis;
let recognition = null;
let isListening = false;

// UI Elements
const coachArea = document.getElementById("coach-area");
const coachStatus = document.getElementById("coach-status");
const btnMic = document.getElementById("btn-mic");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");
const chatHistory = document.getElementById("chat-history");
const planDisplay = document.getElementById("plan-display");

let silenceTimer = null;
let finalTranscript = ''; // Store finalized sentences

// Initialize Speech
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening until we stop it
    recognition.interimResults = true; // Show words as they are spoken
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        finalTranscript = ''; // Clear previous finalized text
        setAvatarState("listening");
        coachStatus.textContent = "Listening...";
        btnMic.style.opacity = "0.5";
        chatInput.value = "";
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        // Loop through the results starting from the current index
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + " "; // Add space between sentences
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        // Display both finalized text and currently spoken text
        chatInput.value = (finalTranscript + interimTranscript).trim();
        
        // Reset the silence timer every time we hear a new word
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
            // 2 seconds of silence detected, stop listening and send
            if (isListening) {
                recognition.stop();
            }
        }, 2000);
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setAvatarState("error");
        coachStatus.textContent = "Microphone error";
        setTimeout(() => setAvatarState("idle"), 2000);
        clearTimeout(silenceTimer);
        resetChatControls();
    };

    recognition.onend = () => {
        isListening = false;
        clearTimeout(silenceTimer);
        
        if (chatInput.value.trim() !== "") {
            setAvatarState("idle");
            coachStatus.textContent = "Sending...";
            setTimeout(() => btnSend.click(), 100);
        } else {
            resetChatControls();
        }
    };
} else {
    btnMic.disabled = true;
    btnMic.textContent = "Microphone not supported";
}

let amplitudeInterval = null;

let idleTimeout = null;

function resetIdleTimer() {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        if (coachArea.className.includes('state-idle') && window.bullAvatar) {
            window.bullAvatar.react('random');
            resetIdleTimer(); // wait another 15s before the next random move
        }
    }, 15000); // 15 seconds of idle time
}

// Hook into the avatar.js click handler so user clicks also reset the idle timer
window.onAvatarAction = function(action) {
    if (action !== 'idle' && action !== 'talk') {
        resetIdleTimer();
    }
};

function setAvatarState(state) {
    coachArea.className = `coach-area state-${state}`;
    
    if (window.bullAvatar) {
        if (state === "listening") {
            window.bullAvatar.react('nod');
        } else if (state === "thinking") {
            window.bullAvatar.react('think'); // Use the new think animation!
        } else if (state === "speaking") {
            window.bullAvatar.react('talk');
        } else if (state === "idle" || state === "error") {
            window.bullAvatar.react('reset');
        } else if (state === "celebrate") {
            window.bullAvatar.react('jump');
        }
    }
    
    // Manage idle timer
    if (state === "idle") {
        resetIdleTimer();
    } else {
        clearTimeout(idleTimeout);
    }
    
    // We handle the visualizer animation via CSS classes (.state-speaking) now, 
    // so we don't strictly need the JS interval for fake amplitude anymore, 
    // but leaving it in case future JS logic relies on it.
    if (state === "speaking") {
        if (!amplitudeInterval) {
            amplitudeInterval = setInterval(() => {
                const fakeAmplitude = Math.random() * 0.15; // random value between 0 and 0.15
                coachArea.style.setProperty('--audio-amplitude', fakeAmplitude);
            }, 100);
        }
    } else {
        if (amplitudeInterval) {
            clearInterval(amplitudeInterval);
            amplitudeInterval = null;
        }
        coachArea.style.setProperty('--audio-amplitude', 0);
    }
}

function resetChatControls() {
    btnMic.style.opacity = "1";
    chatInput.value = "";
    if (!synthesis.speaking) {
        setAvatarState("idle");
        coachStatus.textContent = "Ready";
    }
}

function addChatMessage(role, text) {
    const div = document.createElement("div");
    div.className = `chat-msg msg-${role}`;
    div.textContent = text;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Voice Selection logic
let preferredVoice = null;
function loadVoices() {
    const voices = synthesis.getVoices();
    if (!voices.length) return;
    
    // Attempt to find a suitable American male voice (young/energetic if possible)
    preferredVoice = 
        voices.find(v => v.name.includes('Google US English Male')) ||
        voices.find(v => v.name.includes('Microsoft Mark')) ||
        voices.find(v => v.name.includes('Microsoft David')) ||
        voices.find(v => v.name.toLowerCase().includes('male') && v.lang.includes('en-US')) ||
        voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('guy')) ||
        voices.find(v => v.lang === 'en-US') ||
        voices[0];
}

// Voices load asynchronously in some browsers
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices();

function speakText(text) {
    if (!synthesis) return;
    synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    // slightly deepen pitch and speed it up for a young energetic coach feel
    utterance.pitch = 0.95; 
    utterance.rate = 1.05;
    
    utterance.onstart = () => {
        setAvatarState("speaking");
        coachStatus.textContent = "Speaking...";
    };
    
    // Trigger the avatar's word pulse precisely when each word is spoken!
    utterance.onboundary = (event) => {
        if (event.name === 'word' && window.bullAvatar && window.bullAvatar.wordPulse) {
            window.bullAvatar.wordPulse();
        }
    };
    
    utterance.onend = () => {
        setAvatarState("idle");
        coachStatus.textContent = "Ready";
    };
    
    utterance.onerror = () => {
        setAvatarState("error");
        coachStatus.textContent = "Speech playback error";
        setTimeout(() => setAvatarState("idle"), 2000);
    };

    synthesis.speak(utterance);
}

// Event Listeners
btnMic.addEventListener("click", () => {
    if (recognition && !isListening) {
        synthesis.cancel();
        try {
            recognition.start();
        } catch(e) {
            console.error(e);
        }
    }
});

btnSend.addEventListener("click", async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    
    addChatMessage("user", text);
    resetChatControls();
    setAvatarState("thinking");
    coachStatus.textContent = "Thinking...";
    
    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: text,
                session_id: sessionId
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            addChatMessage("coach", data.response);
            speakText(data.response);
            
            // If the AI generated a plan, display it
            if (data.plan_data) {
                renderPlan(data.plan_data);
                setAvatarState("celebrate");
                // Wait for the jump animation before waving while speaking
                setTimeout(() => setAvatarState("speaking"), 2500);
            }
        } else {
            throw new Error("API Error");
        }
    } catch (e) {
        console.error(e);
        setAvatarState("error");
        coachStatus.textContent = "Connection error";
        addChatMessage("coach", "Sorry, I couldn't connect to the server.");
        setTimeout(() => setAvatarState("idle"), 3000);
    }
});

function renderPlan(planData) {
    if (!planData.sessions || planData.sessions.length === 0) return;
    
    const session = planData.sessions[0]; // just show the first session for now
    
    // Title
    let html = `
        <h3>${session.explanation || 'Targeted Workout'}</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
            Estimated time: ${session.estimated_time_minutes || 30} min
        </p>
        <div class="exercises-list">
    `;
    
    let exNum = 1;

    // Warmup
    const warmupText = Array.isArray(session.warmup) ? session.warmup.join(", ") : (session.warmup || "Dynamic stretching");
    html += `
        <div class="exercise-row">
            <span class="ex-number">${exNum++}</span>
            <div class="ex-details">
                <strong>Warm-up</strong>
                <span>${warmupText}</span>
            </div>
        </div>
    `;

    // Exercises
    (session.exercises || []).forEach(ex => {
        const details = [
            ex.sets ? `${ex.sets} sets` : '',
            ex.reps ? `${ex.reps} reps` : '',
            ex.duration_seconds ? `${ex.duration_seconds}s` : ''
        ].filter(Boolean).join(' × ');

        html += `
            <div class="exercise-row">
                <span class="ex-number">${exNum++}</span>
                <div class="ex-details">
                    <strong>${ex.name}</strong>
                    <span>${details || 'Follow coach instructions'}</span>
                    <span style="font-size: 0.75rem; display: block; margin-top: 4px;">Tip: ${ex.notes || 'Control the tempo'}</span>
                </div>
            </div>
        `;
    });

    // Cooldown
    const cooldownText = Array.isArray(session.cooldown) ? session.cooldown.join(", ") : (session.cooldown || "Static stretches");
    html += `
        <div class="exercise-row">
            <span class="ex-number">${exNum++}</span>
            <div class="ex-details">
                <strong>Cooldown</strong>
                <span>${cooldownText}</span>
            </div>
        </div>
    `;

    html += `</div>`;
    
    const adviceText = Array.isArray(planData.general_advice) ? planData.general_advice.join(" ") : planData.general_advice;
    if (adviceText) {
        html += `<p style="margin-top: 1rem; font-size: 0.85rem; padding: 1rem; background: var(--accent-pale-green); border-radius: 12px;"><strong>Coach's Note:</strong> ${adviceText}</p>`;
    }
    
    planDisplay.innerHTML = html;
}

// Initial greeting and Theme Setup
window.addEventListener('DOMContentLoaded', () => {
    const greeting = "Hi there! I'm FitBuddy. Tell me what equipment you have and your fitness goals, and I'll create a plan for you!";
    addChatMessage("coach", greeting);
    // Don't auto-speak on load to prevent browser autoplay blocking, wait for user interaction
    
    // Theme Toggle
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            // Optional: Save preference to localStorage
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('fitbuddy-theme', isDark ? 'dark' : 'light');
        });
        
        // Check saved preference on load (defaults to light mode)
        if (localStorage.getItem('fitbuddy-theme') === 'dark') {
            document.body.classList.add('dark-theme');
        }
    }
    
    // --- Mobile Bottom Sheets Logic ---
    const btnOpenChat = document.getElementById('btn-open-chat');
    const btnOpenPlan = document.getElementById('btn-open-plan');
    const btnCloseChat = document.getElementById('btn-close-chat');
    const btnClosePlan = document.getElementById('btn-close-plan');
    const chatSheet = document.getElementById('chat-sheet');
    const planSheet = document.getElementById('plan-sheet');
    const sheetBackdrop = document.getElementById('sheet-backdrop');
    
    function closeAllSheets() {
        if (chatSheet) chatSheet.classList.remove('open');
        if (planSheet) planSheet.classList.remove('open');
        if (sheetBackdrop) sheetBackdrop.classList.remove('active');
        // Restore focus to opening button could be added here
    }
    
    if (btnOpenChat) {
        btnOpenChat.addEventListener('click', () => {
            closeAllSheets();
            chatSheet.classList.add('open');
            sheetBackdrop.classList.add('active');
        });
    }
    
    if (btnOpenPlan) {
        btnOpenPlan.addEventListener('click', () => {
            closeAllSheets();
            planSheet.classList.add('open');
            sheetBackdrop.classList.add('active');
        });
    }
    
    if (btnCloseChat) btnCloseChat.addEventListener('click', closeAllSheets);
    if (btnClosePlan) btnClosePlan.addEventListener('click', closeAllSheets);
    if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeAllSheets);
});
