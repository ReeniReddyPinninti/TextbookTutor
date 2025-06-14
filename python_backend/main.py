from fastapi import FastAPI, UploadFile, File, Query, Form
from pydantic import BaseModel
from typing import List, Dict
import fitz  # PyMuPDF
import os
import faiss
import numpy as np
import subprocess
from sentence_transformers import SentenceTransformer
from fastapi.middleware.cors import CORSMiddleware
import pyttsx3
import uuid
from vosk import Model, KaldiRecognizer
import wave
import json
from fastapi.responses import FileResponse
import subprocess
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["rag_app"]
pdf_collection = db["pdfs"]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = SentenceTransformer("all-MiniLM-L6-v2")
pdf_store: Dict[str, Dict] = {}  # {filename: {"chunks": [...], "index": faiss.Index}}

class QAItem(BaseModel):
    question: str
    context: str
    user_answer: str

class FAQRequest(BaseModel):
    filename: str
    question: str

def query_llm(prompt):
    result = subprocess.run(["ollama", "run", "mistral", prompt], capture_output=True, text=True)
    return result.stdout.strip()

def pdf_to_chunks(file_path, chunk_size=500):
    doc = fitz.open(file_path)
    text = " ".join(page.get_text() for page in doc)
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

# Initialize Vosk model once globally
vosk_model = Model("/Users/reenipinninti/Documents/TextbookTutor/python_backend/vosk-model-small-en-us-0.15")

def text_to_speech(text: str, filename_prefix="tts_output"):
    engine = pyttsx3.init()
    filename = f"tmp/{filename_prefix}_{uuid.uuid4().hex}.mp3"
    os.makedirs("tmp", exist_ok=True)
    engine.save_to_file(text, filename)
    engine.runAndWait()
    return filename

def speech_to_text(audio_file_path):
    wf = wave.open(audio_file_path, "rb")
    rec = KaldiRecognizer(vosk_model, wf.getframerate())

    results = []
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            res = json.loads(rec.Result())
            results.append(res.get("text", ""))
    res = json.loads(rec.FinalResult())
    results.append(res.get("text", ""))
    return " ".join(results).strip()

def ensure_pdf_loaded(filename, email):
    if filename in pdf_store:
        return True

    doc = pdf_collection.find_one({"filename": filename, "email": email})
    if not doc:
        return False

    chunks = doc["chunks"]
    embeddings = model.encode(chunks)
    dim = embeddings[0].shape[0]
    index = faiss.IndexFlatL2(dim)
    index.add(np.array(embeddings))

    pdf_store[filename] = {
        "chunks": chunks,
        "index": index,
        "embeddings": embeddings
    }
    return True

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), email: str = Form(...)):
    contents = await file.read()
    path = f"tmp/{file.filename}"
    os.makedirs("tmp", exist_ok=True)

    with open(path, "wb") as f:
        f.write(contents)

    chunks = pdf_to_chunks(path)
    embeddings = model.encode(chunks)
    dim = embeddings[0].shape[0]
    index = faiss.IndexFlatL2(dim)
    index.add(np.array(embeddings))

    # Always store in memory (for session use)
    pdf_store[file.filename] = {
        "chunks": chunks,
        "index": index,
        "embeddings": embeddings
    }

    # Only save to MongoDB if it's a logged-in user
    if email != "guest":
        pdf_collection.replace_one(
            {"filename": file.filename, "email": email},
            {"filename": file.filename, "email": email, "chunks": chunks},
            upsert=True
        )

    return {"filename": file.filename, "chunks": len(chunks)}

@app.get("/list-pdfs")
def list_pdfs(email: str = Query(None)):
    if not email or email == "guest":
        return {"pdfs": []}
    user_pdfs = list(pdf_collection.find({"email": email}, {"_id": 0, "filename": 1}))
    return {"pdfs": [item["filename"] for item in user_pdfs]}

