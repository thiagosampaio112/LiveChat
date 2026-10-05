const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const statusDiv = document.getElementById('status');
const avatar = document.getElementById('avatar-container');
const aiAudio = document.getElementById('ai-audio');

// Botoes Header
const clearHistoryBtn = document.getElementById('clear-history-btn');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsModal = document.getElementById('settings-modal');

// Inputs
const aiPromptInput = document.getElementById('ai-prompt');
const userLangInput = document.getElementById('user-lang');
const voiceSpeedInput = document.getElementById('voice-speed');
const speedLabel = document.getElementById('speed-label');

let recognition = null;
let chatHistory = [];
let isConnected = false;

// Configs Atuais
let currentPrompt = aiPromptInput.value;
let currentLang = userLangInput.value;
let currentSpeed = parseFloat(voiceSpeedInput.value);

// Load Settings
if (localStorage.getItem('livechat_prompt')) {
    aiPromptInput.value = localStorage.getItem('livechat_prompt');
    currentPrompt = aiPromptInput.value;
}
if (localStorage.getItem('livechat_lang')) {
    userLangInput.value = localStorage.getItem('livechat_lang');
    currentLang = userLangInput.value;
}
if (localStorage.getItem('livechat_speed')) {
    voiceSpeedInput.value = localStorage.getItem('livechat_speed');
    currentSpeed = parseFloat(voiceSpeedInput.value);
    speedLabel.innerText = currentSpeed.toFixed(1) + "x";
}

// Eventos Modal
openSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');

closeSettingsBtn.addEventListener('click', () => {
    currentPrompt = aiPromptInput.value;
    currentLang = userLangInput.value;
    currentSpeed = parseFloat(voiceSpeedInput.value);
    
    localStorage.setItem('livechat_prompt', currentPrompt);
    localStorage.setItem('livechat_lang', currentLang);
    localStorage.setItem('livechat_speed', currentSpeed);
    
    if (recognition) recognition.lang = currentLang;
    aiAudio.playbackRate = currentSpeed;
    
    settingsModal.style.display = 'none';
});

voiceSpeedInput.addEventListener('input', (e) => {
    speedLabel.innerText = parseFloat(e.target.value).toFixed(1) + "x";
});

clearHistoryBtn.addEventListener('click', () => {
    chatHistory = [];
    alert("Memoria da conversa apagada com sucesso!");
});

connectBtn.addEventListener('click', () => {
    // Unlocks HTML5 Audio tag
    aiAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    aiAudio.playbackRate = currentSpeed;
    aiAudio.play().then(() => {
        aiAudio.pause();
    }).catch(e => console.log("Silent audio unlock failed:", e));

    isConnected = true;
    statusDiv.innerText = "Conectado! Pode falar.";
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
    
    startListening();
});

function startListening() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = currentLang; 
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = async (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            
            if (isConnected) {
                statusDiv.innerText = "Enviando... (" + transcript.substring(0, 10) + "...)";
                recognition.stop();
                
                try {
                    const response = await fetch('/api/speak', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            text: transcript, 
                            history: chatHistory,
                            prompt: currentPrompt 
                        })
                    });
                    
                    statusDiv.innerText = "Decodificando Resposta...";
                    const data = await response.json();
                    
                    if (data.audio) {
                        statusDiv.innerText = "Tocando Audio...";
                        chatHistory = data.updatedHistory;
                        playAudio(data.audio);
                    } else if (data.error) {
                        statusDiv.innerText = "Erro do Servidor: " + data.error;
                        if (isConnected) recognition.start();
                    } else {
                        statusDiv.innerText = "Falha Desconhecida";
                        if (isConnected) recognition.start();
                    }
                } catch (e) {
                    statusDiv.innerText = "Erro Fetch: " + e.message;
                    if (isConnected) recognition.start();
                }
            }
        };

        recognition.onerror = (e) => console.error("Erro no mic:", e);
        
        recognition.onend = () => {
            if (isConnected && statusDiv.innerText !== "IA falando...") {
                try { recognition.start(); } catch(e){}
            }
        };

        try { recognition.start(); } catch(e){}
    } else {
        alert("Navegador nao suporta reconhecimento de voz.");
    }
}

function playAudio(base64Data) {
    try {
        aiAudio.src = "data:audio/wav;base64," + base64Data;
        aiAudio.playbackRate = currentSpeed;
        
        aiAudio.onplay = () => {
            avatar.classList.add('speaking');
            statusDiv.innerText = "IA falando...";
        };
        
        aiAudio.onended = () => {
            avatar.classList.remove('speaking');
            statusDiv.innerText = "Sua vez de falar...";
            if (isConnected && recognition) {
                try { recognition.start(); } catch(e){}
            }
        };

        aiAudio.onerror = (e) => {
            console.error("Audio error", e);
            statusDiv.innerText = "Erro ao tocar Audio!";
            if (isConnected && recognition) recognition.start();
        };

        const playPromise = aiAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                statusDiv.innerText = "Erro Audio: " + error.name;
                if (isConnected && recognition) recognition.start();
            });
        }
    } catch(err) {
        statusDiv.innerText = "Erro na Tag Audio!";
        if (isConnected && recognition) recognition.start();
    }
}

disconnectBtn.addEventListener('click', () => {
    isConnected = false;
    if (recognition) {
        recognition.onend = null;
        recognition.stop();
    }
    aiAudio.pause();
    statusDiv.innerText = "Desconectado.";
    connectBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
});
