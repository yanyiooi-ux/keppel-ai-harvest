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
            style={{
              fontSize: "0.75rem",
              color: "var(--ink-dim)",
            }}
          >
            Building
          </span>{" "}
          <select
            defaultValue={initialBuilding}
            onChange={(e) => switchBuilding(e.target.value)}
            style={{
              background: "var(--panel-solid)",
              color: "var(--ink)",
              border: "1px solid var(--border)",
              padding: "8px 10px",
              fontFamily: "var(--font)",
              fontSize: "0.8125rem",
              borderRadius: "var(--radius-sm)",
              minHeight: "44px",
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
