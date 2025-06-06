import React, { useState, useEffect } from "react";
import axios from "axios";

export default function FAQPage() {
  const [pdfs, setPdfs] = useState([]);
  const [selected, setSelected] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    axios.get("http://localhost:8000/list-pdfs").then(res => {
      setPdfs(res.data.pdfs);
    });
  }, []);

  const askFAQ = async () => {
    const res = await axios.post("http://localhost:8000/ask-faq", {
      filename: selected,
      question
    });
    setAnswer(res.data.answer);
  };

  return (
    <>
      <h2>Ask FAQ</h2>
      <select onChange={(e) => setSelected(e.target.value)}>
        <option value="">Select PDF</option>
        {pdfs.map(pdf => (
          <option key={pdf} value={pdf}>{pdf}</option>
        ))}
      </select>
      <br />
      <textarea rows="3" cols="60" onChange={(e) => setQuestion(e.target.value)} />
      <br />
      <button onClick={askFAQ}>Ask</button>
      <p><strong>Answer:</strong> {answer}</p>
    </>
  );
}
