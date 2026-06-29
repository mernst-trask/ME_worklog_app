import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import { localDateStr } from '../utils/date';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function Dashboard({ user, onLogout }) {
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [selectedId, setSelectedId] = useState(null); // null = team overview
  const [showAddForm, setShowAddForm] = useState(false);

  const loadWorkers = useCallback(async () => {
    setLoadingWorkers(true);
    try {
      const { workers: list } = await api.workers();
      setWorkers(list);
    } finally {
      setLoadingWorkers(false);
    }
  }, []);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  const selectedWorker = workers.find((w) => w.id === selectedId) || null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">Worklog</div>
          <div className="brand-sub">{user.name} · Manager</div>
        </div>

        <div
          className={`worker-item ${selectedId === null ? 'active' : ''}`}
          onClick={() => { setSelectedId(null); loadWorkers(); }}
          style={{ marginTop: 8 }}
        >
          <span>Team overview</span>
        </div>

        <div className="nav-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span>Workers ({workers.length})</span>
          <button
            onClick={loadWorkers}
            title="Refresh hours"
            style={{ background: 'none', border: 'none', color: '#7d8290', cursor: 'pointer', fontSize: 11 }}
          >
            ↻ refresh
          </button>
        </div>
        <ul className="worker-list">
          {loadingWorkers ? (
            <li style={{ color: '#9aa0ad', fontSize: 13 }}>Loading…</li>
          ) : (
            workers.map((w) => (
              <li
                key={w.id}
                className={`worker-item ${selectedId === w.id ? 'active' : ''}`}
                onClick={() => { setSelectedId(w.id); loadWorkers(); }}
              >
                <span>{w.name}</span>
                <span className="hours">{w.hoursThisMonth.toFixed(1)}h</span>
              </li>
            ))
          )}
        </ul>

        <button className="btn btn-secondary" onClick={() => setShowAddForm(true)} style={{ marginTop: 12 }}>
          + Add worker
        </button>

        <div className="sidebar-footer" style={{ marginTop: 16 }}>
          <button className="logout-link" onClick={onLogout}>Log out</button>
        </div>
      </aside>

      <main className="main">
        {selectedWorker ? (
          <WorkerView
            worker={selectedWorker}
            onRemoved={() => { setSelectedId(null); loadWorkers(); }}
          />
        ) : (
          <TeamOverview workers={workers} loading={loadingWorkers} />
        )}
      </main>

      {showAddForm && (
        <AddWorkerModal
          onClose={() => setShowAddForm(false)}
          onAdded={() => { setShowAddForm(false); loadWorkers(); }}
        />
      )}
    </div>
  );
}

