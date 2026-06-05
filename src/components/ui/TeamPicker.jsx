import { useState } from 'react';
import { teamLogoUrl } from '../../utils/mlbHelpers';
import Modal from './Modal';

export default function TeamPicker({ label, selected, onSelect, exclude, teams }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = teams.filter(
    (t) =>
      t.id !== exclude?.id &&
      t.name.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = (team) => {
    onSelect(team);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 text-center">
        {label}
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex flex-col items-center gap-2 p-3 sm:p-4 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-2xl transition-all active:scale-[0.97]"
      >
        {selected ? (
          <>
            <img
              src={teamLogoUrl(selected.id)}
              className="w-14 h-14 object-contain"
              alt={selected.name}
            />
            <div className="text-center">
              <div className="font-semibold text-sm text-white leading-tight">
                {selected.name}
              </div>
              <div className="text-[10px] text-slate-500">
                {selected.league} · {selected.division}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center text-2xl text-slate-600">
              ⚾
            </div>
            <span className="text-sm text-slate-500">Pick team</span>
          </>
        )}
      </button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setQuery('');
        }}
        title={`Select ${label} Team`}
        size="sm"
        panelClassName="overflow-hidden"
      >
        <div className="p-4 border-b border-slate-800">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
        </div>
        <div className="overflow-y-auto max-h-72">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelect(t)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-colors text-left"
            >
              <img
                src={teamLogoUrl(t.id)}
                className="w-8 h-8 object-contain flex-shrink-0"
                alt={t.name}
              />
              <div>
                <div className="text-sm font-medium text-slate-200">{t.name}</div>
                <div className="text-[10px] text-slate-500">
                  {t.league} {t.division}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}