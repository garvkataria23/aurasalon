# Google Translate Language Switching — Complete Guide

**Project:** `aurasalonpos/marketing-site` (Next.js 16.2.11, React 19, Tailwind v4)
**Scope:** Sirf wo layer jo **actually kaam karta hai** — Google Translate.
**Tolgee layer documented nahi hai** kyunki wo dead hai (proof Section 8 me hai).

---

## 1. Ek line me sarkar

> Website ka language switching **100% Google ke `translate.google.com` engine** se hota hai. Humne apna koi bhi translation API ya dictionary use nahi ki. Humne sirf Google ka official script inject karke uska **hidden native `<select>`** ko ek custom UI se drive kiya.

---

## 2. Live file map — sirf ye 5 files kaam karte hain

| # | File | Kaam |
|---|------|------|
| 1 | `src/app/layout.tsx` | `<head>` me Google ke liye preconnect + dns-prefetch (speed) |
| 2 | `src/components/ui/GoogleTranslate.tsx` | Poora switcher — script inject, cookie, hidden select, custom dropdown |
| 3 | `src/app/globals.css` (lines 909–996) | Hidden engine ko chhupa, custom select style, GT banner hide, RTL fix |
| 4 | `src/components/layout/Navbar.tsx` (line 259) | Desktop switcher mount |
| 5 | `src/components/layout/MobileMenu.tsx` (line 107) | Mobile switcher mount |

Supporting (mount plumbing, i18na kaam nahi karta):
- `src/components/layout/NavbarDeferredLoader.tsx` — Navbar ko idle ke baad dynamic load karta hai

---

## 3. "Google se kya liya" — exact 6 cheezein

Ye 6 techniques Google ke public web widget se inspired hain. Yehi poora kaam karwate hain:

1. **Official script URL** — `https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit`
   `cb=` callback ka naam batata hai. Script load hote hi Google us global function ko call karta hai.

2. **Hidden engine `<div>`** — Google ka engine ek specific `id` wale div me inject karta hai. Us div ko hum `left: -10000px`, `opacity: 0`, `pointer-events: none` se screen se bhijha dete hain. Engine chalu rehta hai, dikhta nahi.

3. **Hidden native `<select>` ko remote control** — Google engine me ek native `<select class="goog-te-combo">` banta hai. Hum usko `querySelector` se pakadte hain aur uski `.value` set karke `change` event fire karte hain. **Yahi asli trigger hai.**

4. **`googtrans` cookie** — `googtrans=/en/hi; path=/`. Google is cookie ko padhta hai. Isse translation page load ke time apply hoti hai (flash nahi hota), aur reload ke baad bhi yaad rehti hai.

5. **`.skiptranslate` class** — Google apna "Get an email for new translations" banner DOM me daalta hai. CSS se `display: none !important` karke chhupa dete hain.

6. **`body { top: 0 !important }`** — GT banner hide hone ke baad Google `body` ko `top: 40px` push karta hai, isse poora page neeche shift ho jata tha. Ye fix usko wapas 0 pe set karta hai.

Bonus: `preconnect` / `dns-prefetch` — `translate.google.com`, `translate.googleapis.com`, `www.gstatic.com` ko layout ke `<head>` me. Isse pehla translation request 100–300ms fast hota hai.

---

## 4. Poora code (verbatim)

### 4.1 `src/app/layout.tsx` — sirf `<head>` block (lines 83–89)

```tsx
<head>
  <link rel="preconnect" href="https://translate.google.com" />
  <link rel="preconnect" href="https://translate.googleapis.com" />
  <link rel="preconnect" href="https://www.gstatic.com" />
  <link rel="dns-prefetch" href="https://translate.google.com" />
  <link rel="dns-prefetch" href="https://translate.googleapis.com" />
  <link rel="dns-prefetch" href="https://www.gstatic.com" />
</head>
```

### 4.2 `src/components/ui/GoogleTranslate.tsx` — full file

Ye file 3 parts me hai: language list, engine boot, aur custom UI.

#### Part A — global type declaration + constants

```tsx
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
```

#### Part B — 100+ language list (Google ke supported codes)

```tsx
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
```

