"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROLES = [
  { slug: "tech", label: "Technician" },
  { slug: "engineer", label: "Chief engineer" },
  { slug: "aom", label: "AOM" },
  { slug: "hq", label: "HQ pill owner" },
] as const;

const BUILDINGS = [
  { id: "tower-a", name: "Tower A" },
  { id: "building-b", name: "Building B" },
] as const;

function getInitialBuilding(): string {
  if (typeof document === "undefined") return "tower-a";
  const match = document.cookie.match(/pill-desk-building=([^;]+)/);
  return match ? match[1] : "tower-a";
}

export function TopBar() {
  const pathname = usePathname();
  // Read the cookie once at render time. This is fine because
  // the select uses defaultValue (uncontrolled) and only updates
  // when the user picks a different building.
  const initialBuilding = getInitialBuilding();

  const switchBuilding = (id: string) => {
    document.cookie = `pill-desk-building=${id};path=/;max-age=86400`;
    // Force a reload so server components pick up the new cookie
    window.location.reload();
  };

  const resetDemo = async () => {
    await fetch("/api/reset", { method: "POST" });
    window.location.reload();
  };

  return (
    <header className="topbar">
      <div className="brand">
        Pill Desk <small>working name</small>
      </div>
      <nav className="tabs" aria-label="Role switcher">
        {ROLES.map((role) => (
          <Link
            key={role.slug}
            href={`/${role.slug}`}
            className={pathname?.startsWith(`/${role.slug}`) ? "on" : ""}
          >
            {role.label}
          </Link>
        ))}
      </nav>
      <div className="topbar-actions">
        <label className="who">
          <span
            className="mono"
            style={{
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Building
          </span>{" "}
          <select
            defaultValue={initialBuilding}
            onChange={(e) => switchBuilding(e.target.value)}
            style={{
              background: "var(--top-ink)",
              color: "var(--top-bg)",
              border: "1px solid var(--top-ink)",
              padding: "4px 8px",
              fontFamily: "var(--mono)",
              fontSize: "12px",
            }}
          >
            {BUILDINGS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button className="reset-btn" onClick={resetDemo}>
          Reset demo
        </button>
      </div>
    </header>
  );
}
