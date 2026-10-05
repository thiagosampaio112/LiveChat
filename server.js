require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// A Voz: Modelo TTS (Text-to-Speech)
const ttsModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-tts',
    generationConfig: { 
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
    }
});

// Rota REST para processar a fala do aluno e devolver o audio
app.post('/api/speak', async (req, res) => {
    try {
        const { text, history, prompt } = req.body;
        console.log("Usuario:", text);

        // Instancia o cerebro dinamicamente para usar o prompt personalizado
        const customPrompt = prompt || "Voce e um assistente amigavel. Suas respostas devem ser curtas, diretas e encorajadoras. Nao use emojis ou formatacoes textuais, pois sua resposta sera lida em voz alta.";
        
        const chatModel = genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            systemInstruction: customPrompt
        });

        const chatHistory = history || [];
        chatHistory.push({ role: "user", parts: [{ text }] });

        // PASSO 1: Gerar a resposta em texto
        const chatResult = await chatModel.generateContent({ contents: chatHistory });
        const aiText = chatResult.response.text();
        console.log("IA:", aiText);

        chatHistory.push({ role: "model", parts: [{ text: aiText }] });

        // PASSO 2: Converter o texto gerado para audio
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
            // Adicionando cabecalho WAV ao PCM
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
            res.status(500).json({ error: "Falha ao gerar audio" });
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