#### Part C — helper functions

```tsx
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
```

#### Part D — component + engine boot

```tsx
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

  // Cookie se current language padho
  useEffect(() => {
    setLanguage(getCurrentGoogleLanguage());
  }, []);

  // Google engine div banao + script inject karo
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

  // Dropdown: bahar click ya Escape se band
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

  // Hidden select ready hone ka wait (polling)
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

  // ★ ASLI TRIGGER — language apply karo
  function applyLanguage(value: string) {
    setLanguage(value);

    const combo = getGoogleCombo();
    if (!combo) {
      // Engine abhi ready nahi → cookie set karke reload
      setGoogleTranslateCookie(value);
      window.location.reload();
      return;
    }

    setGoogleTranslateCookie(value);
    combo.value = value;
    combo.dispatchEvent(new Event("change", { bubbles: true }));
  }
```

#### Part E — custom UI (button + searchable dropdown)

```tsx
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
```

### 4.3 `src/app/globals.css` — lines 909–996 (verbatim)

```css
/* ===== RTL SUPPORT ===== */
[dir="rtl"] {
  direction: rtl;
  text-align: right;
}
[dir="rtl"] .rotate-180 {
  transform: rotate(0deg);
}
[dir="rtl"] [aria-hidden="true"].lucide-chevron-right {
  transform: scaleX(-1);
}
.google-translate {
  position: relative;
  height: 2.75rem;
  width: 9.75rem;
}

.google-translate-engine {
  position: absolute;
  left: -10000px;
  top: 0;
  height: 1px;
  width: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.google-translate-select {
  height: 100%;
  width: 100%;
  cursor: pointer;
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 700;
  outline: none;
  padding: 0 2rem 0 0.95rem;
}

.google-translate::after {
  content: "";
  pointer-events: none;
  position: absolute;
  right: 0.95rem;
  top: 50%;
  height: 0.45rem;
  width: 0.45rem;
  border-bottom: 2px solid currentColor;
  border-right: 2px solid currentColor;
  color: #fff;
  transform: translateY(-65%) rotate(45deg);
}

.google-translate-select:disabled {
  cursor: wait;
  opacity: 0.65;
}

.google-translate-select option {
  color: #1d1b20;
}

.google-translate-light {
  width: 8.75rem;
}

.google-translate-light .google-translate-select {
  border-color: var(--aura-border);
  background: var(--aura-off-white);
  color: var(--aura-heading);
}

.google-translate-light::after {
  color: var(--aura-heading);
}

.goog-te-banner-frame.skiptranslate,
body > .skiptranslate {
  display: none !important;
}

body {
  top: 0 !important;
}
```

### 4.4 Mount points

**`src/components/layout/Navbar.tsx` line 258–259** (desktop, `tone="dark"` default):

```tsx
{/* Desktop Right */}
<div className="hidden shrink-0 items-center gap-3 lg:flex">
  <GoogleTranslate id="google_translate_desktop" />
```

**`src/components/layout/MobileMenu.tsx` line 106–108** (mobile, `tone="light"`):

```tsx
<div className="flex items-center gap-2">
  <GoogleTranslate id="google_translate_mobile" tone="light" />
</div>
```

---

## 5. End-to-end flow

### 5.1 Boot (first page load)

```
Browser loads page
   ↓
layout.tsx <head> → preconnect to translate.google.com / googleapis.com / gstatic.com
   ↓
NavbarDeferredLoader waits for idle (setTimeout 0) or first pointerdown/keydown
   ↓
dynamic() imports Navbar (ssr: false) → renders
   ↓
Navbar renders <GoogleTranslate id="google_translate_desktop" />
   ↓
useEffect #1: reads document.cookie → googtrans → sets React state
              (so button shows correct language name immediately)
   ↓
useEffect #2:
   ├─ creates <div id="google_translate_engine" class="google-translate-engine">
   ├─ assigns window.googleTranslateElementInit = initWidget
   └─ appends <script async src=".../element.js?cb=googleTranslateElementInit">
   ↓
useEffect #3: poll every 300ms for document.querySelector(".goog-te-combo")
   ↓
Google script loads → calls window.googleTranslateElementInit()
   ↓
new google.translate.TranslateElement({ pageLanguage:"en", includedLanguages: "...", layout: SIMPLE }, "google_translate_engine")
   ↓
Google injects native <select class="goog-te-combo"> inside the hidden engine div
   ↓
CSS keeps it invisible: .google-translate-engine { left:-10000px; opacity:0; pointer-events:none }
   ↓
Polling finds .goog-te-combo → clearInterval → button enabled
```

