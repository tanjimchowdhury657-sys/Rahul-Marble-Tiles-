import express from 'express';
import multer from 'multer';
import OpenAI, { toFile } from 'openai';
import 'dotenv/config';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 2 } });
const port = process.env.PORT || 3000;
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
app.use(express.static('.'));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/generate', upload.fields([{ name: 'tileImage', maxCount: 1 }, { name: 'roomImage', maxCount: 1 }]), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI API key সেট করা নেই। সার্ভারে OPENAI_API_KEY যোগ করতে হবে।' });
    const tile = req.files?.tileImage?.[0];
    const room = req.files?.roomImage?.[0];
    if (!tile || !room) return res.status(400).json({ error: 'টাইলস ও রুম—দুটি ছবিই আপলোড করুন।' });
    const roomType = String(req.body.roomType || 'living room').slice(0, 80);
    const surface = String(req.body.surface || 'wall').slice(0, 100);
    const finish = String(req.body.finish || 'photorealistic interior').slice(0, 150);
    const extra = String(req.body.extra || '').slice(0, 600);
    const prompt = `Create a highly photorealistic interior-design edit using the TWO input images. IMAGE 1 is the exact tile/marble/granite product reference. IMAGE 2 is the customer's actual room and must remain the same room. Edit only the ${surface} in this ${roomType} to install the product shown in IMAGE 1. Preserve the exact tile's color, veining, pattern, gloss, and material as closely as possible; repeat it naturally at realistic scale with believable grout lines, perspective, shadows, reflections and existing room lighting. Keep the room layout, doors, windows, furniture and camera viewpoint unchanged. Do not create a collage or side-by-side comparison. Output one polished, realistic finished photograph, no text, no labels, no watermark. Style: ${finish}. Additional instructions: ${extra || 'No extra instructions.'}`;
    const tileFile = await toFile(tile.buffer, tile.originalname || 'tile.png', { type: tile.mimetype || 'image/png' });
    const roomFile = await toFile(room.buffer, room.originalname || 'room.png', { type: room.mimetype || 'image/png' });
    const result = await client.images.edit({ model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', image: [roomFile, tileFile], prompt, size: '1024x1024', quality: 'high' });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error('AI image response was empty.');
    res.json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error('AI image generation error:', err?.message || err);
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
    res.status(status).json({ error: status === 401 ? 'API key সঠিক নয়। সার্ভারের API key পরীক্ষা করুন।' : status === 429 ? 'AI ব্যবহারের সীমা বা ব্যালেন্স শেষ হয়েছে। API billing পরীক্ষা করুন।' : `AI ডিজাইন তৈরি করা যায়নি: ${err?.message || 'অজানা সমস্যা'}` });
  }
});
app.listen(port, () => console.log(`Rahul AI Tiles app running at http://localhost:${port}`));
