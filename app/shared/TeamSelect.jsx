import React, { useEffect, useRef, useState } from "react";
import TeamLogo from "./TeamLogo.jsx";

/**
 * The site's team picker, for the React tools.
 *
 * Emits exactly the markup teamPickerField() in src/ui.js emits for the server
 * pages — a labelled strip beside the listbox — and the styling lives once, in
 * ui.js's BASE_CSS, which every tool already imports. A team is never chosen
 * through a native select anywhere on the site: it renders its value in the
 * platform's plain type and cannot carry the site's treatment.
 *
 * options: [{ value, label, note?, logo?, disabled? }]
 */
export default function TeamSelect({
  label = "My team", value, options, placeholder = "Select your team", onChange, disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [keyed, setKeyed] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const current = (options || []).find((o) => String(o.value) === String(value ?? ""));
  // Only a picker whose options carry logos shows them, so a list without them
  // is laid out exactly as before.
  const logos = (options || []).some((o) => "logo" in o);
  const pick = (o) => {
    if (o.disabled) return;
    setOpen(false);
    setKeyed(null);
    if (String(o.value) !== String(value ?? "")) onChange(o.value);
  };

  /* The keyboard: it opened on Enter and then went nowhere, because the options
     are list items with nothing to focus. Arrows walk them, Enter or Space
     takes the highlighted one, Escape closes. */
  const usable = (options || []).filter((o) => !o.disabled);
  const onKeyDown = (e) => {
    if (!usable.length) return;
    const at = usable.findIndex((o) => String(o.value) === String((keyed ?? (current ? current.value : null)) ?? ""));
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      const next = e.key === "Home" ? 0
        : e.key === "End" ? usable.length - 1
          : at < 0 ? (e.key === "ArrowUp" ? usable.length - 1 : 0)
            : e.key === "ArrowDown" ? Math.min(at + 1, usable.length - 1) : Math.max(at - 1, 0);
      setKeyed(usable[next].value);
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && open && keyed != null) {
      e.preventDefault();
      const o = usable.find((x) => String(x.value) === String(keyed));
      if (o) pick(o);
      return;
    }
    if (e.key === "Escape") { setOpen(false); setKeyed(null); }
  };

  return (
    <div className="teamrow">
      <span className="teamlab"><i />{label}</span>
      <div className="teamsel">
        <div ref={ref} className={"xsel" + (open ? " open" : "") + (current ? "" : " empty")}
          data-value={current ? String(current.value) : ""}>
          <button type="button" className="xselbtn" aria-haspopup="listbox" aria-expanded={open}
            aria-label={label} disabled={disabled} onKeyDown={onKeyDown}
            aria-activedescendant={open && keyed != null ? `xo-${String(keyed)}` : undefined}
            onClick={() => setOpen((o) => !o)}>
            {logos ? <span className="xsellogo">
              <TeamLogo src={current ? current.logo : null} className="xsello" />
            </span> : null}
            <span className="xselval">{current ? current.label : placeholder}</span>
            <span className="xselchev" aria-hidden="true" />
          </button>
          <ul className="xsellist" role="listbox">
            {(options || []).map((o) => {
              const on = String(o.value) === String(value ?? "");
              return (
                <li key={String(o.value)} id={`xo-${String(o.value)}`} role="option"
                  data-v={String(o.value)}
                  aria-selected={on} aria-disabled={o.disabled ? true : undefined}
                  className={(on ? "on" : "") + (o.disabled ? " off" : "")
                    + (String(o.value) === String(keyed ?? "\u0000") ? " key" : "")}
                  onClick={() => pick(o)}>
                  {logos ? <TeamLogo src={o.logo} className="xsello" /> : null}
                  {o.label}{o.note ? <small>{o.note}</small> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
