// Use relative path for production, localhost for local development if needed
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? (window.location.port ? window.location.origin : 'http://localhost:8000')
    : window.location.origin;
let sessions = {
    fitness: "fit_" + Math.floor(Math.random() * 10000),
    nutrition: "nutri_" + Math.floor(Math.random() * 10000)
};
let chatData = {
    fitness: [
        { role: "coach", text: "Hi there! I'm FitBuddy. Tell me what equipment you have and your fitness goals, and I'll create a plan for you!" },
        { role: "coach", text: "💡 Hint: Try asking for modifications, a harder version, or a plan for a specific goal." }
    ],
    nutrition: [
        { role: "coach", text: "Hi there! I'm MealBuddy. Tell me your goals and dietary preferences, and I'll create a plan for you!" },
        { role: "coach", text: "💡 Hint: Try asking for recipe ideas, macro adjustments, or a meal plan for a specific goal." }
    ]
};
let planDataStore = {
    fitness: null,
    nutrition: null
};
// Speech APIs
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synthesis = window.speechSynthesis;
let recognition = null;
let isListening = false;

// Speech Synthesis mobile unlock
let speechUnlocked = false;
function unlockSpeech() {
    if (!speechUnlocked && synthesis) {
        const u = new SpeechSynthesisUtterance("");
        u.volume = 0;
        synthesis.speak(u);
        speechUnlocked = true;
    }
}

function updateMicIcon(state) {
    if (state === "stop") {
        btnMic.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>`;
    } else {
        btnMic.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
    }
}

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
        updateMicIcon("stop");
        btnMic.classList.add("mic-active");
        finalTranscript = ''; // Clear previous finalized text
        setAvatarState("listening");
        coachStatus.textContent = "Listening...";
        btnMic.style.opacity = "1";
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
        btnMic.classList.remove("mic-active");
        setTimeout(() => setAvatarState("idle"), 2000);
        clearTimeout(silenceTimer);
        resetChatControls();
    };

    recognition.onend = () => {
        isListening = false;
        btnMic.classList.remove("mic-active");
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

// We don't need amplitude interval anymore since audio visualizer is removed.

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
window.onAvatarAction = function (action) {
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
}

function resetChatControls() {
    btnMic.style.opacity = "1";
    updateMicIcon("mic");
    chatInput.value = "";
    const isSpeaking = (currentAudio && !currentAudio.paused) || (synthesis && synthesis.speaking);
    if (!isSpeaking) {
        setAvatarState("idle");
        coachStatus.textContent = "Ready";
    }
}

function addChatMessage(role, text, isLoad = false) {
    if (!isLoad) {
        let currentMode = document.body.classList.contains('mealbuddy-page') ? 'nutrition' : 'fitness';
        chatData[currentMode].push({ role, text });
    }
    const wrapper = document.createElement("div");
    wrapper.className = `chat-msg-wrapper wrapper-${role}`;
    
    const avatar = document.createElement("div");
    avatar.className = `chat-avatar avatar-${role}`;
    
    if (role === 'coach') {
        let currentMode = document.body.classList.contains('mealbuddy-page') ? 'nutrition' : 'fitness';
        if (currentMode === 'nutrition') {
            avatar.innerHTML = `<img src="avatar-rhino.png" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            avatar.innerHTML = `<img src="avatar-bull.png" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        }
    } else {
        avatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    }

    const msgBubble = document.createElement("div");
    msgBubble.className = `chat-msg msg-${role}`;
    msgBubble.textContent = text;
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(msgBubble);

    chatHistory.appendChild(wrapper);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function loadChatHistory(mode) {
    chatHistory.innerHTML = '';
    chatData[mode].forEach(msg => {
        addChatMessage(msg.role, msg.text, true);
    });
}

// Voice Selection logic
let preferredVoice = null;
function loadVoices() {
    const voices = synthesis.getVoices();
    if (!voices.length) return;

    // Attempt to find a suitable high-quality male voice
    preferredVoice =
        voices.find(v => v.name.includes('Microsoft David')) ||
        voices.find(v => v.name.includes('Google US English Male')) ||
        voices.find(v => v.name.includes('Microsoft Mark')) ||
        voices.find(v => v.name.toLowerCase().includes('male') && v.lang.includes('en-US')) ||
        voices.find(v => v.lang === 'en-US' && !v.name.includes('Fred')) || // Avoid 'Fred' (very robotic)
        voices.find(v => v.lang === 'en-US') ||
        voices[0];
}

let currentAudio = null;
let edgeTtsPulseInterval = null;

function stopAudioPlayback() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    if (edgeTtsPulseInterval) {
        clearInterval(edgeTtsPulseInterval);
        edgeTtsPulseInterval = null;
    }
    if (synthesis && synthesis.speaking) {
        synthesis.cancel();
    }
}

function playAudio(text, audioUrl) {
    stopAudioPlayback();

    if (audioUrl) {
        const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${API_URL}${audioUrl}`;
        currentAudio = new Audio(fullAudioUrl);

        currentAudio.onplay = () => {
            setAvatarState("speaking");
            coachStatus.textContent = "Speaking...";
            updateMicIcon("stop");

            // Rhythmic avatar lip-sync pulse while playing Edge TTS audio
            edgeTtsPulseInterval = setInterval(() => {
                if (window.bullAvatar && window.bullAvatar.wordPulse) {
                    window.bullAvatar.wordPulse();
                }
            }, 180);
        };

        currentAudio.onended = () => {
            if (edgeTtsPulseInterval) {
                clearInterval(edgeTtsPulseInterval);
                edgeTtsPulseInterval = null;
            }
            setAvatarState("idle");
            coachStatus.textContent = "Ready";
            updateMicIcon("mic");
            currentAudio = null;
        };

        currentAudio.onerror = (err) => {
            console.warn("Edge TTS audio playback failed, falling back to Web Speech API:", err);
            stopAudioPlayback();
            speakText(text);
        };

        currentAudio.play().catch(err => {
            console.warn("Edge TTS playback blocked or error, falling back to Web Speech API:", err);
            stopAudioPlayback();
            speakText(text);
        });
    } else {
        speakText(text);
    }
}