function AddWorkerModal({ onClose, onAdded }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name || !email || !password) {
      setError('Fill in all fields.');
      return;
    }
    setBusy(true);
    try {
      await api.addWorker(name.trim(), email.trim(), password);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <form
        className="card"
        style={{ width: 360, margin: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 style={{ marginTop: 0, fontFamily: 'var(--font-display)' }}>Add worker</h2>
        {error ? <p className="error-text">{error}</p> : null}
        <input className="text-input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <input className="text-input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="text-input" placeholder="Temporary password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-teal" disabled={busy}>{busy ? 'Adding…' : 'Add worker'}</button>
        </div>
      </form>
    </div>
  );
}

function ResetPasswordModal({ worker, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await api.resetWorkerPassword(worker.id, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <form
        className="card"
        style={{ width: 360, margin: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 style={{ marginTop: 0, fontFamily: 'var(--font-display)' }}>Reset password</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
          for {worker.name} ({worker.email})
        </p>

        {done ? (
          <>
            <p style={{ fontSize: 14 }}>
              Password updated. Share the new password with {worker.name} directly — they'll use
              it next time they log into the mobile app.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={onDone}>Done</button>
            </div>
          </>
        ) : (
          <>
            {error ? <p className="error-text">{error}</p> : null}
            <input
              className="text-input"
              placeholder="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-teal" disabled={busy}>
                {busy ? 'Saving…' : 'Set new password'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function TeamOverview({ workers, loading }) {
  const [from, setFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [to, setTo] = useState(() => localDateStr());
  const [rows, setRows] = useState([]);
  const [loadingReport, setLoadingReport] = useState(true);

  const loadReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const { rows: reportRows } = await api.report({ from, to });
      setRows(reportRows);
    } finally {
      setLoadingReport(false);
    }
  }, [from, to]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const totalHours = useMemo(() => rows.reduce((sum, r) => sum + (r.total_hours || 0), 0), [rows]);

  return (
    <>
      <h1 className="page-title">Team overview</h1>
      <p className="page-subtitle">Hours logged across everyone, for the selected period.</p>

      <div className="card card-row">
        <div>
          <div className="stat">{workers.length}</div>
          <div className="stat-label">Workers</div>
        </div>
        <div>
          <div className="stat">{totalHours.toFixed(1)}h</div>
          <div className="stat-label">Total hours, period</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            From <input className="text-input" style={{ marginBottom: 0, width: 150, display: 'inline-block', marginLeft: 6 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            To <input className="text-input" style={{ marginBottom: 0, width: 150, display: 'inline-block', marginLeft: 6 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button
            className="btn btn-secondary"
            onClick={() => api.downloadReportCsv({ from, to }, `team_report_${from}_to_${to}.csv`)}
          >
            Export CSV
          </button>
        </div>

        {loading || loadingReport ? (
          <p className="empty-state">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">No workers or no hours logged in this period yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th className="num">Days logged</th>
                <th className="num">Total hours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id}>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td className="num">{r.days_logged}</td>
                  <td className="num">{Number(r.total_hours).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function WorkerView({ worker, onRemoved }) {
  const [{ year, month }, setYearMonth] = useState(todayParts());
  const [logs, setLogs] = useState([]);
  const [dailyCap, setDailyCap] = useState(10);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.monthLogs(year, month, worker.id);
      setLogs(data.logs);
      setDailyCap(data.dailyCap || 10);
    } finally {
      setLoading(false);
    }
  }, [year, month, worker.id]);

  useEffect(() => { load(); }, [load]);

  // Group the flat list of entries into { date: { totalHours, entries } }
  const logsByDate = useMemo(() => {
    const map = {};
    logs.forEach((entry) => {
      if (!map[entry.work_date]) map[entry.work_date] = { totalHours: 0, entries: [] };
      map[entry.work_date].entries.push(entry);
      map[entry.work_date].totalHours += entry.hours || 0;
    });
    Object.values(map).forEach((d) => { d.totalHours = Math.round(d.totalHours * 100) / 100; });
    return map;
  }, [logs]);

  const totalHours = useMemo(() => logs.reduce((sum, l) => sum + (l.hours || 0), 0), [logs]);
  const daysLogged = Object.keys(logsByDate).length;
  const selectedDay = selectedDate ? logsByDate[selectedDate] : null;

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setYearMonth({ year: y, month: m });
    setSelectedDate(null);
  }

  const [resettingPassword, setResettingPassword] = useState(false);

  async function handleRemove() {
    if (!window.confirm(`Remove ${worker.name} and all their logged hours? This can't be undone.`)) return;
    await api.removeWorker(worker.id);
    onRemoved();
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">{worker.name}</h1>
          <p className="page-subtitle">{worker.email}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => api.downloadReportCsv({ userId: worker.id, from: `${year}-${String(month).padStart(2, '0')}-01`, to: localDateStr(new Date(year, month, 0)) }, `${worker.name.replace(/\s+/g, '_')}_${year}_${month}.csv`)}
          >
            Export month CSV
          </button>
          <button className="btn btn-secondary" onClick={() => setResettingPassword(true)}>
            Reset password
          </button>
          <button className="btn btn-secondary" style={{ color: 'var(--rose)' }} onClick={handleRemove}>
            Remove worker
          </button>
        </div>
      </div>

      {resettingPassword && (
        <ResetPasswordModal
          worker={worker}
          onClose={() => setResettingPassword(false)}
          onDone={() => setResettingPassword(false)}
        />
      )}

      <div className="card">
        <div className="calendar-header">
          <button className="nav-btn" onClick={() => shiftMonth(-1)}>‹</button>
          <span className="month-label">{MONTH_NAMES[month - 1]} {year}</span>
          <button className="nav-btn" onClick={() => shiftMonth(1)}>›</button>
        </div>

        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            logsByDate={logsByDate}
            selectedDate={selectedDate}
            onDayPress={(d) => setSelectedDate(d === selectedDate ? null : d)}
          />
        )}

        <div className="card-row" style={{ marginTop: 20 }}>
          <div>
            <div className="stat">{totalHours.toFixed(1)}h</div>
            <div className="stat-label">Total this month</div>
          </div>
          <div>
            <div className="stat">{daysLogged}</div>
            <div className="stat-label">Days logged</div>
          </div>
        </div>

        {selectedDay && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong>{selectedDate}</strong>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--teal)' }}>
                {selectedDay.totalHours.toFixed(2)}h / {dailyCap}h
              </span>
            </div>
            {selectedDay.entries.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hours logged this day.</div>
            ) : (
              selectedDay.entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {entry.clock_in && !entry.clock_out
                        ? 'In progress'
                        : entry.clock_in
                        ? `${new Date(entry.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(entry.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'Manual entry'}
                    </div>
                    {entry.notes ? <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{entry.notes}</div> : null}
                  </div>
                  {entry.hours ? <div className="num" style={{ fontFamily: 'var(--font-mono)' }}>{entry.hours}h</div> : null}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}