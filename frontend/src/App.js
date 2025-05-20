import React, { useState } from "react";
import axios from "axios";

function App() {
  const [file, setFile] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [qaScores, setQaScores] = useState([]);

  const uploadPDF = async () => {
    const formData = new FormData();
    formData.append("file", file);
    await axios.post("http://localhost:8000/upload-pdf", formData);
  };

  const generate = async (type) => {
    const res = await axios.get(`http://localhost:8000/generate-questions?n=5&qtype=${type}`);
    setQuestions(res.data);
    setSubmitted(false);
    setAnswers({});
    setQaScores([]);
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

  const mcqScore = questions.reduce((acc, q, i) => {
    if (q.type === "mcq" && answers[i] === q.answer) return acc + 1;
    return acc;
  }, 0);

  const totalMcq = questions.filter(q => q.type === "mcq").length;

  return (
    <div style={{ padding: 20 }}>
      <h1>Textbook Quiz App</h1>
      <input type="file" onChange={e => setFile(e.target.files[0])} />
      <button onClick={uploadPDF}>Upload</button>
      <button onClick={() => generate("mcq")}>Generate MCQs</button>
      <button onClick={() => generate("qa")}>Generate Q&A</button>

      <hr />
      {questions.map((q, i) => (
        <div key={i}>
          <p><strong>Q{i + 1}:</strong> {q.question}</p>
          {q.type === "mcq" ? (
            q.options.map((opt, j) => (
              <label key={j}>
                <input
                  type="radio"
                  name={`q${i}`}
                  value={opt}
                  disabled={submitted}
                  onChange={(e) => handleChange(i, e.target.value)}
                />{" "}
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
            />
          )}
          <br />
          {submitted && q.type === "mcq" && (
            <p>
              {answers[i] === q.answer ? "✅" : "❌"} Correct answer: {q.answer}
            </p>
          )}
          {submitted && q.type === "qa" && (
            <p>Score: {qaScores.find(s => s.question === q.question)?.score || "Pending"}/10</p>
          )}
        </div>
      ))}
      {questions.length > 0 && !submitted && (
        <button onClick={handleSubmit}>Submit Answers</button>
      )}
      {submitted && totalMcq > 0 && (
  <div>
    <h3>MCQ Score: {mcqScore} / {totalMcq}</h3>
  </div>
)}

{submitted && qaScores.length > 0 && (
  <div>
    <h3>Total Score: {
      (
        qaScores.reduce((acc, q) => acc + parseFloat(q.score || 0), 0) 
        / qaScores.length
      ).toFixed(1)
    } / 10</h3>
  </div>
)}

    </div>
  );
}

export default App;