### 5.2 User switches language

```
User clicks the Globe button
   ↓
setOpen(true) → custom dropdown opens (searchable, sorted active-first)
   ↓
User types "hindi" → filteredLanguages narrows (label / nativeName / code)
   ↓
User clicks हिन्दी → applyLanguage("hi")
   ↓
setLanguage("hi")                                    ← React state (button label)
document.cookie = "googtrans=/en/hi; path=/"         ← Google ko batao + future reloads ke liye
combo.value = "hi"                                   ← hidden native select set
combo.dispatchEvent(new Event("change", {bubbles:true}))   ← ★ Google trigger
   ↓
Google walks the DOM, translates text nodes in place (nofollow iframe)
   ↓
setOpen(false); setQuery("")
```

### 5.3 Reload / next page visit

```
New page load
   ↓
Google script reads googtrans cookie automatically
   ↓
Page renders already translated — no flash
   ↓
useEffect #1 reads the same cookie → button label correct
```

**Important:** `googtrans` cookie is set with `path=/` and **no expiry** → browser session cookie. Jaan-boojh kar nahi, browser close = reset.

### 5.4 Edge case: engine abhi ready nahi

```
applyLanguage() called but .goog-te-combo not found
   ↓
setGoogleTranslateCookie(value)
window.location.reload()
   ↓
Reload → Google script boot hote hi cookie se language apply
```

---

## 6. `id` prop kyun zaroori hai

Google ek hi page me **ek** `TranslateElement` per target div banata hai. `Navbar.tsx` aur `MobileMenu.tsx` dono `<GoogleTranslate>` render karte hain — dono ke beech `ENGINE_ID` (`google_translate_engine`) shared hai.

Isiliye:
- `ENGINE_ID` **same** hai → engine ek hi baar banta hai, script ek hi baar inject hota hai
- `SCRIPT_ID` guard (`if (document.getElementById(SCRIPT_ID)) return;`) → duplicate script injection rokta hai
- `if (document.getElementById(ENGINE_ID)?.childNodes.length) return;` → engine double-init rokta hai
- `id` prop (`google_translate_desktop` / `google_translate_mobile`) sirf **outer wrapper div** ka id hai, Google ko dikhta nahi. Ye uniqueness + CSS targeting ke liye hai.

---

## 7. Naye project me kaise lagaye (step by step)

### Step 0 — Decision

| Approach | Cost | Quality | SEO | Kab use karna hai |
|---|---|---|---|---|
| **A. Google Translate (ye wala)** | Free, 0 setup | 70–80%, machine translated | ❌ URL me language nahi | Marketing site, landing pages, < 3–4 months tak |
| **B. Tolgee / Phrase / Lokalise** | Free tier / paid | 95%+, human reviewed | ✅ proper `hreflang` | Bilingual launch, legal pages, docs |

Yahan pe sirf **A** documented hai. B ke liye Tolgee docs dekho.

### Step 1 — Component copy karo

`src/components/ui/GoogleTranslate.tsx` ko apne project me copy karo.

Dependencies chahiye:
- `lucide-react` (Check, ChevronDown, Globe2, Search)
- `cn` helper — Tailwind wala standard:
  ```ts
  // src/lib/utils.ts
  import { clsx, type ClassValue } from "clsx";
  import { twMerge } from "tailwind-merge";
  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }
  ```
  Ya `clsx` akela bhi chalega — `cn` ki jagah `clsx` import kar lo.

### Step 2 — CSS copy karo

`globals.css` (ya `app.css`) ke end me `Section 4.3` ka pura block paste karo.

Brand colors apne hisaab se badal do:
```css
/* replace */
color: #fff;                                    /* dark tone text */
focus-visible:ring-offset-[#2D176F];           /* dark tone ring offset */
border-color: var(--aura-border);              /* light tone border */
```

