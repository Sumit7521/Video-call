import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Utilities ---
function toBase64(arrayBuffer) {
  return Buffer.from(arrayBuffer).toString('base64');
}

// Enhanced language detection
function detectLanguage(text) {
  const cleanText = text.toLowerCase().trim();
  
  // Hindi patterns
  const hindiPatterns = [
    /[\u0900-\u097F]/, // Devanagari script
    /\b(kya|hai|hoon|main|aap|tumhe|kaise|kaha|kahan|kyun|kab|seekhna|chahiye|batao|samjhao|sikhaiye|help|madad)\b/,
    /\b(mujhe|hume|apko|tumko|hamko|iska|uska|ye|wo|yeh|woh|koi|kuch|sab|sabhi)\b/,
    /\b(python|programming|code|variable|function|loop|array|list|dictionary)\b/
  ];
  
  // Bhojpuri patterns
  const bhojpuriPatterns = [
    /\b(ka|baa|haw|rahe|rahela|kaise|batawa|samjhawa|sikhawa|seekhe|chaahi|chahiye|madad|help)\b/,
    /\b(hamar|tohar|unkar|hamka|tohka|iska|ukar|ye|oo|ei|oi|koi|kuch|sab)\b/,
    /\b(bujhaib|sikhayib|batayib|samjhayib|karela|karta|kare|python|programming)\b/
  ];
  
  // Bengali patterns  
  const bengaliPatterns = [
    /[\u0980-\u09FF]/, // Bengali script
    /\b(ki|kemon|ache|ami|tumi|apni|kothay|kivabe|keno|kobe|shikhte|chai|help|bolo|bojhao|shikhao)\b/,
    /\b(amar|tomar|tar|amra|tomra|eta|ota|ei|oi|keu|kono|kichhu|shob|shobai)\b/,
    /\b(python|programming|code|variable|function|loop|array|list|dictionary|shikhbo|korbo)\b/
  ];
  
  // English patterns
  const englishPatterns = [
    /\b(what|how|when|where|why|who|can|could|would|should|will|do|does|did|is|are|was|were)\b/,
    /\b(python|programming|code|variable|function|loop|array|list|dictionary|learn|teach|help|explain)\b/,
    /\b(please|thank|thanks|sorry|hello|hi|hey|good|bad|yes|no|ok|okay)\b/,
    /\b(i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|her|our|their)\b/
  ];
  
  // Count matches
  let hindiScore = 0, bhojpuriScore = 0, bengaliScore = 0, englishScore = 0;
  
  hindiPatterns.forEach(pattern => {
    const matches = cleanText.match(pattern);
    if (matches) hindiScore += matches.length || 1;
  });
  
  bhojpuriPatterns.forEach(pattern => {
    const matches = cleanText.match(pattern);
    if (matches) bhojpuriScore += matches.length || 1;
  });
  
  bengaliPatterns.forEach(pattern => {
    const matches = cleanText.match(pattern);
    if (matches) bengaliScore += matches.length || 1;
  });
  
  englishPatterns.forEach(pattern => {
    const matches = cleanText.match(pattern);
    if (matches) englishScore += matches.length || 1;
  });
  
  const maxScore = Math.max(hindiScore, bhojpuriScore, bengaliScore, englishScore);
  
  if (maxScore === 0) return 'english';
  if (englishScore === maxScore) return 'english';
  if (bengaliScore === maxScore) return 'bengali';
  if (bhojpuriScore === maxScore && bhojpuriScore > hindiScore) return 'bhojpuri';
  if (hindiScore === maxScore) return 'hindi';
  
  return 'english';
}

