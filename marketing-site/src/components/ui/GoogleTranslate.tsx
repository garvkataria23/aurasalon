"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement: {
          new (options: Record<string, unknown>, element: string): unknown;
          InlineLayout: { SIMPLE: string };
        };
      };
    };
  }
}

const SCRIPT_ID = "google-translate-script";
const ENGINE_ID = "google_translate_engine";

const LANGUAGES = [
  { code: "en", label: "English", nativeName: "English" },
  { code: "hi", label: "Hindi", nativeName: "हिंदी" },
  { code: "es", label: "Spanish", nativeName: "Español" },
  { code: "fr", label: "French", nativeName: "Français" },
  { code: "de", label: "German", nativeName: "Deutsch" },
  { code: "ar", label: "Arabic", nativeName: "العربية" },
  { code: "bn", label: "Bengali", nativeName: "বাংলা" },
  { code: "zh-CN", label: "Chinese Simplified", nativeName: "简体中文" },
  { code: "zh-TW", label: "Chinese Traditional", nativeName: "繁體中文" },
  { code: "pt", label: "Portuguese", nativeName: "Português" },
  { code: "ru", label: "Russian", nativeName: "Русский" },
  { code: "ja", label: "Japanese", nativeName: "日本語" },
  { code: "ko", label: "Korean", nativeName: "한국어" },
  { code: "id", label: "Indonesian", nativeName: "Indonesia" },
  { code: "ur", label: "Urdu", nativeName: "اردو" },
  { code: "pa", label: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "ta", label: "Tamil", nativeName: "தமிழ்" },
  { code: "te", label: "Telugu", nativeName: "తెలుగు" },
  { code: "mr", label: "Marathi", nativeName: "मराठी" },
  { code: "gu", label: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn", label: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", nativeName: "മലയാളം" },
  { code: "af", label: "Afrikaans", nativeName: "Afrikaans" },
  { code: "sq", label: "Albanian", nativeName: "Shqip" },
  { code: "am", label: "Amharic", nativeName: "አማርኛ" },
  { code: "hy", label: "Armenian", nativeName: "Հայերեն" },
  { code: "az", label: "Azerbaijani", nativeName: "Azərbaycanca" },
  { code: "eu", label: "Basque", nativeName: "Euskara" },
  { code: "be", label: "Belarusian", nativeName: "Беларуская" },
  { code: "bs", label: "Bosnian", nativeName: "Bosanski" },
  { code: "bg", label: "Bulgarian", nativeName: "Български" },
  { code: "ca", label: "Catalan", nativeName: "Català" },
  { code: "ceb", label: "Cebuano", nativeName: "Cebuano" },
  { code: "ny", label: "Chichewa", nativeName: "Chichewa" },
  { code: "co", label: "Corsican", nativeName: "Corsu" },
  { code: "hr", label: "Croatian", nativeName: "Hrvatski" },
  { code: "cs", label: "Czech", nativeName: "Čeština" },
  { code: "da", label: "Danish", nativeName: "Dansk" },
  { code: "nl", label: "Dutch", nativeName: "Nederlands" },
  { code: "eo", label: "Esperanto", nativeName: "Esperanto" },
  { code: "et", label: "Estonian", nativeName: "Eesti" },
  { code: "tl", label: "Filipino", nativeName: "Filipino" },
  { code: "fi", label: "Finnish", nativeName: "Suomi" },
  { code: "fy", label: "Frisian", nativeName: "Frysk" },
  { code: "gl", label: "Galician", nativeName: "Galego" },
  { code: "ka", label: "Georgian", nativeName: "ქართული" },
  { code: "el", label: "Greek", nativeName: "Ελληνικά" },
  { code: "ht", label: "Haitian Creole", nativeName: "Kreyòl ayisyen" },
  { code: "ha", label: "Hausa", nativeName: "Hausa" },
  { code: "haw", label: "Hawaiian", nativeName: "ʻŌlelo Hawaiʻi" },
  { code: "iw", label: "Hebrew", nativeName: "עברית" },
  { code: "hmn", label: "Hmong", nativeName: "Hmong" },
  { code: "hu", label: "Hungarian", nativeName: "Magyar" },
  { code: "is", label: "Icelandic", nativeName: "Íslenska" },
  { code: "ig", label: "Igbo", nativeName: "Igbo" },
  { code: "ga", label: "Irish", nativeName: "Gaeilge" },
  { code: "it", label: "Italian", nativeName: "Italiano" },
  { code: "jw", label: "Javanese", nativeName: "Jawa" },
  { code: "kk", label: "Kazakh", nativeName: "Қазақша" },
  { code: "km", label: "Khmer", nativeName: "ខ្មែរ" },
  { code: "ku", label: "Kurdish", nativeName: "Kurdî" },
  { code: "ky", label: "Kyrgyz", nativeName: "Кыргызча" },
  { code: "lo", label: "Lao", nativeName: "ລາວ" },
  { code: "la", label: "Latin", nativeName: "Latina" },
  { code: "lv", label: "Latvian", nativeName: "Latviešu" },
  { code: "lt", label: "Lithuanian", nativeName: "Lietuvių" },
  { code: "lb", label: "Luxembourgish", nativeName: "Lëtzebuergesch" },
  { code: "mk", label: "Macedonian", nativeName: "Македонски" },
  { code: "mg", label: "Malagasy", nativeName: "Malagasy" },
  { code: "ms", label: "Malay", nativeName: "Melayu" },
  { code: "mt", label: "Maltese", nativeName: "Malti" },
  { code: "mi", label: "Maori", nativeName: "Māori" },
  { code: "mn", label: "Mongolian", nativeName: "Монгол" },
  { code: "my", label: "Myanmar", nativeName: "မြန်မာ" },
  { code: "ne", label: "Nepali", nativeName: "नेपाली" },
  { code: "no", label: "Norwegian", nativeName: "Norsk" },
  { code: "ps", label: "Pashto", nativeName: "پښتو" },
  { code: "fa", label: "Persian", nativeName: "فارسی" },
  { code: "pl", label: "Polish", nativeName: "Polski" },
  { code: "ro", label: "Romanian", nativeName: "Română" },
  { code: "sm", label: "Samoan", nativeName: "Samoan" },
  { code: "gd", label: "Scots Gaelic", nativeName: "Gàidhlig" },
  { code: "sr", label: "Serbian", nativeName: "Српски" },
  { code: "st", label: "Sesotho", nativeName: "Sesotho" },
  { code: "sn", label: "Shona", nativeName: "Shona" },
  { code: "sd", label: "Sindhi", nativeName: "سنڌي" },
  { code: "si", label: "Sinhala", nativeName: "සිංහල" },
  { code: "sk", label: "Slovak", nativeName: "Slovenčina" },
  { code: "sl", label: "Slovenian", nativeName: "Slovenščina" },
  { code: "so", label: "Somali", nativeName: "Soomaali" },
  { code: "su", label: "Sundanese", nativeName: "Sunda" },
  { code: "sw", label: "Swahili", nativeName: "Kiswahili" },
  { code: "sv", label: "Swedish", nativeName: "Svenska" },
  { code: "tg", label: "Tajik", nativeName: "Тоҷикӣ" },
  { code: "th", label: "Thai", nativeName: "ไทย" },
  { code: "tr", label: "Turkish", nativeName: "Türkçe" },
  { code: "uk", label: "Ukrainian", nativeName: "Українська" },
  { code: "uz", label: "Uzbek", nativeName: "Oʻzbek" },
  { code: "vi", label: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "cy", label: "Welsh", nativeName: "Cymraeg" },
  { code: "xh", label: "Xhosa", nativeName: "isiXhosa" },
  { code: "yi", label: "Yiddish", nativeName: "ייִדיש" },
  { code: "yo", label: "Yoruba", nativeName: "Yorùbá" },
  { code: "zu", label: "Zulu", nativeName: "isiZulu" },
] as const;

