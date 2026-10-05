require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// 1. O Cérebro: Modelo de conversação
const chatModel = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    systemInstruction: "Você é um professor de inglês nativo. Você está em uma chamada de voz com o aluno. Suas respostas devem ser curtas, diretas e encorajadoras, focadas em conversação real. Não use emojis, asteriscos ou formatações textuais, pois sua resposta será lida por um sintetizador de voz."
});

// 2. A Voz: Modelo TTS (Text-to-Speech)
const ttsModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-tts',
    generationConfig: { 
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
    }
});

// Rota REST para processar a fala do aluno e devolver o áudio
app.post('/api/speak', async (req, res) => {
    try {
        const { text, history } = req.body;
        console.log("Aluno:", text);

        const chatHistory = history || [];
        chatHistory.push({ role: "user", parts: [{ text }] });

        // PASSO 1: Gerar a resposta em texto
        const chatResult = await chatModel.generateContent({ contents: chatHistory });
        const aiText = chatResult.response.text();
        console.log("Professor:", aiText);

        chatHistory.push({ role: "model", parts: [{ text: aiText }] });

        // PASSO 2: Converter o texto gerado para áudio
        const ttsResult = await ttsModel.generateContent("Read this text aloud exactly as it is: " + aiText);
        
        const candidate = ttsResult.response.candidates[0];
        let audioBase64 = null;
        
        if (candidate && candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    audioBase64 = part.inlineData.data;
                }
            }
        }

        if (audioBase64) {
            // O Gemini TTS retorna RAW PCM (geralmente 24000Hz, 1 canal, 16-bit little-endian)
            // Precisamos construir um cabeçalho WAV padrão para o navegador entender o formato
            const pcmBuffer = Buffer.from(audioBase64, 'base64');
            const sampleRate = 24000;
            const numChannels = 1;
            const bitDepth = 16;
            
            const wavHeader = Buffer.alloc(44);
            wavHeader.write('RIFF', 0);
            wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
            wavHeader.write('WAVE', 8);
            wavHeader.write('fmt ', 12);
            wavHeader.writeUInt32LE(16, 16);
            wavHeader.writeUInt16LE(1, 20);
            wavHeader.writeUInt16LE(numChannels, 22);
            wavHeader.writeUInt32LE(sampleRate, 24);
            wavHeader.writeUInt32LE(sampleRate * numChannels * (bitDepth / 8), 28);
            wavHeader.writeUInt16LE(numChannels * (bitDepth / 8), 32);
            wavHeader.writeUInt16LE(bitDepth, 34);
            wavHeader.write('data', 36);
            wavHeader.writeUInt32LE(pcmBuffer.length, 40);
            
            const wavBase64 = Buffer.concat([wavHeader, pcmBuffer]).toString('base64');
            
            res.json({ audio: wavBase64, updatedHistory: chatHistory });
        } else {
            res.status(500).json({ error: "Falha ao gerar áudio" });
        }

    } catch (e) {
        console.error("Erro na pipeline:", e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`LiveChat Server rodando na porta ${PORT}`);
});
