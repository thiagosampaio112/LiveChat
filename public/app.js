const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const statusDiv = document.getElementById('status');
const avatar = document.getElementById('avatar-container');

let recognition = null;
let audioContext = null;
let chatHistory = [];
let isConnected = false;

connectBtn.addEventListener('click', () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

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
                        statusDiv.innerText = "Iniciando Audio...";
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

let nextPlayTime = 0;

function playAudio(base64Data) {
    try {
        const binaryStr = window.atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        
        audioContext.decodeAudioData(bytes.buffer, (audioBuffer) => {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            const currentTime = audioContext.currentTime;
            if (currentTime < nextPlayTime) {
                source.start(nextPlayTime);
                nextPlayTime += audioBuffer.duration;
            } else {
                source.start(currentTime);
                nextPlayTime = currentTime + audioBuffer.duration;
            }
            
            avatar.classList.add('speaking');
            statusDiv.innerText = "Professor falando...";
            
            source.onended = () => {
                if (audioContext.currentTime >= nextPlayTime) {
                    avatar.classList.remove('speaking');
                    statusDiv.innerText = "Sua vez de falar...";
                    if (isConnected && recognition) {
                        try { recognition.start(); } catch(e){}
                    }
                }
            };
        }, (e) => {
            statusDiv.innerText = "Erro de decode do Audio!";
            if (isConnected && recognition) recognition.start();
        });
    } catch(err) {
        statusDiv.innerText = "Erro no buffer de Audio!";
        if (isConnected && recognition) recognition.start();
    }
}

disconnectBtn.addEventListener('click', () => {
    isConnected = false;
    if (recognition) {
        recognition.onend = null;
        recognition.stop();
    }
    statusDiv.innerText = "Desconectado.";
    connectBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
});
