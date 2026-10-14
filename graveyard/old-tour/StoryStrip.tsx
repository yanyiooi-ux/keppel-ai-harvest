"use client";
import { motion } from "framer-motion";
interface StoryPanel { num: number; step: string; pipVariant: 1|2|3|4|5|6; everydayPicture: string; pictureLabel: string; sentence: string; }
const STORY: StoryPanel[] = [
  { num: 1, step: "Capture", pipVariant: 1, everydayPicture: "restaurant", pictureLabel: "a waiter tells the cook", sentence: "A veteran tells the app what they know, like a recipe book." },
  { num: 2, step: "Daily use", pipVariant: 2, everydayPicture: "checklist", pictureLabel: "a pilot's pre-flight list", sentence: "The tech follows a set checklist on their phone, step by step." },
  { num: 3, step: "Safety lines", pipVariant: 3, everydayPicture: "traffic lights", pictureLabel: "green go, amber wait, red stop", sentence: "Green steps just happen, amber needs a yes, red means stop." },
  { num: 4, step: "Decide", pipVariant: 4, everydayPicture: "stamp", pictureLabel: "approve or send back", sentence: "The manager sees each card and stamps approve, send back, or escalate." },
  { num: 5, step: "Learn with undo", pipVariant: 5, everydayPicture: "recipe book", pictureLabel: "a new edition, old one kept", sentence: "A correction makes v1.1, tests run, then one click undoes it." },
  { num: 6, step: "Reuse", pipVariant: 6, everydayPicture: "bubble tea", pictureLabel: "one recipe, many shops", sentence: "Building B gets the same pill and its manager says yes or not here." },
];
function EverydayPicture({ kind }: { kind: string }) {
  const pictures: Record<string,string> = { restaurant: "\u{1F374}", checklist: "\u{1F4CB}", "traffic lights": "\u{1F6A6}", stamp: "\u{1F516}", "recipe book": "\u{1F4D6}", "bubble tea": "\u{1F9CB}" };
  return (<div style={{ fontSize: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", background: "var(--b-bg)", borderRadius: "var(--radius-sm)", flexShrink: 0 }}>{pictures[kind] || "\u{1F4CD}"}</div>);
}
function PipMini({ variant }: { variant: 1|2|3|4|5|6 }) {
  const body = "#8B7CFF";
  const accent = variant === 2 ? "#F59E0B" : variant === 3 ? "#EF4444" : variant === 4 ? "#38BDF8" : variant === 5 ? "#22C55E" : variant === 6 ? "#38BDF8" : "#8B7CFF";
  return (
    <div style={{ width: "36px", height: "36px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--b-bg)", borderRadius: "50%" }}>
      <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="4" width="12" height="20" rx="6" fill={body} />
        <circle cx="11" cy="12" r="1.6" fill="#FFFFFF" />
        <circle cx="17" cy="12" r="1.6" fill="#FFFFFF" />
        <circle cx="11" cy="12" r="0.8" fill="#07080C" />
        <circle cx="17" cy="12" r="0.8" fill="#07080C" />
        {variant === 1 && <rect x="20" y="14" width="5" height="7" fill="#1A1D23" rx="0.5" />}
        {variant === 2 && <rect x="7" y="3" width="14" height="3" rx="1.5" fill={accent} />}
        {variant === 3 && (<><rect x="20" y="8" width="3" height="8" fill="#0D0F14" rx="0.5" /><circle cx="21.5" cy="11" r="1" fill={accent} /></>)}
        {variant === 4 && <rect x="20" y="10" width="4" height="8" fill={accent} rx="0.5" />}
        {variant === 5 && <rect x="10" y="15" width="8" height="4" fill={accent} rx="0.5" opacity="0.9" />}
        {variant === 6 && (<g transform="translate(22, 10)"><rect x="0" y="0" width="6" height="10" rx="3" fill={accent} opacity="0.8" /><circle cx="1.5" cy="3" r="0.8" fill="#FFFFFF" /><circle cx="4.5" cy="3" r="0.8" fill="#FFFFFF" /></g>)}
      </svg>
    </div>
  );
}
export function StoryStrip() {
  return (
    <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px", flexWrap: "wrap" }}>
      {STORY.map((panel, i) => (
        <motion.div key={panel.num} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.06 }}
          style={{ flex: "1 1 160px", minWidth: "150px", maxWidth: "200px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", position: "relative" }}>
          <div style={{ position: "absolute", top: "10px", right: "12px", fontFamily: "var(--mono)", fontSize: "0.6875rem", color: "var(--muted)" }}>{panel.num}/6</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
            <PipMini variant={panel.pipVariant} />
            <div style={{ fontSize: "1rem", color: "var(--ink-dim)" }}>{"\u2192"}</div>
            <EverydayPicture kind={panel.everydayPicture} />
          </div>
          <div style={{ fontFamily: "var(--font-head)", fontSize: "0.875rem", fontWeight: 600, color: "var(--violet)", letterSpacing: "-0.01em" }}>{panel.step}</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--ink-dim)", lineHeight: "1.5" }}>{panel.sentence}</div>
          <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "var(--mono)" }}>{panel.pictureLabel}</div>
        </motion.div>
      ))}
    </div>
  );
}