Agar aap CSS variables use nahi karte, seedha hex daal do.

### Step 3 — Head me preconnect

**Next.js App Router** — `src/app/layout.tsx`:
```tsx
<head>
  <link rel="preconnect" href="https://translate.google.com" />
  <link rel="preconnect" href="https://translate.googleapis.com" />
  <link rel="preconnect" href="https://www.gstatic.com" />
  <link rel="dns-prefetch" href="https://translate.google.com" />
  <link rel="dns-prefetch" href="https://translate.googleapis.com" />
  <link rel="dns-prefetch" href="https://www.gstatic.com" />
</head>
```

**Next.js Pages Router** — `_document.tsx` me `<Head>` ya `next/head` component me same links.

**Vite / plain React** — `index.html` me `<head>` me same links.

### Step 4 — Mount karo

```tsx
import { GoogleTranslate } from "@/components/ui/GoogleTranslate";

<GoogleTranslate id="google_translate_desktop" />        {/* dark navbar */}
<GoogleTranslate id="google_translate_mobile" tone="light" />  {/* light menu */}
```

`tone` do values: `"dark"` (dark background) | `"light"` (white background).

Component **client component** hai (`"use client"`). Sirf client component ke andar mount karo.

### Step 5 — Language list chhoti karo (optional)

Saari 100 languages nahi chahiye? Bas apni chahiye rakho — list chhoti karne se code simple aur UX fast:

```tsx
const LANGUAGES = [
  { code: "en", label: "English", nativeName: "English" },
  { code: "hi", label: "Hindi", nativeName: "हिन्दी" },
  { code: "ar", label: "Arabic", nativeName: "العربية" },
  { code: "es", label: "Spanish", nativeName: "Español" },
  { code: "fr", label: "French", nativeName: "Français" },
  { code: "de", label: "German", nativeName: "Deutsch" },
  { code: "zh-CN", label: "Chinese Simplified", nativeName: "简体中文" },
  { code: "ta", label: "Tamil", nativeName: "தமிழ்" },
  { code: "te", label: "Telugu", nativeName: "తెలుగు" },
  { code: "mr", label: "Marathi", nativeName: "मराठी" },
] as const;
```

`INCLUDED_LANGUAGES` auto-reduce ho jayega — woh auto-derived hai.

### Step 6 — Test

```bash
npm run dev
```

Checklist:
1. Globe button dikhta hai?
2. Dropdown khulta hai? Search kaam karta hai?
3. Hindi select karne pe page translate hota hai?
4. Reload ke baad language wahi rehti hai?
5. Google ka banner nahi aa raha?
6. Page neeche shift toh nahi hua?
7. Arabic (RTL) select karne pe layout mirror hota hai?
8. Mobile menu me bhi switcher hai?

---

## 8. Is repo ki honest reality — Tolgee layer DEAD hai

Aapne sahi pakda. Tolgee (`src/i18n/*`, `src/components/providers/LanguageProvider.tsx`, `src/components/ui/LanguageSelector.tsx`) ka **koi user-visible effect nahi** hai. Proof:

| Fact | Evidence |
|---|---|
| `LanguageProvider` **sirf ek jagah** mount hai | `NavbarDeferredLoader.tsx:28` — aur wahi `<Navbar />` ko wrap karta hai. Baaki poora app uske bahar hai. |
| `LanguageSelector` **kahin render nahi** hota | Pure repo search me sirf apni file me mila. Switcher UI ke liye kabhi use nahi hua. |
| `CommandPalette` ka EN/हिं button **kaam nahi karta** | Wo `DeferredMarketingWidgets` me hai → provider ke bahar → `useLanguage()` ko `fallbackLanguageValue` milta hai → `setLanguage: () => {}` (no-op). Button dikhta hai, click kuch nahi karta. |
| `t()` hamesha English deta hai | Provider ke bahar `t` = `resolveFallbackMessage` = `SOURCE_MESSAGES[key] ?? humanize(key)`. Tolgee kabhi call hi nahi hota. |
| `NEXT_PUBLIC_TOLGEE_CDN_URL` empty hai | `BackendFetch` plugin load nahi hota. |
| `NEXT_PUBLIC_TOLGEE_DEV` set nahi hai | `DevBackend` + `DevTools` load nahi hote. |
| `bilingual` flag kahin read nahi hota | Sirf provider me define/set. Koi consumer nahi. Dead state. |
| `formatDate/formatNumber/formatCurrency` kahin use nahi | Sirf provider me define. Koi component call nahi karta. |
| `getPlannedHreflangAlternates()` kahin call nahi hota | `src/i18n/seo.ts` me defined, zero consumers. |
| `layout.tsx` ka `alternates.languages` galat hai | `"hi-IN": ${SITE_URL}?lang=hi` — lekin koi route `?lang=` nahi padhta. Wo URL 404 dega. |
| `_i18n-backup/` 42 files | Purana i18next setup, git me tracked hai but kahin import nahi hota. `_` prefix se TS exclude hai. |

