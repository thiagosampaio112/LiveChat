const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const statusDiv = document.getElementById('status');
const avatar = document.getElementById('avatar-container');
const aiAudio = document.getElementById('ai-audio');

let recognition = null;
let chatHistory = [];
let isConnected = false;

connectBtn.addEventListener('click', () => {
    // Hack to unlock audio playback on mobile browsers:
    // Play a tiny silent audio to unlock the HTML5 Audio tag.
    aiAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    aiAudio.play().then(() => {
        aiAudio.pause();
    }).catch(e => console.log("Silent audio unlock failed:", e));

    isConnected = true;
    statusDiv.innerText = "Conectado! Pode falar em ingles.";
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
    
    startListening();
});

function startListening() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US'; 
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = async (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            
            if (isConnected) {
                statusDiv.innerText = "Enviando... (" + transcript.substring(0, 10) + ")";
                recognition.stop();
                
                try {
                    const response = await fetch('/api/speak', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: transcript, history: chatHistory })
                    });
                    
                    statusDiv.innerText = "Decodificando Resposta...";
                    const data = await response.json();
                    
                    if (data.audio) {
                        statusDiv.innerText = "Iniciando Audio HTML5...";
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
            if (isConnected && statusDiv.innerText !== "Professor falando...") {
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
        
        aiAudio.onplay = () => {
            avatar.classList.add('speaking');
            statusDiv.innerText = "Professor falando...";
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
            statusDiv.innerText = "Erro ao tocar Audio HTML5!";
            if (isConnected && recognition) recognition.start();
        };

        const playPromise = aiAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                statusDiv.innerText = "Erro de AutoPlay do Navegador!";
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
