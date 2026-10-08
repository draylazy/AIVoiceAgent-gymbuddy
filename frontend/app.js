const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
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
        btnMic.classList.add("mic-stop");
    } else {
        btnMic.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
        btnMic.classList.remove("mic-stop");
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
let tempUserMsgWrapper = null;
let tempUserMsgBubble = null;

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
        btnSend.disabled = true;
        chatInput.disabled = true;

        // Create temporary message bubble
        tempUserMsgWrapper = document.createElement("div");
        tempUserMsgWrapper.className = `chat-msg-wrapper wrapper-user`;
        const avatar = document.createElement("div");
        avatar.className = `chat-avatar avatar-user`;
        avatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        tempUserMsgBubble = document.createElement("div");
        tempUserMsgBubble.className = `chat-msg msg-user temp-msg`;
        tempUserMsgWrapper.appendChild(avatar);
        tempUserMsgWrapper.appendChild(tempUserMsgBubble);
        chatHistory.appendChild(tempUserMsgWrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight;
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

        // Get both finalized text and currently spoken text
        let fullText = (finalTranscript + interimTranscript).trim();
        if (tempUserMsgBubble) {
            tempUserMsgBubble.textContent = fullText + "...";
            tempUserMsgBubble.dataset.fullText = fullText;
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }

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
        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
            showToast("Microphone not detected or permission denied. Please check your microphone settings.", "error");
        }
        
        if (tempUserMsgWrapper) {
            tempUserMsgWrapper.remove();
            tempUserMsgWrapper = null;
            tempUserMsgBubble = null;
        }
        setAvatarState("error");
        coachStatus.textContent = "Microphone error";
        btnMic.classList.remove("mic-active");
        setTimeout(() => setAvatarState("idle"), 2000);
        clearTimeout(silenceTimer);
        btnSend.disabled = false;
        chatInput.disabled = false;
        resetChatControls();
    };

    recognition.onend = () => {
        isListening = false;
        btnMic.classList.remove("mic-active");
        clearTimeout(silenceTimer);
        btnSend.disabled = false;
        chatInput.disabled = false;

        let spokenText = "";
        if (tempUserMsgBubble && tempUserMsgBubble.dataset.fullText) {
            spokenText = tempUserMsgBubble.dataset.fullText;
        }

        if (tempUserMsgWrapper) {
            tempUserMsgWrapper.remove();
            tempUserMsgWrapper = null;
            tempUserMsgBubble = null;
        }

        if (spokenText.trim() !== "") {
            chatInput.value = spokenText;
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

function addChatMessage(role, text, isLoad = false, modeOverride = null) {
    let currentActiveMode = document.body.classList.contains('mealbuddy-page') ? 'nutrition' : 'fitness';
    let targetMode = modeOverride || currentActiveMode;

    if (!isLoad) {
        chatData[targetMode].push({ role, text });
    }

    // Only append to DOM if the target mode matches the currently active mode
    if (targetMode !== currentActiveMode) {
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = `chat-msg-wrapper wrapper-${role}`;
    
    const avatar = document.createElement("div");
    avatar.className = `chat-avatar avatar-${role}`;
    
    if (role === 'coach') {
        if (targetMode === 'nutrition') {
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

let typingIndicator = null;

function showTypingIndicator() {
    if (typingIndicator) return;
    typingIndicator = document.createElement("div");
    typingIndicator.className = `chat-msg-wrapper wrapper-coach typing-indicator-wrapper`;
    
    let currentMode = document.body.classList.contains('mealbuddy-page') ? 'nutrition' : 'fitness';
    const avatar = document.createElement("div");
    avatar.className = `chat-avatar avatar-coach`;
    if (currentMode === 'nutrition') {
        avatar.innerHTML = `<img src="avatar-rhino.png" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
        avatar.innerHTML = `<img src="avatar-bull.png" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    }

    const msgBubble = document.createElement("div");
    msgBubble.className = `chat-msg msg-coach typing-bubble`;
    msgBubble.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
    
    typingIndicator.appendChild(avatar);
    typingIndicator.appendChild(msgBubble);
    chatHistory.appendChild(typingIndicator);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeTypingIndicator() {
    if (typingIndicator) {
        typingIndicator.remove();
        typingIndicator = null;
    }
}

function loadChatHistory(mode) {
    chatHistory.innerHTML = '';
    chatData[mode].forEach(msg => {
        addChatMessage(msg.role, msg.text, true, mode);
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

let currentAudio = document.createElement('audio');
currentAudio.crossOrigin = "anonymous";
document.body.appendChild(currentAudio);

let audioContext = null;
let audioAnalyzer = null;
let lipSyncInterval = null;
let edgeTtsPulseInterval = null;

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioAnalyzer = audioContext.createAnalyser();
        audioAnalyzer.fftSize = 256;
        const source = audioContext.createMediaElementSource(currentAudio);
        source.connect(audioAnalyzer);
        audioAnalyzer.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function stopAudioPlayback() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    if (lipSyncInterval) {
        clearInterval(lipSyncInterval);
        lipSyncInterval = null;
        
        // Reset avatar transform
        const avatarImg = document.querySelector('.avatar-character');
        if (avatarImg) {
            avatarImg.style.transform = '';
            avatarImg.style.transition = 'transform 0.3s ease-out';
        }
    }
    if (edgeTtsPulseInterval) {
        clearInterval(edgeTtsPulseInterval);
        edgeTtsPulseInterval = null;
    }
    if (synthesis && synthesis.speaking) {
        synthesis.cancel();
    }
}

function playAudio(text, audioUrl, mode) {
    stopAudioPlayback();

    if (audioUrl) {
        const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${API_URL}${audioUrl}`;
        currentAudio.src = fullAudioUrl;

        currentAudio.onplay = () => {
            setAvatarState("speaking");
            coachStatus.textContent = "Speaking...";
            updateMicIcon("stop");// Rhythmic avatar lip-sync pulse while playing Edge TTS audio (fallback/legacy)
            edgeTtsPulseInterval = setInterval(() => {
                if (window.bullAvatar && window.bullAvatar.wordPulse) {
                    window.bullAvatar.wordPulse(mode);
                }
            }, 180);
        };

        currentAudio.onended = () => {
            stopAudioPlayback();
            setAvatarState("idle");
            coachStatus.textContent = "Ready";
            updateMicIcon("mic");
        };

        currentAudio.onerror = (err) => {
            console.warn("Edge TTS audio playback failed, falling back to Web Speech API:", err);
            stopAudioPlayback();
            speakText(text, mode);
        };

        currentAudio.play().catch(err => {
            console.warn("Edge TTS playback blocked or error, falling back to Web Speech API:", err);
            stopAudioPlayback();
            speakText(text, mode);
        });
    } else {
        speakText(text, mode);
    }
}

function speakText(text, mode) {
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
            window.bullAvatar.wordPulse(mode);
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
            showToast("Microphone could not be started. Please check your settings.", "error");
        }
    } else if (!recognition) {
        showToast("Speech recognition is not supported in this browser.", "error");
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnSend.click();
    }
});

let abortController = null;

btnSend.addEventListener("click", async () => {
    if (abortController) {
        removeTypingIndicator();
        abortController.abort();
        abortController = null;
        setAvatarState("idle");
        coachStatus.textContent = "Canceled";
        setTimeout(() => { if (coachStatus.textContent === "Canceled") coachStatus.textContent = "Ready"; }, 2000);
        btnSend.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        btnSend.classList.remove("btn-stop");
        return;
    }

    unlockSpeech();
    const text = chatInput.value.trim();
    if (!text) return;

    let currentMode = document.body.classList.contains('mealbuddy-page') ? 'nutrition' : 'fitness';

    addChatMessage("user", text, false, currentMode);
    resetChatControls();
    setAvatarState("thinking");
    coachStatus.textContent = "Thinking...";
    showTypingIndicator();
    btnSend.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>`;
    btnSend.classList.add("btn-stop");

    abortController = new AbortController();

    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: text,
                session_id: sessions[currentMode],
                mode: currentMode
            }),
            signal: abortController.signal
        });

        removeTypingIndicator();
        abortController = null;
        btnSend.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        btnSend.classList.remove("btn-stop");

        if (response.ok) {
            const data = await response.json();
            const coachText = data.response || "Here is your plan!";
            addChatMessage("coach", coachText, false, currentMode);
            
            let currentActiveMode = document.body.classList.contains('mealbuddy-page') ? 'nutrition' : 'fitness';
            if (currentMode === currentActiveMode) {
                playAudio(coachText, data.audio_url, currentMode);
            } else {
                setAvatarState("idle");
                coachStatus.textContent = "Ready";
            }

            // If the AI generated a plan, display it
            if (data.plan_data) {
                planDataStore[currentMode] = data.plan_data;
                
                // Show notification dot for new plan
                const desktopNotif = document.getElementById("desktop-plan-notif");
                const mobileNotif = document.getElementById("mobile-plan-notif");
                
                // Only show dot if the plan sheet is not currently open
                const planSheet = document.getElementById('plan-sheet');
                if (planSheet && !planSheet.classList.contains('open')) {
                    if (desktopNotif) desktopNotif.style.display = "block";
                    if (mobileNotif) mobileNotif.style.display = "block";
                }
                
                if (currentMode === currentActiveMode) {
                    renderPlan(data.plan_data);
                    setAvatarState("celebrate");
                    // Wait for the jump animation before waving while speaking
                    setTimeout(() => setAvatarState("speaking"), 2500);
                }
            }
        } else {
            throw new Error("API Error");
        }
    } catch (e) {
        removeTypingIndicator();
        abortController = null;
        btnSend.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        btnSend.classList.remove("btn-stop");

        if (e.name === 'AbortError') {
            console.log('Request aborted by user');
            return;
        }

        console.error(e);
        setAvatarState("error");
        coachStatus.textContent = "Connection error";
        addChatMessage("coach", "Sorry, I couldn't connect to the server.", false, currentMode);
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
            tabsHTML += `<button class="plan-tab-btn" data-index="${idx}" style="white-space: normal; text-align: left; line-height: 1.4; height: auto; padding: 0.5rem 1rem; border: 1px solid var(--glass-border); border-radius: 20px; background: ${idx === 0 ? 'var(--accent-dark-green)' : 'transparent'}; color: ${idx === 0 ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 600;">Day ${sess.day}${target}</button>`;
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
            tabsHTML += `<button class="plan-tab-btn" data-index="${idx}" style="white-space: normal; text-align: left; line-height: 1.4; height: auto; padding: 0.5rem 1rem; border: 1px solid var(--glass-border); border-radius: 20px; background: ${idx === 0 ? 'var(--accent-dark-green)' : 'transparent'}; color: ${idx === 0 ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 600;">Day ${day.day}${target}</button>`;
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
    if (isMealBuddy) {
        const navNut = document.getElementById('nav-nutrition');
        if (navNut) navNut.classList.add('active');
        const navWork = document.getElementById('nav-workout');
        if (navWork) navWork.classList.remove('active');
        
        // Initialize text headers
        const planTitle = document.getElementById('plan-title');
        const planIndicatorText = document.getElementById('plan-indicator-text');
        const chatHeaderSub = document.getElementById('chat-header-sub');
        const chatHeaderMain = document.getElementById('chat-header-main');
        const chatLiveIndicator = document.getElementById('chat-live-indicator');
        const floatieMainText = document.getElementById('floatie-main-text');
        const floatieIcon = document.getElementById('floatie-icon');
        
        if (planTitle) planTitle.textContent = "Your meal plan";
        if (planIndicatorText) planIndicatorText.textContent = "Calorie-Aware";
        if (chatHeaderSub) chatHeaderSub.textContent = "Let's build your meal plan";
        if (chatHeaderMain) chatHeaderMain.innerHTML = `What are we <span style="color: var(--accent-dark-green);">eating</span> today?`;
        if (chatLiveIndicator) chatLiveIndicator.innerHTML = `<span class="dot"></span> Live chef`;
        if (floatieMainText) floatieMainText.innerHTML = `Your Meal Plan <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg><span id="desktop-plan-notif" class="pulse-notif" style="display: none; width: 8px; height: 8px; background: #e74c3c; border-radius: 50%; margin-left: 2px;"></span>`;
        if (floatieIcon) floatieIcon.innerHTML = `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>`;
    }
    loadChatHistory(isMealBuddy ? 'nutrition' : 'fitness');
    // Don't auto-speak on load to prevent browser autoplay blocking, wait for user interaction



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
            const desktopNotif = document.getElementById("desktop-plan-notif");
            const mobileNotif = document.getElementById("mobile-plan-notif");
            if (desktopNotif) desktopNotif.style.display = "none";
            if (mobileNotif) mobileNotif.style.display = "none";

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
            const desktopNotif = document.getElementById("desktop-plan-notif");
            const mobileNotif = document.getElementById("mobile-plan-notif");
            if (desktopNotif) desktopNotif.style.display = "none";
            if (mobileNotif) mobileNotif.style.display = "none";

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
    document.querySelectorAll('.nav-bar a, .mobile-only-switch a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.getAttribute('href');
            if (e.currentTarget.classList.contains('active')) return;

            document.querySelectorAll('.nav-bar a, .mobile-only-switch a').forEach(a => a.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const planTitle = document.getElementById('plan-title');
            const planIndicatorText = document.getElementById('plan-indicator-text');

            const chatHeaderSub = document.getElementById('chat-header-sub');
            const chatHeaderMain = document.getElementById('chat-header-main');
            const chatLiveIndicator = document.getElementById('chat-live-indicator');
            const floatieMainText = document.getElementById('floatie-main-text');
            const floatieIcon = document.getElementById('floatie-icon');

            if (target === '#nutrition' || target.includes('nutrition')) {
                document.body.classList.add('mealbuddy-page');
                document.title = "MealBuddy: AI Nutrition Coach";
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

                if (floatieMainText) floatieMainText.innerHTML = `Your Meal Plan <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg><span id="desktop-plan-notif" class="pulse-notif" style="display: none; width: 8px; height: 8px; background: #e74c3c; border-radius: 50%; margin-left: 2px;"></span>`;
                if (floatieIcon) floatieIcon.innerHTML = `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>`;

                if (window.bullAvatar && window.bullAvatar.setMode) window.bullAvatar.setMode('nutrition');
                loadChatHistory('nutrition');
                renderPlan(planDataStore.nutrition);
            } else {
                document.body.classList.remove('mealbuddy-page');
                document.title = "FitBuddy: AI Voice Fitness Coach";
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

                if (floatieMainText) floatieMainText.innerHTML = `Your Workout <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg><span id="desktop-plan-notif" class="pulse-notif" style="display: none; width: 8px; height: 8px; background: #e74c3c; border-radius: 50%; margin-left: 2px;"></span>`;
                if (floatieIcon) floatieIcon.innerHTML = `<path d="m14.4 14.4-4.8-4.8"/><path d="M18.65 21.35a2.12 2.12 0 0 1-3-.01L2.66 8.35a2.12 2.12 0 0 1-.01-3l.86-.86a2.12 2.12 0 0 1 3 .01l12.99 12.99a2.12 2.12 0 0 1 .01 3z"/>`;

                if (window.bullAvatar && window.bullAvatar.setMode) window.bullAvatar.setMode('fitness');
                loadChatHistory('fitness');
                renderPlan(planDataStore.fitness);
            }
        });
    });
});

function showToast(message, type = "error") {
    // Remove existing toast if present
    const existing = document.querySelector('.toast-notification');
    if (existing) {
        existing.remove();
    }

    const toast = document.createElement("div");
    toast.className = `toast-notification ${type}`;
    
    const icon = document.createElement("div");
    icon.className = "toast-icon";
    if (type === "error") {
        icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }
    
    const text = document.createElement("div");
    text.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(text);
    document.body.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });
    
    // Remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 400); // Wait for transition
    }, 4000);
}