const INCLUDED_LANGUAGES = LANGUAGES.map((language) => language.code).filter(Boolean).join(",");

function getGoogleCombo() {
  return document.querySelector<HTMLSelectElement>(".goog-te-combo");
}

function setGoogleTranslateCookie(value: string) {
  const cookieValue = value && value !== "en" ? `/en/${value}` : "/en/en";
  document.cookie = `googtrans=${cookieValue}; path=/`;
}

function getCurrentGoogleLanguage() {
  if (typeof document === "undefined") return "en";

  const match = document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
  const value = match?.[1] ? decodeURIComponent(match[1]) : "";
  const language = value.split("/").filter(Boolean).at(-1);
  return LANGUAGES.some((item) => item.code === language) ? language ?? "en" : "en";
}

export function GoogleTranslate({ id = "google_translate_element", tone = "dark" }: { id?: string; tone?: "dark" | "light" }) {
  const [language, setLanguage] = useState("en");
  const [ready, setReady] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = LANGUAGES.find((item) => item.code === language);
  const filteredLanguages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = normalized ? LANGUAGES.filter((item) =>
      item.label.toLowerCase().includes(normalized) ||
      item.nativeName.toLowerCase().includes(normalized) ||
      item.code.toLowerCase().includes(normalized)
    ) : [...LANGUAGES];
    return matches.sort((a, b) =>
      Number(b.code === language) - Number(a.code === language)
    );
  }, [language, query]);

  useEffect(() => {
    setLanguage(getCurrentGoogleLanguage());
  }, []);

  useEffect(() => {
    if (!document.getElementById(ENGINE_ID)) {
      const engine = document.createElement("div");
      engine.id = ENGINE_ID;
      engine.className = "google-translate-engine";
      engine.setAttribute("aria-hidden", "true");
      document.body.appendChild(engine);
    }

    const initWidget = () => {
      if (!window.google?.translate) return;
      if (document.getElementById(ENGINE_ID)?.childNodes.length) return;

      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: INCLUDED_LANGUAGES,
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        },
        ENGINE_ID
      );
    };

    window.googleTranslateElementInit = initWidget;

    if (window.google?.translate) {
      initWidget();
      return;
    }

    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const combo = getGoogleCombo();
      if (combo) {
        setReady(true);
        window.clearInterval(interval);
      }
    }, 300);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  function applyLanguage(value: string) {
    setLanguage(value);

    const combo = getGoogleCombo();
    if (!combo) {
      setGoogleTranslateCookie(value);
      window.location.reload();
      return;
    }

    setGoogleTranslateCookie(value);
    combo.value = value;
    combo.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <div id={id} ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={!ready}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Translate page"
        className={cn(
          "inline-flex h-11 min-w-[7.75rem] items-center justify-between gap-2 rounded-lg border px-3 text-sm font-medium shadow-[var(--aura-shadow-xs)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65",
          tone === "dark"
            ? "border-white/16 bg-white/10 text-white hover:bg-white/16 focus-visible:ring-white/70 focus-visible:ring-offset-[#2D176F]"
            : "border-[var(--aura-border)] bg-white text-[var(--aura-heading)] hover:bg-[var(--aura-off-white)] focus-visible:ring-[var(--aura-purple)]"
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-2 truncate">
          <Globe2 className={cn("h-4 w-4 shrink-0", tone === "dark" ? "text-white/90" : "text-[var(--aura-purple)]")} aria-hidden="true" />
          <span className="truncate">{selected?.nativeName ?? "Translate"}</span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", tone === "dark" ? "text-white/70" : "text-[var(--aura-muted)]", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[9999] mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--aura-border)] bg-white p-2 shadow-[var(--aura-shadow-lg)]">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--aura-muted)]" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search language"
              className="h-10 w-full rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] pl-9 pr-3 text-sm text-[var(--aura-heading)] outline-none transition-colors focus:border-[var(--aura-purple)] focus:bg-white"
            />
          </div>

          <div className="max-h-72 overflow-y-auto pr-1" role="listbox" aria-label="Select language">
            {filteredLanguages.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-[var(--aura-muted)]">No language found</div>
            ) : filteredLanguages.map((item) => {
              const active = item.code === language;
              return (
                <button
                  key={item.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    applyLanguage(item.code);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-purple)]",
                    active ? "bg-[var(--aura-lavender)] text-[var(--aura-purple)]" : "text-[var(--aura-heading)] hover:bg-[var(--aura-off-white)]"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.nativeName}</span>
                    <span className="block truncate text-xs text-[var(--aura-muted)]">{item.label}</span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
