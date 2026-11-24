import { Upload } from 'lucide-react';
import React, { useRef } from 'react';
import toast from 'react-hot-toast';
import { CsvParseResult, parseEmailListContent } from '../../utils/csvParser';

interface CSVUploaderButtonProps {
  onParsed: (result: CsvParseResult, fileName: string) => void;
}

export function CSVUploaderButton({ onParsed }: CSVUploaderButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('CSV/TXT file must be smaller than 5 MB.');
      e.target.value = '';
      return;
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.txt')) {
      toast.error('Please upload a .csv or .txt file.');
      e.target.value = '';
      return;
    }

    const text = await file.text();
    const parsed = parseEmailListContent(text);
    onParsed(parsed, file.name);
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        onChange={handleFileChange}
        className="hidden"
        data-testid="csv-file-input"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#00A838] hover:text-[#008F30]"
      >
        <Upload className="h-3.5 w-3.5" />
        Upload List
      </button>
    </>
  );
}
