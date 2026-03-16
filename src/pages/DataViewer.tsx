import { useState, useEffect, useMemo } from 'react';
import { db } from '../data/db';
import type { RestrictionArea, TrafficSign } from '../types';
import './DataViewer.css';

type ViewerType = 'areas' | 'signs';

interface DataViewerProps {
  type: ViewerType;
}

const AREA_COLUMNS: (keyof Omit<RestrictionArea, 'geometry'>)[] = [
  'id', 'rajoitustyyppi', 'rajoitustyypit', 'suuruusRaw', 'suuruusKmh',
  'poikkeus', 'lisatieto', 'paatostila', 'alkuPvm', 'loppuPvm',
  'pituusRaw', 'diaarinumero', 'tietolahde', 'nimisijainti', 'irrotusPvm', 'jnro', 'bbox'
];

const SIGN_COLUMNS: (keyof Omit<TrafficSign, 'geometry'>)[] = [
  'id', 'vlmlajityyppi', 'vlmtyyppi', 'rajoitusarvo', 'iconKey',
  'nimiFi', 'nimiSv', 'sijaintiFi', 'sijaintiSv',
  'lisakilventekstiFi', 'lisakilventekstiSv',
  'vaylalaji', 'paatos', 'vaikutusalue', 'patatyyppi', 'pakotyyppi',
  'tklNumero', 'mittauspaiva', 'vaylat', 'irrotusPvm'
];

function cellValue(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function matchesFilter(row: Record<string, unknown>, filter: string): boolean {
  if (!filter) return true;
  const lower = filter.toLowerCase();
  return Object.values(row).some(v => cellValue(v).toLowerCase().includes(lower));
}

export default function DataViewer({ type }: DataViewerProps) {
  const [areas, setAreas] = useState<RestrictionArea[]>([]);
  const [signs, setSigns] = useState<TrafficSign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState<string>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const load = async () => {
      try {
        if (type === 'areas') {
          const data = await db.restriction_areas.toArray();
          setAreas(data);
        } else {
          const data = await db.traffic_signs.toArray();
          setSigns(data);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [type]);

  const columns = type === 'areas' ? AREA_COLUMNS : SIGN_COLUMNS;
  const rawRows = (type === 'areas' ? areas : signs) as Record<string, unknown>[];

  const filtered = useMemo(() => {
    const rows = rawRows.filter(row => matchesFilter(row, filter));
    rows.sort((a, b) => {
      const av = cellValue(a[sortCol]);
      const bv = cellValue(b[sortCol]);
      const aNum = Number(av);
      const bNum = Number(bv);
      const cmp = (!isNaN(aNum) && !isNaN(bNum))
        ? aNum - bNum
        : av.localeCompare(bv, 'fi');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [rawRows, filter, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const title = type === 'areas' ? 'Restriction Areas' : 'Traffic Signs';
  const totalCount = rawRows.length;

  return (
    <div className="dv-page">
      <div className="dv-header">
        <h1 className="dv-title">{title}</h1>
        <span className="dv-count">
          {loading ? 'Loading…' : `${filtered.length} / ${totalCount} records`}
        </span>
        <input
          className="dv-filter"
          type="search"
          placeholder="Filter all columns…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {error && <div className="dv-error">{error}</div>}

      {loading && <div className="dv-loading">Loading data from IndexedDB…</div>}

      {!loading && !error && (
        <div className="dv-table-wrap">
          <table className="dv-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col}
                    className={`dv-th${sortCol === col ? ' dv-th--sorted' : ''}`}
                    onClick={() => handleSort(col)}
                    title={`Sort by ${col}`}
                  >
                    {col}
                    {sortCol === col && (
                      <span className="dv-sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'dv-row-even' : 'dv-row-odd'}>
                  {columns.map(col => (
                    <td key={col} className="dv-td" title={cellValue(row[col])}>
                      {cellValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="dv-empty">
                    No records match the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
