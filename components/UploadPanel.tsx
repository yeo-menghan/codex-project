import { FormEvent, useRef, useState } from "react";
import type { Paper, PaperPersonality } from "../types/paper";

interface UploadPanelProps {
  onPaperCreated: (paper: Paper) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default function UploadPanel({ onPaperCreated }: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [personality, setPersonality] = useState<PaperPersonality | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setFile(null);
    setPersonality("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    if (personality) {
      formData.append("personality", personality);
    }

    try {
      const response = await fetch(`${API_BASE}/papers/upload`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Upload failed (${response.status})`);
      }

      const created = (await response.json()) as Paper;
      onPaperCreated(created);
      setSuccess(`Created profile: ${created.title}`);
      resetForm();
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Failed to upload paper";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className={`uploadPanel ${open ? "open" : ""}`}>
      <button type="button" className="uploadToggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? "Close Upload" : "Upload Paper"}
      </button>

      {open ? (
        <form className="uploadForm" onSubmit={onSubmit}>
          <h3>New Paper Profile</h3>
          <p>Upload `.pdf`, `.txt`, or `.md`. The backend will summarize and create a new slide.</p>

          <label className="uploadLabel">
            Paper file
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,text/plain,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={loading}
              required
            />
          </label>

          <label className="uploadLabel">
            Personality (optional)
            <select
              value={personality}
              onChange={(event) => setPersonality(event.target.value as PaperPersonality | "")}
              disabled={loading}
            >
              <option value="">Auto</option>
              <option value="confident">Confident</option>
              <option value="calm">Calm</option>
              <option value="playful">Playful</option>
            </select>
          </label>

          <button type="submit" disabled={!file || loading}>
            {loading ? "Generating..." : "Generate Profile"}
          </button>

          {error ? <p className="uploadError">{error}</p> : null}
          {success ? <p className="uploadSuccess">{success}</p> : null}
        </form>
      ) : null}
    </aside>
  );
}
