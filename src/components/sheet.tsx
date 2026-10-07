"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="sheet-title"
    >
      <div className="sheet-grip" />
      <header className="sheet-header">
        <h2 id="sheet-title">{title}</h2>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <X size={22} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
