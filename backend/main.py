from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from typing import List
import fitz  # PyMuPDF
import os
import faiss
import numpy as np
import subprocess
from sentence_transformers import SentenceTransformer

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = SentenceTransformer("all-MiniLM-L6-v2")
index = None
chunks_store = []

class QAItem(BaseModel):
    question: str
    context: str
    user_answer: str

def query_llm(prompt):
    result = subprocess.run(["ollama", "run", "mistral", prompt], capture_output=True, text=True)
    return result.stdout.strip()

def pdf_to_chunks(file_path, chunk_size=500):
    doc = fitz.open(file_path)
    text = " ".join(page.get_text() for page in doc)
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    global index, chunks_store
    contents = await file.read()
    path = f"tmp/{file.filename}"
    os.makedirs("tmp", exist_ok=True)
    with open(path, "wb") as f:
        f.write(contents)

    chunks_store = pdf_to_chunks(path)
    embeddings = model.encode(chunks_store)
    dim = embeddings[0].shape[0]
    index = faiss.IndexFlatL2(dim)
    index.add(np.array(embeddings))
    return {"chunks": len(chunks_store)}

@app.get("/generate-questions")
def generate_questions(n: int, qtype: str):
    import random
    selected_chunks = chunks_store[:n]
    questions = []

    for i, chunk in enumerate(selected_chunks):
        if qtype == "mcq":
            prompt = (
                f"Based on the following text, generate ONE multiple choice question.\n"
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
            try:
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
                    raise ValueError("LLM output format incorrect")
            except:
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