const getRahulPrompt = (question) => {
  const detectedLang = detectLanguage(question);
  
  let languageInstruction = '';
  switch(detectedLang) {
    case 'hindi':
      languageInstruction = 'Reply in Hinglish - Use Hindi words written in ENGLISH letters only. Mix English and Hindi naturally. Example: "Python seekhna easy hai, bas practice karo regularly."';
      break;
    case 'bhojpuri':
      languageInstruction = 'Reply in Bhojpuri written in ENGLISH letters only. Use Bhojpuri words but write in English alphabet. Example: "Python sikhe ke ba easy, bas practice kara roj."';
      break;
    case 'bengali':
      languageInstruction = 'Reply in Bengali written in ENGLISH letters only. Use Bengali words but write in English alphabet. Example: "Python shekha easy, khali practice koro regularly."';
      break;
    default:
      languageInstruction = 'Reply in simple, clear English only.';
  }
  
  return `You are Rahul Mahatao, a Python instructor at Techno India University and TCS professional.
You are friendly, witty, and explain concepts clearly.

STRICT LANGUAGE RULE: 
Detected language: ${detectedLang.toUpperCase()}
${languageInstruction}

RESPONSE RULES:
1. Response must be SHORT and TO THE POINT (30-80 words maximum)
2. Use ONLY ENGLISH LETTERS - no Devanagari, no Bengali script, no other scripts
3. Give ONLY ONE response in detected language - NO repetition
4. Include code example ONLY if absolutely necessary (max 2-3 lines)
5. Add light humor but stay focused
6. Must be valid JSON format

JSON Format:
{
  "query_response": "short answer in ${detectedLang} using ENGLISH letters only",
  "follow_up_questions": ["q1","q2","q3"]
}

Student question: "${question}"`;
};

// Gemini helper
async function generateGemini25Pro(prompt) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
        responseMimeType: "application/json"
      }
    });
    
    const result = await model.generateContent([prompt]);
    const text = result?.response?.text?.() || 
                 result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
                 null;

    return text;
  } catch (err) {
    console.error("Gemini error:", err.message || err);
    return null;
  }
}

// ElevenLabs TTS
async function ttsElevenLabs(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  
  if (!apiKey || !voiceId) {
    console.error("Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID");
    return null;
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { 
          stability: 0.5, 
          similarity_boost: 0.8,
          style: 0.2
        }
      })
    });

    if (!resp.ok) {
      console.error("ElevenLabs TTS failed:", resp.status, resp.statusText);
      return null;
    }

    const arrayBuffer = await resp.arrayBuffer();
    return toBase64(arrayBuffer);
  } catch (err) {
    console.error("TTS error:", err);
    return null;
  }
}

// Main route
router.post('/ask', async (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Question is required' });

  try {
    const detectedLang = detectLanguage(question);
    
    let rawText = await generateGemini25Pro(getRahulPrompt(question));
    
    if (!rawText) {
      const fallbackResponses = {
        hindi: {
          query_response: "Sorry, main abhi busy hoon. Thoda wait karo!",
          follow_up_questions: ["Python basics?", "Code help?", "Aur sawaal?"]
        },
        bhojpuri: {
          query_response: "Maafi chaahi, abhi system mein problem baa. Thoda der baad try kara!",
          follow_up_questions: ["Python seekhe ke?", "Code help?", "Aur kuch?"]
        },
        bengali: {
          query_response: "Sorry, abhi technical problem ache. Ektu pore try koro!",
          follow_up_questions: ["Python shikhbe?", "Code help?", "Aro kichhu?"]
        },
        english: {
          query_response: "Sorry, having technical issues. Please try again later!",
          follow_up_questions: ["Python basics?", "Code help?", "Other questions?"]
        }
      };
      
      return res.json({ 
        ...fallbackResponses[detectedLang], 
        audio: null,
        detected_language: detectedLang 
      });
    }

    // Parse JSON response
    let cleanText = rawText.replace(/```json|```/g, '').trim();
    let aiResponse;
    
    try {
      aiResponse = JSON.parse(cleanText);
    } catch {
      // Fallback response
      const responses = {
        hindi: "Main Python sikhane mein help kar sakta hoon! Kya chahiye?",
        bhojpuri: "Ham Python sikhawe mein help kar sakila! Ka chaahi?",
        bengali: "Ami Python shekhanote help korte pari! Ki lagbe?",
        english: "I can help you learn Python! What do you need?"
      };
      
      aiResponse = {
        query_response: responses[detectedLang] || responses.english,
        follow_up_questions: ["Try again?", "Different question?", "Need help?"]
      };
    }

    // Generate audio
    const audioBase64 = await ttsElevenLabs(aiResponse.query_response);
    
    res.json({ 
      ...aiResponse, 
      audio: audioBase64,
      detected_language: detectedLang 
    });
    
  } catch (err) {
    console.error("Error generating AI:", err);
    res.status(500).json({ error: 'Failed', audio: null });
  }
});

export default router;