**Conclusion:** Is website pe language change = **sirf Google Translate**. Baaki sab leftover scaffolding hai.

### Cleanup suggestion (delete permission lagega)

Agar decide karo ki Tolgee nahi chahiye, ye sab candidate hain:
- `src/i18n/` (4 files)
- `src/components/providers/LanguageProvider.tsx`
- `src/components/ui/LanguageSelector.tsx`
- `_i18n-backup/` (42 files)
- `tolgee-en.json`
- `src/app/api/tolgee-source/route.ts`
- `NEXT_PUBLIC_TOLGEE_*` env vars

⚠️ **Lekin** `Navbar.tsx`, `MobileMenu.tsx` aur ~40 components `useLanguage()` import karte hain. Cleanup se pehle ye saare replace karne padenge — ya `useLanguage()` ka ek lightweight stub rakhna padega jo sirf `t()` de (always English). **Ye decision aapka hai, maine kuch nahi delete kiya.**

---

## 9. SEO reality — Google Translate URL me language nahi daalta

Ye sabse bada limitation hai. Samjho:

- Google Translate **DOM ko runtime pe rewrite** karta hai. URL same rehta hai (`/pricing`, `/features`).
- Crawler ko alag URL nahi milta → **alag language ke alag pages index nahi hote**.
- Language switch karne se canonical/hreflang change nahi hota.
- Sirf ek hi language Googlebot ko properly crawl hota hai.

Isiliye `layout.tsx` me jo `alternates` block hai wo abhi **kaam nahi kar raha**.

### Agar multilingual SEO chahiye (future ke liye)

Route-based approach chahiye:
```
app/[locale]/page.tsx        → /en/pricing, /hi/pricing
middleware.ts                → Accept-Language header se redirect
generateMetadata             → per-locale title/description + hreflang alternates
```
Iske liye real translations chahiye (Tolgee/Phrase ya JSON files). Google Translate + SEO mutually exclusive hain — dono ek saath nahi chal sakte.

---

## 10. Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Button disabled / "cursor-wait" | `.goog-te-combo` nahi mila | Internet check. Ad-blocker `translate.google.com` block kar raha hai. Console me `window.google` check karo. |
| Button click kuch nahi karta | `applyLanguage` ne reload path liya | Page reload hoke apply ho jayega. Agar nahi hua to DevTools → Application → Cookies → `googtrans` dekho. |
| Page translate nahi ho raha | Script CSP me block | Content-Security-Policy me `script-src` aur `frame-src` me `https://translate.google.com` add karo. |
| Google banner dikh raha hai | CSS missing ya specificity | `.skiptranslate { display: none !important; }` confirm karo — `frame-src` bhi allow karo. |
| Poora page neeche shift | Banner hide hone ke baad `body{top:40px}` | `body { top: 0 !important; }` — ye already hai, confirm karo CSS load hua. |
| Language select ke baad text kuch jagah English | Google known limitation | Images, `data-*` attributes, `placeholder` attribute, aur code blocks translate nahi hote. `alt`/`title` attributes bhi nahi. |
| Dropdown khula lekin list khaali | `LANGUAGES` array filter | `code` values exact hone chahiye (`zh-CN`, `zh-TW`, `iw` — Hebrew ka code `he` nahi, `iw` hai!) |
| RTL (Arabic/Urdu) mein layout toota | CSS logical properties missing | `ml-`/`mr-` ki jagah `ms-`/`me-` use karo (Tailwind logical). `left/right` ki jagah `start/end`. |
| Dev me hydration warning | `document.cookie` SSR pe access | `getCurrentGoogleLanguage()` me `typeof document === "undefined"` guard mojood hai — rakho. |
| Route change pe language reset | Cookie `path=/` hai | Cookie sahi hai. Problem sirf tab hai jab koi aur code cookie overwrite kare. |

