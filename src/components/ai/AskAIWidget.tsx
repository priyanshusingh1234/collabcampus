import { useState, useRef } from 'react';
import { MessageCircle, Image as ImageIcon, X } from 'lucide-react';

export default function AskAIWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleAsk() {
    if (!input.trim()) return;
    setLoading(true);
    setResponse('');
    try {
      const res = await fetch('/api/ai-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imageUrl ? { question: input, imageUrl } : { question: input }),
      });
      const data = await res.json();
      setResponse(data.answer || data.error || 'No answer.');
      // After we receive the response, delete the temp image if present
      if (imageFileId) {
        try {
          await fetch('/api/imagekit/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: imageFileId }),
          });
        } catch {
          // ignore cleanup errors
        } finally {
          setImageUrl(null);
          setImageFileId(null);
        }
      }
    } catch (e) {
      setResponse('Error contacting AI.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('fileName', file.name || `askai-${Date.now()}`);
  form.append('folder', 'temp');
      const res = await fetch('/api/imagekit/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (data?.url) setImageUrl(data.url);
  if (data?.fileId) setImageFileId(data.fileId as string);
    } catch (e) {
      // swallow
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <>
      <button
        onClick={async () => {
          // if closing and temp image exists, cleanup
          if (open && imageFileId) {
            try {
              await fetch('/api/imagekit/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: imageFileId }),
              });
            } catch {}
            setImageUrl(null);
            setImageFileId(null);
          }
          setOpen((v) => !v);
        }}
        className="fixed z-50 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center focus:outline-none right-4 sm:right-6 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-6 h-12 w-12 sm:h-14 sm:w-14"
        aria-label="Ask AI"
      >
        <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" />
      </button>
      {open && (
        <div
          className="fixed z-50 w-[calc(100vw-2rem)] max-w-[24rem] sm:w-96 max-h-[80vh] overflow-auto bg-white dark:bg-gray-900 rounded-xl shadow-2xl border p-4 flex flex-col gap-3 animate-fade-in right-4 sm:right-6 bottom-[calc(env(safe-area-inset-bottom)+10rem)] sm:bottom-20"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-lg">Ask AI</span>
            <button onClick={async () => {
              if (imageFileId) {
                try {
                  await fetch('/api/imagekit/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileId: imageFileId }),
                  });
                } catch {}
                setImageUrl(null);
                setImageFileId(null);
              }
              setOpen(false);
            }} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">✕</button>
          </div>
          {imageUrl && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="attachment" className="rounded border max-h-40 w-full object-cover" />
              <button
                className="absolute -top-2 -right-2 bg-black/70 text-white rounded-full p-1"
                onClick={async () => {
                  const fid = imageFileId;
                  setImageUrl(null);
                  setImageFileId(null);
                  if (fid) {
                    try {
                      await fetch('/api/imagekit/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileId: fid }),
                      });
                    } catch {
                      // ignore cleanup errors
                    }
                  }
                }}
                aria-label="Remove image"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <textarea
            className="w-full border rounded p-2 text-sm resize-none min-h-[60px]"
            placeholder="Describe your problem..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border hover:bg-muted"
              disabled={uploading || loading}
            >
              <ImageIcon size={14} /> {uploading ? 'Uploading…' : 'Attach image'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImagePick} />
          </div>
          <button
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-60"
            onClick={handleAsk}
            disabled={loading || !input.trim()}
          >
            {loading ? 'Asking...' : 'Ask'}
          </button>
          {response && (
            <div className="bg-indigo-50 dark:bg-gray-800 rounded p-2 text-sm mt-2 whitespace-pre-line break-words max-h-[50vh] overflow-auto">
              {response}
            </div>
          )}
        </div>
      )}
    </>
  );
}
