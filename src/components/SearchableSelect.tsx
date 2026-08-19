import React, { useState, useEffect, useRef, useMemo } from "react";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Cari / pilih...",
  emptyMessage = "Data tidak ditemukan",
  disabled = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync input pencarian dengan nilai terdaftar
  useEffect(() => {
    const selectedOpt = options.find((opt) => opt.value === value);
    if (selectedOpt) {
      setSearchTerm(selectedOpt.label);
    } else {
      setSearchTerm(value || "");
    }
  }, [value, options]);

  // Tutup dropdown jika klik di luar elemen
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const selectedOpt = options.find((opt) => opt.value === value);
        setSearchTerm(selectedOpt ? selectedOpt.label : value || "");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

  // Filter daftar berdasarkan input pencarian
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  const handleSelectOption = (optValue: string, optLabel: string) => {
    onChange(optValue);
    setSearchTerm(optLabel);
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onChange("");
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full text-sm border border-slate-300 p-2.5 pr-8 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white transition disabled:bg-slate-100 disabled:cursor-not-allowed"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
          ▼
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center">{emptyMessage}</div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectOption(opt.value, opt.label)}
                className={`p-2.5 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-900 border-b border-slate-50 last:border-none flex justify-between items-center transition ${
                  value === opt.value ? "bg-teal-50 font-bold text-teal-800" : "text-slate-700"
                }`}
              >
                <span>{opt.label}</span>
                {opt.sublabel && (
                  <span className="text-xs text-slate-400 font-normal ml-2">
                    ({opt.sublabel})
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;