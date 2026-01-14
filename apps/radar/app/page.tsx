'use client'
import {  useState } from 'react';

export default function Home() {
  // const res = await fetch('http://127.0.0.1:4000/api/test').then((s) => s.json());
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const startStreaming = async () => {
    setLoading(true);
    try {
      const resp = await fetch('http://127.0.0.1:4000/api/chat');
      if (!resp.body) return;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;
        const chunk = decoder.decode(value);

        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(6).trim();
            if (data === 'end') {
              break;
            }
            setResult((prev) => prev + data + " ");
          }
        }
      }
    } catch {

    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button 
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        onClick={startStreaming} disabled={loading}>jhhads</button>
      <span>{result}</span>
    </div>
  );
}