@app.get("/generate-questions")
def generate_questions(n: int, qtype: str, filename: str = Query(...)):
    if filename not in pdf_store:
        return {"error": "PDF not found."}

    chunks = pdf_store[filename]["chunks"]
    selected_chunks = chunks[:n]
    questions = []

    for chunk in selected_chunks:
        if qtype == "mcq":
            prompt = (
                f"Based on the following text, generate ONE multiple choice question with only ONE correct answer (no 'Select all that apply').\n"
                f"Text:\n\"{chunk}\"\n\n"
                f"Format your response exactly like this:\n"
                f"Question: <your question here>\n"
                f"A. <option A>\n"
                f"B. <option B>\n"
                f"C. <option C>\n"
                f"D. <option D>\n"
                f"Answer: <A/B/C/D>\n"
            )
            response = query_llm(prompt)
            import re
            q_match = re.search(r"Question:\s*(.+)", response)
            a_match = re.findall(r"[A-D]\.\s*(.+)", response)
            ans_match = re.search(r"Answer:\s*([A-D])", response)

            if q_match and len(a_match) == 4 and ans_match:
                answer_index = ord(ans_match.group(1)) - 65
                questions.append({
                    "type": "mcq",
                    "question": q_match.group(1),
                    "options": a_match,
                    "answer": a_match[answer_index]
                })
            else:
                questions.append({
                    "type": "mcq",
                    "question": "Invalid LLM response",
                    "options": ["N/A", "N/A", "N/A", "N/A"],
                    "answer": "N/A"
                })

        else:
            prompt = f"Generate a thought-provoking question from this content:\n\n{chunk}\n\nOutput only the question."
            question = query_llm(prompt)
            questions.append({
                "type": "qa",
                "question": question,
                "context": chunk,
                "answer": ""  
            })

    return questions

@app.post("/evaluate-qa")
def evaluate_qa(qa_list: List[QAItem]):
    results = []
    for item in qa_list:
        prompt = (
            f"You are a teacher evaluating a student's answer.\n"
            f"Question: {item.question}\n"
            f"Context: \"{item.context}\"\n"
            f"Student's Answer: \"{item.user_answer}\"\n\n"
            f"Give a score between 1 and 10 based on accuracy and depth. Return only the score."
        )
        score = query_llm(prompt)
        results.append({"question": item.question, "score": score})
    return {"results": results}

@app.post("/ask-faq")
def ask_faq(data: FAQRequest):
    if data.filename not in pdf_store:
        return {"answer": "PDF not found"}

    chunks = pdf_store[data.filename]["chunks"]
    embeddings = model.encode([data.question])
    D, I = pdf_store[data.filename]["index"].search(np.array(embeddings), 1)
    context = chunks[I[0][0]]

    prompt = f"Context: {context}\n\nQuestion: {data.question}\nAnswer:"
    answer = query_llm(prompt)
    return {"answer": answer}

@app.get("/tts")
def tts(text: str):
    audio_file = text_to_speech(text)
    return FileResponse(audio_file, media_type="audio/mpeg")

@app.post("/stt")
async def stt(file: UploadFile = File(...), filename: str = Query(...)):
    os.makedirs("tmp", exist_ok=True)
    webm_path = f"tmp/{file.filename}"
    wav_path = f"tmp/{uuid.uuid4().hex}.wav"

    contents = await file.read()
    with open(webm_path, "wb") as f:
        f.write(contents)

    subprocess.run([
        "ffmpeg", "-i", webm_path,
        "-ar", "16000", "-ac", "1",
        wav_path
    ], check=True)

    question = speech_to_text(wav_path)

    if filename not in pdf_store:
        return {"error": "PDF not found", "question": question, "answer": ""}

    chunks = pdf_store[filename]["chunks"]
    embeddings = model.encode([question])
    D, I = pdf_store[filename]["index"].search(np.array(embeddings), 1)
    context = chunks[I[0][0]]

    prompt = f"Context: {context}\n\nQuestion: {question}\nAnswer:"
    answer = query_llm(prompt)

    return {
        "question": question,
        "answer": answer
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)