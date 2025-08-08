'use client'

import { useState } from 'react'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')
  const [parsedRows, setParsedRows] = useState(0)

  const handleUpload = async () => {
    if (!file) {
      console.error("❌ No file selected");
      return;
    }
    console.log("📁 File selected:", file.name);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData, // do NOT manually set Content-Type!
      });
 
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Unknown error");
      }
 
      const result = await res.json();
      console.log("✅ Upload successful:", result);
      setStatus(`✅ Parsed ${result.rows} rows.`);
    } catch (err: any) {
      console.error("❌ Upload failed:", err.message);
      setStatus("❌ Upload failed.");
    }
  };

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Upload Your Product Catalog</h1>

      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          const selected = e.target.files?.[0] ?? null
          console.log('📁 File selected:', selected?.name || 'None')
          setFile(selected)
        }}
        className="mb-4 block"
      />

      <button
        onClick={handleUpload}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Upload & Parse
      </button>

      {status && (
        <p className="mt-4 text-gray-800">
          {status} {parsedRows > 0 && `(Rows: ${parsedRows})`}
        </p>
      )}
    </main>
  )
}
