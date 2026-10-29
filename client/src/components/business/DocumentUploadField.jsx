import { useEffect, useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { DOCUMENT_ACCEPT, formatFileSize } from '../../lib/businessDocuments';

// One labelled upload slot: file picker, image preview or filename, remove button, error text.
export default function DocumentUploadField({ id, label, file, error, onChange, onRemove }) {
  const inputRef = useRef(null);
  const [objectUrl, setObjectUrl] = useState(null);
  const isImage = !!file && file.type.startsWith('image/');
  const previewUrl = isImage ? objectUrl : null;

  useEffect(() => {
    if (!isImage) return undefined;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  const handlePick = (e) => {
    const picked = e.target.files?.[0] || null;
    // Reset so choosing the same file again after removing it still fires onChange
    e.target.value = '';
    onChange(picked);
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </label>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={DOCUMENT_ACCEPT}
        onChange={handlePick}
        className="sr-only"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />

      {file ? (
        <div className={`mt-1 flex items-center gap-3 p-2.5 border rounded-xl bg-gray-50 ${error ? 'border-red-300' : 'border-gray-200'}`}>
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            aria-label={`Remove ${label}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`mt-1 w-full flex items-center justify-center gap-2 px-3 py-3 border border-dashed rounded-xl text-sm transition-colors ${
            error
              ? 'border-red-300 text-red-600 bg-red-50/40'
              : 'border-gray-300 text-gray-500 hover:border-primary-400 hover:text-primary-600'
          }`}
        >
          <Upload className="w-4 h-4" />
          Choose file (PDF, JPG or PNG, max 5 MB)
        </button>
      )}

      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
