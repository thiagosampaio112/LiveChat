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
            res.json({ audio: audioBase64, updatedHistory: chatHistory });
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
