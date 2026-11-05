import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { assistantUiText, getWebsiteAssistantAnswer, type AssistantLanguage } from "@/lib/website-assistant";

type Message = { id: number; role: "user" | "assistant"; text: string };
const languages: { value: AssistantLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "\u0939\u093f\u0928\u094d\u0926\u0940" },
  { value: "kn", label: "\u0c95\u0ca8\u0ccd\u0ca8\u0ca1" },
];

const sampleQuestions: Record<AssistantLanguage, string[]> = {
  en: ["How do I place an order?", "How do event tokens work?", "How can I register my canteen?", "How do I track my order?", "How can I contact support?"],
  hi: ["How do I place an order?", "How do event tokens work?", "How can I register my canteen?", "How do I track my order?", "How can I contact support?"],
  kn: ["How do I place an order?", "How do event tokens work?", "How can I register my canteen?", "How do I track my order?", "How can I contact support?"],
};

export function WebsiteHelpChat() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<AssistantLanguage>("en");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const nextId = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const text = assistantUiText[language];

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  function chooseLanguage(value: AssistantLanguage) {
    setLanguage(value);
    if (messages.length === 0) setMessages([{ id: nextId.current++, role: "assistant", text: assistantUiText[value].greeting }]);
  }

  function ask(value: string) {
    const cleanQuestion = value.trim();
    if (!cleanQuestion) return;
    const id = nextId.current++;
    setMessages((current) => [
      ...current,
      { id, role: "user", text: cleanQuestion },
      { id: id + 1, role: "assistant", text: getWebsiteAssistantAnswer(cleanQuestion, language) },
    ]);
    nextId.current += 1;
    setQuestion("");
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }

  return <div className="fixed bottom-5 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
    {open && <section id="website-help-chat" role="dialog" aria-label={text.title} aria-modal="false" className="flex max-h-[min(34rem,calc(100dvh-7rem))] w-[min(25rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-2xl shadow-black/40">
      <header className="flex items-start justify-between gap-3 border-b border-border bg-ink-soft/80 p-4">
        <div><h2 className="display text-lg text-foreground">{text.title}</h2><p className="mt-1 text-xs text-muted-foreground">{text.subtitle}</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label={text.close} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </header>
      <div className="border-b border-border px-4 py-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{text.language}</p>
        <div className="flex gap-2" role="group" aria-label={text.language}>
          {languages.map((item) => <button key={item.value} type="button" aria-pressed={language === item.value} onClick={() => chooseLanguage(item.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${language === item.value ? "border-primary bg-primary/10 text-primary-bright" : "border-border text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}
        </div>
      </div>
      <div className="min-h-32 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 && <p className="max-w-[90%] rounded-2xl rounded-tl-sm bg-ink-soft p-3 text-sm leading-relaxed text-foreground">{text.greeting}</p>}
        {messages.map((message) => <p key={message.id} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl p-3 text-sm leading-relaxed ${message.role === "user" ? "ml-auto rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-ink-soft text-foreground"}`}>{message.text}</p>)}
        {!messages.some((message) => message.role === "user") && <div className="flex flex-wrap gap-2" aria-label="Sample questions">{sampleQuestions[language].map((sample) => <button key={sample} type="button" onClick={() => ask(sample)} className="rounded-2xl border border-primary/30 bg-background px-3 py-2 text-left text-xs leading-snug text-foreground transition hover:border-primary hover:bg-primary/5">{sample}</button>)}</div>}
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
        <input ref={input} value={question} onChange={(event) => setQuestion(event.currentTarget.value)} aria-label={text.placeholder} placeholder={text.placeholder} maxLength={500} className="min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25" />
        <button type="submit" disabled={!question.trim()} aria-label={text.send} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /><span className="sr-only">{text.send}</span></button>
      </form>
    </section>}
    <button type="button" aria-expanded={open} aria-controls="website-help-chat" onClick={() => setOpen((current) => !current)} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-primary/40 bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[0_10px_35px_-12px_hsl(var(--primary))] transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
      {open ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}{open ? text.close : text.open}
    </button>
  </div>;
}
