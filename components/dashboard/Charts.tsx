'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// ---------------------------------------------------------------- tooltip

export interface TipRow {
  value: string;
  label: string;
  color?: string;
}
interface TipState {
  x: number;
  y: number;
  title: string;
  rows: TipRow[];
}

function useTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const bind = (title: string, rows: TipRow[]) => ({
    onPointerMove: (e: React.PointerEvent) => setTip({ x: e.clientX, y: e.clientY, title, rows }),
    onPointerLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ x: r.left + r.width / 2, y: r.top, title, rows });
    },
    onBlur: () => setTip(null),
  });
  const node = tip ? <Tooltip {...tip} /> : null;
  return { bind, node };
}

function Tooltip({ x, y, title, rows }: TipState) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 14, top: y + 14 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = x + 14;
    let top = y - h - 12;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top < 8) top = y + 18;
    setPos({ left: Math.max(8, left), top });
  }, [x, y]);
  return (
    <div className="tip" ref={ref} role="tooltip" style={pos}>
      <p className="tip-title">{title}</p>
      {rows.map((r, i) => (
        <p className="tip-row" key={i}>
          {r.color && <span className="tip-key" style={{ background: r.color }} />}
          <strong>{r.value}</strong>
          <span>{r.label}</span>
        </p>
      ))}
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

const fmt = (n: number) => n.toLocaleString('en-PH');
export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

// ---------------------------------------------------------------- stat tile

export function StatTile({
  label,
  value,
  note,
  hero,
  children,
}: {
  label: string;
  value: number | string;
  note?: ReactNode;
  hero?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`tile${hero ? ' tile-hero' : ''}`}>
      <p className="tile-label">{label}</p>
      <p className="tile-value">{typeof value === 'number' ? fmt(value) : value}</p>
      {note && <p className="tile-note">{note}</p>}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- horizontal bar list

export interface BarItem {
  key: string;
  label: string;
  sub?: string;
  value: number;
  /** Optional text shown after the value, e.g. a share. */
  extra?: string;
  tip: TipRow[];
}

export function BarList({
  items,
  unit,
  limit = 12,
  onPick,
  picked,
}: {
  items: BarItem[];
  unit: string;
  limit?: number;
  /** Clicking a bar applies it as a filter. */
  onPick?: (key: string) => void;
  picked?: string;
}) {
  const { bind, node } = useTip();
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...items.map((i) => i.value));
  const shown = all ? items : items.slice(0, limit);
  if (!items.length || items.every((i) => i.value === 0)) return <p className="empty">No data for this selection yet.</p>;
  return (
    <>
      <ul className="barlist">
        {shown.map((it) => (
          <li
            key={it.key}
            className={`bar-row${onPick ? ' is-pickable' : ''}${picked === it.key ? ' is-picked' : ''}`}
            tabIndex={0}
            aria-label={`${it.label}: ${it.value} ${unit}${it.extra ? `, ${it.extra}` : ''}`}
            onClick={onPick ? () => onPick(it.key) : undefined}
            onKeyDown={
              onPick
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPick(it.key);
                    }
                  }
                : undefined
            }
            {...bind(it.label, it.tip)}
          >
            <span className="bar-label">
              {it.label}
              {it.sub && <small>{it.sub}</small>}
            </span>
            <span className="bar-area">
              {it.value > 0 && <span className="bar-fill" style={{ width: `calc((100% - 74px) * ${it.value / max})` }} />}
              <span className="bar-value">
                {fmt(it.value)}
                {it.extra && <small>{it.extra}</small>}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {items.length > limit && (
        <button type="button" className="link-btn" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
      {node}
    </>
  );
}

// ---------------------------------------------------------------- daily column chart

function niceTicks(max: number) {
  if (max <= 4) return Array.from({ length: Math.max(max, 1) + 1 }, (_, i) => i);
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

const shortDay = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDay = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

export function ColumnChart({ data }: { data: { day: string; count: number }[] }) {
  const { bind, node } = useTip();
  const { ref, width } = useWidth<HTMLDivElement>();
  if (!data.length) return <p className="empty">No registrations yet.</p>;
  const ticks = niceTicks(Math.max(...data.map((d) => d.count)));
  const top = ticks[ticks.length - 1] || 1;
  const maxIdx = data.reduce((m, d, i) => (d.count > data[m].count ? i : m), 0);
  // Thin out x labels so they never collide (~56px per label).
  const every = Math.max(1, Math.ceil((data.length * 56) / Math.max(width, 1)));
  return (
    <div className="cols">
      <div className="cols-y" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ bottom: `${(t / top) * 100}%` }}>
            {fmt(t)}
          </span>
        ))}
      </div>
      <div className="cols-main">
        <div className="cols-plot" ref={ref}>
          {ticks.map((t) => (
            <span key={t} className="cols-grid" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          {data.map((d, i) => (
            <div
              key={d.day}
              className="col"
              tabIndex={0}
              aria-label={`${longDay.format(asDate(d.day))}: ${d.count} registrations`}
              {...bind(longDay.format(asDate(d.day)), [
                { value: fmt(d.count), label: d.count === 1 ? 'registration' : 'registrations', color: 'var(--s1)' },
              ])}
            >
              <span className="col-fill" style={{ height: `${(d.count / top) * 100}%` }}>
                {i === maxIdx && d.count > 0 && <span className="col-cap">{fmt(d.count)}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="cols-x" aria-hidden="true">
          {data.map((d, i) => (
            <span key={d.day}>{i % every === 0 ? shortDay.format(asDate(d.day)) : ''}</span>
          ))}
        </div>
      </div>
      {node}
    </div>
  );
}

export function DailyTable({ data }: { data: { day: string; count: number }[] }) {
  return (
    <details className="data-twin">
      <summary>Show as table</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Registrations</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{longDay.format(asDate(d.day))}</td>
              <td className="num">{fmt(d.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