**⚠️ Critical code note — Hebrew ka code:**
`{ code: "iw", label: "Hebrew" }` — list me `iw` hai, `he` nahi. Agar aap `he` use karoge to Google select hi nahi karega. Same pattern: `zh-CN`/`zh-TW` (dash ke saath), `fil` (not `tl` — `tl` Tagalog hai).

---

## 11. Performance notes

| Cheez | Value |
|---|---|
| Script size | ~30 KB gzip (translate.google.com ka widget) |
| Load strategy | `async` + `NavbarDeferredLoader` — idle ke baad, ya first interaction pe |
| Engine render cost | Ek `<select>` (100+ `<option>`) — negligible |
| Translation cost | First switch ~300–800ms (network), cached baad me instant |
| Preconnect benefit | ~100–300ms faster first switch |
| CLS risk | Low — engine div `position: absolute` + hidden, layout shift nahi hota |
| SEO impact | None (positive bhi nahi) — runtime DOM rewrite |

**Optimization already in place:** `NavbarDeferredLoader.tsx` Navbar ko `dynamic(..., { ssr: false })` se load karta hai aur `setTimeout(0)` ya first `pointerdown`/`keydown` pe mount karta hai. Isse GT script initial page load ko block nahi karta.

Agar aur aage push karna hai to `setTimeout(load, 0)` ko `requestIdleCallback` se replace kar sakte ho.

---

## 12. Quick reference — env vars

**Is approach me koi env var nahi chahiye.** Google Translate public script hai, koi API key nahi.

Contrast — Tolgee ke env vars (jo abhi `.env.local` me hain par use nahi ho rahe):
```
NEXT_PUBLIC_TOLGEE_API_URL=https://app.tolgee.io
NEXT_PUBLIC_TOLGEE_API_KEY=<58-char key>
NEXT_PUBLIC_TOLGEE_CDN_URL=<empty>
NEXT_PUBLIC_TOLGEE_DEV=<not set>
```

---

## 13. Copy-paste checklist — naye project

```
□ npm i lucide-react clsx tailwind-merge
□ src/lib/utils.ts me cn() banao
□ src/components/ui/GoogleTranslate.tsx copy karo
□ globals.css me Section 4.3 ka block paste karo
□ Brand colors replace karo
□ layout.tsx (ya _document.tsx / index.html) me 6 preconnect/dns-prefetch links
□ Navbar me <GoogleTranslate id="gt-desktop" />
□ MobileMenu me <GoogleTranslate id="gt-mobile" tone="light" />
□ Chahiye to LANGUAGES list chhoti karo
□ Dev me test: switch → translate → reload → persist
□ RTL language (ar/ur) pe layout check
□ Console me CSP/network errors check
□ Commit: git add -A && git commit -m "feat: add Google Translate language switcher" && git push origin HEAD
```

---

## Summary

| Sawaal | Jawab |
|---|---|
| Language kaise change hota hai? | Google ke `translate.google.com` widget DOM ko runtime pe rewrite karta hai |
| Google se kya liya? | Script URL + `cb=` callback, hidden engine div, hidden `<select>` remote control, `googtrans` cookie, `.skiptranslate` banner hide, `body{top:0}` fix, preconnect links |
| API key chahiye? | Nahi |
| Cost? | Free |
| Kitni languages? | 100+ |
| Kitni jagah se trigger hota hai? | `Navbar.tsx:259`, `MobileMenu.tsx:107` |
| SEO me language URL me aata hai? | Nahi |
| Tolgee ka role? | Koi nahi — dead code |
