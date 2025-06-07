import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // "success" or "error"
  const navigate = useNavigate();

  const register = async () => {
    try {
      await axios.post("http://localhost:5001/register", { username, email, password });
      setMessage("Registration successful! Redirecting to login...");
      setMessageType("success");
      setTimeout(() => {
        setMessage("");
        navigate("/login");
      }, 2000);
    } catch (err) {
      setMessage("Registration failed. Please try again.");
      setMessageType("error");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  return (
    <>
      {message && (
        <div style={{
          position: "fixed",
          top: 20,
          right: 20,
          padding: "12px 20px",
          backgroundColor: messageType === "success" ? "#2ecc71" : "#e74c3c",
          color: "#fff",
          borderRadius: 6,
          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
          zIndex: 1000
        }}>
          {message}
        </div>
      )}

      <div style={containerStyle}>
        <h2 style={headingStyle}>Register</h2>
        <input
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />
        <button onClick={register} style={buttonStyle}>Register</button>
      </div>
    </>
  );
}

export default Register;

// Styles
const containerStyle = {
  maxWidth: 400,
  margin: "40px auto",
  padding: 24,
  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
  borderRadius: 8,
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  backgroundColor: "#fff",
};

const headingStyle = {
  textAlign: "center",
  marginBottom: 24,
  color: "#2c3e50",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  marginBottom: 16,
  borderRadius: 4,
  border: "1.5px solid #bdc3c7",
  fontSize: 16,
  boxSizing: "border-box",
  outlineColor: "#3498db",
  transition: "border-color 0.3s ease",
};

const buttonStyle = {
  width: "100%",
  padding: "12px",
  backgroundColor: "#3498db",
  color: "#fff",
  fontWeight: "600",
  fontSize: 16,
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  transition: "background-color 0.3s ease",
};
