import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

export default function GeneratePage() {
  const { type } = useParams(); // "qa" or "mcq"
  const [pdfs, setPdfs] = useState([]);
  const [selected, setSelected] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [qaScores, setQaScores] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:8000/list-pdfs").then(res => {
      setPdfs(res.data.pdfs);
    });
  }, []);

  const generate = async () => {
    const count = prompt("How many questions?");
    const res = await axios.get(`http://localhost:8000/generate-questions`, {
      params: { n: count, qtype: type, filename: selected }
    });
    setQuestions(res.data);
    setSubmitted(false);
    setAnswers({});
    setQaScores([]);
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const qaItems = questions
      .filter(q => q.type === "qa")
      .map((q, i) => ({
        question: q.question,
        context: q.context,
        user_answer: answers[i] || ""
      }));

    const res = await axios.post("http://localhost:8000/evaluate-qa", qaItems);
    setQaScores(res.data.results);
  };

  // MCQ scoring uses q.index now
  const mcqScore = questions.filter(q => q.type === "mcq" && answers[q.index] === q.answer).length;
  const totalMcq = questions.filter(q => q.type === "mcq").length;

  return (
    <>
      <h2>Generate {type.toUpperCase()}</h2>
      <select onChange={(e) => setSelected(e.target.value)} value={selected}>
        <option value="">Select PDF</option>
        {pdfs.map(pdf => (
          <option key={pdf} value={pdf}>{pdf}</option>
        ))}
      </select>
      <button onClick={generate} disabled={!selected}>Generate</button>

      {questions.map((q, i) => (
        <div key={q.type === "mcq" ? q.index : i}>
          <p><strong>Q{i + 1}:</strong> {q.question}</p>

          {q.type === "mcq" ? (
            q.options.map((opt, j) => (
              <label key={j}>
                <input
                  type="radio"
                  name={`q${q.index}`}       // use q.index here for grouping options
                  value={opt}
                  checked={answers[q.index] === opt}
                  onChange={(e) => setAnswers({ ...answers, [q.index]: e.target.value })}
                  disabled={submitted}
                /> {opt}
              </label>
            ))
          ) : (
            <textarea
              rows="3"
              cols="60"
              disabled={submitted}
              value={answers[i] || ""}
              onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
            />
          )}

          {submitted && q.type === "mcq" && (
            <p>{answers[q.index] === q.answer ? "✅" : "❌"} Correct: {q.answer}</p>
          )}
          {submitted && q.type === "qa" && (
            <p>Score: {qaScores.find(s => s.question === q.question)?.score || "Pending"}/10</p>
          )}
        </div>
      ))}

      {questions.length > 0 && !submitted && (
        <button onClick={handleSubmit}>Submit</button>
      )}
      {submitted && totalMcq > 0 && (
        <p>MCQ Score: {mcqScore} / {totalMcq}</p>
      )}
    </>
  );
}