function speakText(text) {
    if (!synthesis) return;
    synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    // STRICTLY use 1.0 on mobile. Modifying pitch or rate on iOS often forces 
    // the browser to fall back to a laggy, low-quality software synthesizer.
    utterance.pitch = 1.0;
    utterance.rate = 1.0;

    utterance.onstart = () => {
        setAvatarState("speaking");
        coachStatus.textContent = "Speaking...";
        updateMicIcon("stop");
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
        updateMicIcon("mic");
    };

    utterance.onerror = (event) => {
        // If it was canceled by the user, or if iOS silently drops it, 
        // just quietly reset to ready instead of showing an error.
        setAvatarState("idle");
        coachStatus.textContent = "Ready";
        updateMicIcon("mic");
    };

    synthesis.speak(utterance);
}

// Event Listeners
btnMic.addEventListener("click", () => {
    const wasSpeaking = (currentAudio && !currentAudio.paused) || (synthesis && synthesis.speaking);
    unlockSpeech();

    if (isListening) {
        recognition.stop();
        return;
    }

    if (wasSpeaking) {
        stopAudioPlayback();
        setAvatarState("idle");
        coachStatus.textContent = "Ready";
        updateMicIcon("mic");
        return;
    }

    if (recognition && !isListening) {
        stopAudioPlayback();
        try {
            recognition.start();
        } catch (e) {
            console.error(e);
        }
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnSend.click();
    }
});

btnSend.addEventListener("click", async () => {
    unlockSpeech();
    const text = chatInput.value.trim();
    if (!text) return;

    addChatMessage("user", text);
    resetChatControls();
    setAvatarState("thinking");
    coachStatus.textContent = "Thinking...";

    try {
        let currentMode = document.body.classList.contains('mealbuddy-page') ? 'nutrition' : 'fitness';
        const response = await fetch(`${API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: text,
                session_id: sessions[currentMode],
                mode: currentMode
            })
        });

        if (response.ok) {
            const data = await response.json();
            const coachText = data.response || "Here is your plan!";
            addChatMessage("coach", coachText);
            playAudio(coachText, data.audio_url);

            // If the AI generated a plan, display it
            if (data.plan_data) {
                planDataStore[currentMode] = data.plan_data;
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
    if (!planData) {
        planDisplay.innerHTML = `
            <p style="color: var(--text-secondary); text-align: center; margin-top: 2rem;">
                Tell me your goals, and I'll create a plan for you!
            </p>`;
        return;
    }

    if (planData.days) {
        renderMealPlan(planData);
        return;
    }

    if (!planData.sessions || planData.sessions.length === 0) {
        planDisplay.innerHTML = `
            <p style="color: var(--text-secondary); text-align: center; margin-top: 2rem;">
                Tell me your goals, and I'll create a plan for you!
            </p>`;
        return;
    }

    const renderSessionContent = (session, container) => {
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
        
        container.innerHTML = html;
    };

    if (planData.sessions.length > 1) {
        let tabsHTML = `<div class="plan-tabs" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; padding-bottom: 0.5rem;">`;
        planData.sessions.forEach((sess, idx) => {
            // Use explanation as the muscle target for the button
            const target = sess.explanation ? ` - ${sess.explanation}` : '';
            tabsHTML += `<button class="plan-tab-btn" data-index="${idx}" style="white-space: nowrap; padding: 0.5rem 1rem; border: 1px solid var(--glass-border); border-radius: 20px; background: ${idx === 0 ? 'var(--accent-dark-green)' : 'transparent'}; color: ${idx === 0 ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 600;">Day ${sess.day}${target}</button>`;
        });
        tabsHTML += `</div><div id="session-display-area"></div>`;
        planDisplay.innerHTML = tabsHTML;

        const displayArea = document.getElementById('session-display-area');
        renderSessionContent(planData.sessions[0], displayArea);

        // Add event listeners
        const tabBtns = planDisplay.querySelectorAll('.plan-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                renderSessionContent(planData.sessions[idx], displayArea);
                tabBtns.forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-primary)';
                });
                e.target.style.background = 'var(--accent-dark-green)';
                e.target.style.color = '#fff';
            });
        });
    } else {
        renderSessionContent(planData.sessions[0], planDisplay);
    }
}

