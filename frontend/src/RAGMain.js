import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

function RAGMain() {
  const [file, setFile] = useState(null);
  const [pdfs, setPdfs] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [qaScores, setQaScores] = useState([]);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [audioUrl, setAudioUrl] = useState(null);
  const username = localStorage.getItem("username");

  useEffect(() => {
    if (!username) return;
    axios.get(`http://localhost:8000/list-pdfs?email=${username}`).then(res => {
      setPdfs(res.data.pdfs);
    });
  }, [username]);  

  const uploadPDF = async () => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", username);
    await axios.post("http://localhost:8000/upload-pdf", formData);
    const res = await axios.get(`http://localhost:8000/list-pdfs?email=${username}`);
    setPdfs(res.data.pdfs);
  };

  const generate = async (type) => {
    if (!selectedPdf) return alert("Select a PDF first.");
    const count = window.prompt("Enter number of questions to generate:", "5");
    if (!count || isNaN(count) || count <= 0) return;

    const res = await axios.get(
      `http://localhost:8000/generate-questions?n=${count}&qtype=${type}&filename=${selectedPdf}`
    );
    setQuestions(res.data);
    setSubmitted(false);
    setAnswers({});
    setQaScores([]);
    setFaqAnswer("");
  };

  const handleRecordClick = async () => {
    if (recording) {
      // Stop recording
      mediaRecorderRef.current.stop();
      setRecording(false);
    } else {
      // Start recording
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        alert("MediaRecorder not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = e => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        transcribeAudio(audioBlob);
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    }
  };

  // New function to send audio blob to backend for STT transcription
  const transcribeAudio = async (audioBlob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
  
    try {
      const res = await axios.post(
        `http://localhost:8000/stt?filename=${selectedPdf}`, // <-- QUERY PARAM!
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );
  
      setFaqQuestion(res.data.question);
      setFaqAnswer(res.data.answer);
    } catch (error) {
      console.error(error);
      alert("Transcription failed.");
    }
  };  

  const playFaqAnswer = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel(); // Stop reading
    } else if (faqAnswer) {
      const utterance = new SpeechSynthesisUtterance(faqAnswer);
      window.speechSynthesis.speak(utterance);
    }
  };  

  const handleChange = (idx, val) => {
    setAnswers({ ...answers, [idx]: val });
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const qas = questions
      .map((q, i) => q.type === "qa" && {
        question: q.question,
        context: q.context,
        user_answer: answers[i] || ""
      })
      .filter(Boolean);

    if (qas.length) {
      const res = await axios.post("http://localhost:8000/evaluate-qa", qas);
      setQaScores(res.data.results);
    }
  };

  const handleFaq = async () => {
    const res = await axios.post("http://localhost:8000/ask-faq", {
      filename: selectedPdf,
      question: faqQuestion
    });
    setFaqAnswer(res.data.answer);
  };

  const mcqScore = questions.reduce((acc, q, i) => (
    q.type === "mcq" && answers[i] === q.answer ? acc + 1 : acc
  ), 0);
  const totalMcq = questions.filter(q => q.type === "mcq").length;

  const resetState = () => {
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setQaScores([]);
    setFaqAnswer("");
    setSelectedPdf("");
    setFaqQuestion("");
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto', // Center the app
    }}>
      <h1 style={{
        textAlign: 'center',
        marginBottom: '20px',
        color: '#333',
      }}>Textbook Tutor</h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr', // Two columns
        gap: '20px',
        marginBottom: '20px',
      }}>
        <div>
          <label htmlFor="file-upload" style={{
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold',
          }}>Upload PDF:</label>
          <input
            id="file-upload"
            type="file"
            onChange={e => setFile(e.target.files[0])}
            style={{ marginBottom: '10px' }}
            aria-label="Upload a PDF file" // Accessibility
          />
          <button
            onClick={uploadPDF}
            style={{
              padding: '10px 15px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              width: '100%',
            }}
          >Upload</button>
        </div>

        <div>
          <label htmlFor="pdf-select" style={{
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold',
          }}>Select PDF:</label>
          <select
            id="pdf-select"
            value={selectedPdf}
            onChange={e => setSelectedPdf(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              appearance: 'none', // Remove default arrow in some browsers
              backgroundColor: 'white',
            }}
            aria-label="Select a PDF from the list" // Accessibility
          >
            <option value="">-- Select --</option>
            {pdfs.map((pdf, i) => (
              <option key={i} value={pdf}>{pdf}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', // Responsive columns
        gap: '10px',
        marginBottom: '20px',
      }}>
        <button
          onClick={() => generate("mcq")}
          style={{
            padding: '10px 15px',
            backgroundColor: '#008CBA',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            width: '100%',
          }}
        >Generate MCQs</button>
        <button
          onClick={() => generate("qa")}
          style={{
            padding: '10px 15px',
            backgroundColor: '#008CBA',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            width: '100%',
          }}
        >Generate Q&A</button>
        <button
          onClick={resetState}
          style={{
            padding: '10px 15px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            width: '100%',
          }}
        >Reset</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
      <input
        type="text"
        id="faq-question"
        placeholder="Ask a question"
        value={faqQuestion}
        onChange={e => setFaqQuestion(e.target.value)}
        style={{
          padding: '10px',
          borderRadius: '5px',
          border: '1px solid #ccc',
          width: '100%',
        }}
        aria-label="Enter your FAQ question"
      />

      <button
        onClick={handleRecordClick}
        style={{
          padding: '10px',
          backgroundColor: recording ? '#f44336' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
        aria-label={recording ? "Stop recording" : "Start recording"}
        title={recording ? "Stop recording" : "Start recording"}
      >
        {recording ? "Stop 🎙️" : "Record 🎙️"}
      </button>

      <button
        onClick={handleFaq}
        style={{
          padding: '10px 15px',
          backgroundColor: '#333',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
        aria-label="Ask FAQ question"
      >
        Ask
      </button>

      {faqAnswer && (
        <button
          onClick={playFaqAnswer}
          style={{
            padding: '10px 15px',
            backgroundColor: '#008CBA',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
          aria-label="Play FAQ answer"
          title="Play answer"
        >
          🔊
        </button>
      )}
    </div>

    {/* NEW visible section to show the transcribed question and its answer */}
    {faqQuestion && faqAnswer && (
      <div style={{
        backgroundColor: '#eef6ff',
        border: '1px solid #90caf9',
        borderRadius: '5px',
        padding: '15px',
        marginBottom: '20px',
      }}>
        <p><strong>Transcribed Question:</strong> {faqQuestion}</p>
        <p><strong>Answer:</strong> {faqAnswer}</p>
      </div>
    )}
{/* 
      {faqAnswer && <p style={{ marginTop: '10px' }}><strong>Answer:</strong> {faqAnswer}</p>} */}

      <hr style={{ margin: '20px 0', border: 'none', borderBottom: '1px solid #eee' }} />

      {questions.map((q, i) => (
        <div key={i} style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #eee',
          borderRadius: '5px',
          backgroundColor: '#f9f9f9',
        }}>
          <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Q{i + 1}: {q.question}</p>
          {q.type === "mcq" ? (
            q.options.map((opt, j) => (
              <label key={j} style={{ display: 'block', marginBottom: '5px' }}>
                <input
                  type="radio"
                  name={`q${i}`}
                  value={opt}
                  disabled={submitted}
                  onChange={(e) => handleChange(i, e.target.value)}
                  aria-label={`Option ${j + 1} for question ${i + 1}`} // Accessibility
                />
                {opt}
              </label>
            ))
          ) : (
            <textarea
              rows={3}
              cols={60}
              placeholder="Your answer"
              disabled={submitted}
              onChange={(e) => handleChange(i, e.target.value)}
              style={{
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ccc',
                width: '100%',
                boxSizing: 'border-box',
                fontFamily: 'Arial, sans-serif',
              }}
              aria-label={`Your answer for question ${i + 1}`} // Accessibility
            />
          )}
          <br />
          {submitted && q.type === "mcq" && (
            <p>
              {answers[i] === q.answer ? "✅" : "❌"} Correct: {q.answer}
            </p>
          )}
          {submitted && q.type === "qa" && (
            <p>Score: {qaScores.find(s => s.question === q.question)?.score || "Pending"}/10</p>
          )}
        </div>
      ))}

      {questions.length > 0 && !submitted && (
        <button
          onClick={handleSubmit}
          style={{
            padding: '10px 15px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            width: '100%',
          }}
        >Submit Answers</button>
      )}

      {submitted && totalMcq > 0 && (
        <div><h3>MCQ Score: {mcqScore} / {totalMcq}</h3></div>
      )}
      {submitted && qaScores.length > 0 && (
        <div><h3>Total QA Score: {(qaScores.reduce((a, q) => a + parseFloat(q.score || 0), 0) / qaScores.length).toFixed(1)} / 10</h3></div>
      )}
    </div>
  );
}

export default RAGMain; 