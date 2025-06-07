import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./Login";
import Register from "./Register";
import RAGMain from "./RAGMain";
import Navbar from "./Navbar";

function App() {
  const [username, setUsername] = useState(null);

  useEffect(() => {
    // On app load, check if username is in localStorage
    const user = localStorage.getItem("username");
    if (user) setUsername(user);
  }, []);

  return (
    <Router>
      <Navbar username={username} setUsername={setUsername} />
      <Routes>
        <Route path="/" element={<RAGMain />} />
        <Route path="/login" element={<Login setUsername={setUsername} />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}

export default App;