function renderMealPlan(planData) {
    if (!planData || !planData.days || planData.days.length === 0) {
        planDisplay.innerHTML = `
            <p style="color: var(--text-secondary); text-align: center; margin-top: 2rem;">
                Tell me your dietary goals, and I'll create a meal plan for you!
            </p>`;
        return;
    }

    const renderDayContent = (day, container) => {
        let html = `
            <h3>${day.explanation || 'Daily Nutrition'}</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
                Target calories: ${day.total_calories || 2000} kcal
            </p>
            <div class="exercises-list">
        `;

        let exNum = 1;

        const breakfastText = Array.isArray(day.breakfast) ? day.breakfast.join(", ") : (day.breakfast || "Standard breakfast");
        html += `
            <div class="exercise-row">
                <span class="ex-number">${exNum++}</span>
                <div class="ex-details">
                    <strong>Breakfast</strong>
                    <span>${breakfastText}</span>
                </div>
            </div>
        `;

        (day.meals || []).forEach(meal => {
            const details = [
                meal.calories ? `${meal.calories} kcal` : '',
                meal.protein ? `${meal.protein}g P` : '',
                meal.carbs ? `${meal.carbs}g C` : '',
                meal.fat ? `${meal.fat}g F` : ''
            ].filter(Boolean).join(' | ');

            html += `
                <div class="exercise-row">
                    <span class="ex-number">${exNum++}</span>
                    <div class="ex-details">
                        <strong>${meal.name}</strong>
                        <span>${details || 'Follow chef instructions'}</span>
                        <span style="font-size: 0.75rem; display: block; margin-top: 4px;">Tip: ${meal.notes || 'Enjoy your meal'}</span>
                    </div>
                </div>
            `;
        });

        const snacksText = Array.isArray(day.snacks) ? day.snacks.join(", ") : (day.snacks || "Healthy snacks");
        html += `
            <div class="exercise-row">
                <span class="ex-number">${exNum++}</span>
                <div class="ex-details">
                    <strong>Snacks / Dinner</strong>
                    <span>${snacksText}</span>
                </div>
            </div>
        `;

        html += `</div>`;

        const adviceText = Array.isArray(planData.general_advice) ? planData.general_advice.join(" ") : planData.general_advice;
        if (adviceText) {
            html += `<p style="margin-top: 1rem; font-size: 0.85rem; padding: 1rem; background: var(--accent-pale-green); border-radius: 12px;"><strong>Chef's Note:</strong> ${adviceText}</p>`;
        }

        container.innerHTML = html;
    };

    if (planData.days.length > 1) {
        let tabsHTML = `<div class="plan-tabs" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; padding-bottom: 0.5rem;">`;
        planData.days.forEach((day, idx) => {
            const target = day.explanation ? ` - ${day.explanation}` : '';
            tabsHTML += `<button class="plan-tab-btn" data-index="${idx}" style="white-space: nowrap; padding: 0.5rem 1rem; border: 1px solid var(--glass-border); border-radius: 20px; background: ${idx === 0 ? 'var(--accent-dark-green)' : 'transparent'}; color: ${idx === 0 ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 600;">Day ${day.day}${target}</button>`;
        });
        tabsHTML += `</div><div id="meal-display-area"></div>`;
        planDisplay.innerHTML = tabsHTML;

        const displayArea = document.getElementById('meal-display-area');
        renderDayContent(planData.days[0], displayArea);

        const tabBtns = planDisplay.querySelectorAll('.plan-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabBtns.forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-primary)';
                });
                e.target.style.background = 'var(--accent-dark-green)';
                e.target.style.color = '#fff';

                const idx = parseInt(e.target.getAttribute('data-index'));
                renderDayContent(planData.days[idx], displayArea);
            });
        });
    } else {
        renderDayContent(planData.days[0], planDisplay);
    }
}

