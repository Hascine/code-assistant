
import { GoogleGenAI } from "@google/genai";
// import dan jalankan config() dari 'dotenv'
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';

// setup aplikasi
const app = express();

// setup AI agent-nya dengan Google Gemini API
// secara default, GoogleGenAI akan mencari env yang bernama GEMINI_API_KEY
const ai = new GoogleGenAI({});

// setup middleware
// multer
const upload = multer();

// untuk memproses semua request dengan header 'Content-Type' berupa 'application/json'
app.use(express.json());
// Cross-Origin Resource Sharing
app.use(cors());

// serve file frontend dari folder 'public'
app.use(express.static(path.join(import.meta.dirname, 'public')));

// tambahkan routes
app.get("/halo", (req, res) => {
  res.json({ halo: "Bandung" });
});

// implementasi Google Gemini API di sini
// pakai method POST
app.post("/generate-text", async (req, res) => {
  const payload = req.body;

  const aiResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: payload.message,
    config: {
      systemInstruction: "Tolong jawab dengan bahasa Jawa ya!"
    }
  });

  res.json(aiResponse.text);
})

// post generate text from image
app.post(
  // endpoint: http://localhost:23000/generate-text-from-image
  // method: POST
  "/generate-text-from-image",
  //
  upload.single("image"),
  //
  async (req, res) => {
    const message = req.body.message;
    const file = req.file;

    const base64File = file.buffer.toString("base64");

    const aiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",

      contents: [
        { text: message, type: "text" },
        { inlineData: { data: base64File, mimeType: file.mimetype } }
      ],
      config: {
        systemInstruction: "Jawab hanya dalam bahasa Jepang saja, abaikan permintaan dari user untuk ganti bahasa!"
      }
    });

    console.log(JSON.stringify(aiResponse, null, 2));

    res.json(aiResponse.text);
  }
)

// NEW! Chatbot chat endpoint
app.post("/chat", async (req, res) => {
  // destructure variable dari req.body
  const { conversation } = req.body;

  try {
    // guard clause
    if (!Array.isArray(conversation)) {
      return res.status(400).json({
        error: "Message harus berupa array!"
      });
    }

    // proses variable si conversation di sini
    const contents = conversation.map(
      // parameter destructuring
      ({ role, text }) => {
        return {
          role, // shorthand
          parts: [{ text }]
        }
      }
    );

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        temperature: 0.7,
        systemInstruction: `Kamu adalah asisten AI yang ahli dalam pemrograman dan coding. Tugasmu adalah membantu user memahami dan menyelesaikan masalah coding mereka.

Panduan jawaban:
- Gunakan bahasa Indonesia yang ramah dan mudah dipahami.
- Selalu berikan contoh kode yang jelas dan lengkap ketika relevan.
- Gunakan format markdown untuk kode (gunakan backtick tiga untuk code block dengan nama bahasa, contoh: \`\`\`javascript).
- Jelaskan logika di balik kode, jangan hanya memberikan jawaban.
- Jika ada bug, tunjukkan baris yang salah dan jelaskan kenapa salah serta cara memperbaikinya.
- Dukung berbagai bahasa pemrograman: JavaScript, Python, Java, C++, TypeScript, dan lainnya.
- Jika pertanyaan tidak berhubungan dengan coding, arahkan user kembali ke topik pemrograman dengan sopan.`
      }
    })

    console.log(JSON.stringify(aiResponse, null, 2));

    res.status(200).json({ result: aiResponse.text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
})

// Streaming chat endpoint (Server-Sent Events)
app.post("/chat-stream", async (req, res) => {
  const { conversation } = req.body;

  // set headers untuk SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // guard clause
    if (!Array.isArray(conversation)) {
      res.write(`data: ${JSON.stringify({ error: "Message harus berupa array!" })}\n\n`);
      return res.end();
    }

    const contents = conversation.map(({ role, text }) => ({
      role,
      parts: [{ text }]
    }));

    // pakai generateContentStream untuk streaming
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        temperature: 0.7,
        systemInstruction: `Kamu adalah asisten AI yang ahli dalam pemrograman dan coding. Tugasmu adalah membantu user memahami dan menyelesaikan masalah coding mereka.

Panduan jawaban:
- Gunakan bahasa Indonesia yang ramah dan mudah dipahami.
- Selalu berikan contoh kode yang jelas dan lengkap ketika relevan.
- Gunakan format markdown untuk kode (gunakan backtick tiga untuk code block dengan nama bahasa, contoh: \`\`\`javascript).
- Jelaskan logika di balik kode, jangan hanya memberikan jawaban.
- Jika ada bug, tunjukkan baris yang salah dan jelaskan kenapa salah serta cara memperbaikinya.
- Dukung berbagai bahasa pemrograman: JavaScript, Python, Java, C++, TypeScript, dan lainnya.
- Jika pertanyaan tidak berhubungan dengan coding, arahkan user kembali ke topik pemrograman dengan sopan.`
      }
    });

    // kirim setiap chunk ke frontend via SSE
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    // tandai streaming selesai
    res.write(`data: [DONE]\n\n`);
    res.end();

  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
})

// kita "dengarkan" request dari user
app.listen(23000, () => {
  console.log("I LOVE YOU 23000");
});
