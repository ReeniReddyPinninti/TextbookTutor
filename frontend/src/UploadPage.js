import React, { useState } from "react";
import axios from "axios";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");

  const uploadPDF = async () => {
    const formData = new FormData();
    formData.append("file", file);
    await axios.post("http://localhost:8000/upload-pdf", formData);
    setUploadStatus("✅ Upload successful!");
  };

  return (
    <>
      <h2>Upload PDF</h2>
      <input type="file" onChange={e => setFile(e.target.files[0])} />
      <button onClick={uploadPDF}>Upload</button>
      <p>{uploadStatus}</p>
    </>
  );
}