// Initial greeting and Theme Setup
window.addEventListener('DOMContentLoaded', () => {
    const isMealBuddy = document.body.classList.contains("mealbuddy-page");
    loadChatHistory(isMealBuddy ? 'nutrition' : 'fitness');
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

    const desktopBtnOpenPlan = document.getElementById('desktop-btn-open-plan');
    const desktopPlanTitle = document.getElementById('desktop-plan-title');

    if (desktopBtnOpenPlan) {
        desktopBtnOpenPlan.addEventListener('click', () => {
            closeAllSheets();
            planSheet.classList.add('open');
            sheetBackdrop.classList.add('active');
        });
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

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllSheets();
    });

    if (btnCloseChat) btnCloseChat.addEventListener('click', closeAllSheets);
    if (btnClosePlan) btnClosePlan.addEventListener('click', closeAllSheets);
    if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeAllSheets);

    // Single Page App (SPA) logic to prevent WebGL/3D reload lag
    document.querySelectorAll('.nav-bar a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.getAttribute('href');
            if (e.currentTarget.classList.contains('active')) return;

            document.querySelectorAll('.nav-bar a').forEach(a => a.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const planTitle = document.getElementById('plan-title');
            const planIndicatorText = document.getElementById('plan-indicator-text');

            const chatHeaderSub = document.getElementById('chat-header-sub');
            const chatHeaderMain = document.getElementById('chat-header-main');
            const chatLiveIndicator = document.getElementById('chat-live-indicator');
            const floatieMainText = document.getElementById('floatie-main-text');
            const floatieIcon = document.getElementById('floatie-icon');

            if (target === 'mealbuddy.html') {
                document.body.classList.add('mealbuddy-page');
                const logoImg = document.querySelector('.logo img');
                if (logoImg) {
                    logoImg.src = "mealbuddy-logo.png";
                    logoImg.alt = "MealBuddy Logo";
                }
                if (planTitle) planTitle.textContent = "Your meal plan";
                if (planIndicatorText) planIndicatorText.textContent = "Calorie-Aware";

                if (chatHeaderSub) chatHeaderSub.textContent = "Let's build your meal plan";
                if (chatHeaderMain) chatHeaderMain.innerHTML = `What are we <span style="color: var(--accent-dark-green);">eating</span> today?`;
                if (chatLiveIndicator) chatLiveIndicator.innerHTML = `<span class="dot"></span> Live chef`;

                if (floatieMainText) floatieMainText.innerHTML = `Your Meal Plan <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
                if (floatieIcon) floatieIcon.innerHTML = `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>`;

                if (window.bullAvatar && window.bullAvatar.setMode) window.bullAvatar.setMode('nutrition');
                loadChatHistory('nutrition');
                renderPlan(planDataStore.nutrition);
            } else {
                document.body.classList.remove('mealbuddy-page');
                const logoImg = document.querySelector('.logo img');
                if (logoImg) {
                    logoImg.src = "fitbuddy-logo.png";
                    logoImg.alt = "FitBuddy Logo";
                }
                if (planTitle) planTitle.textContent = "Your Workout";
                if (planIndicatorText) planIndicatorText.textContent = "Equipment-Aware";

                if (chatHeaderSub) chatHeaderSub.textContent = "Let's build your routine";
                if (chatHeaderMain) chatHeaderMain.innerHTML = `What are we <span style="color: var(--accent-dark-green);">training</span> today?`;
                if (chatLiveIndicator) chatLiveIndicator.innerHTML = `<span class="dot"></span> Live coach`;

                if (floatieMainText) floatieMainText.innerHTML = `Your Workout <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
                if (floatieIcon) floatieIcon.innerHTML = `<path d="m14.4 14.4-4.8-4.8"/><path d="M18.65 21.35a2.12 2.12 0 0 1-3-.01L2.66 8.35a2.12 2.12 0 0 1-.01-3l.86-.86a2.12 2.12 0 0 1 3 .01l12.99 12.99a2.12 2.12 0 0 1 .01 3z"/>`;

                if (window.bullAvatar && window.bullAvatar.setMode) window.bullAvatar.setMode('fitness');
                loadChatHistory('fitness');
                renderPlan(planDataStore.fitness);
            }
        });
    });
});
