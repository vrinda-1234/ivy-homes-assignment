import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import DataLoadingGate from "../components/DataLoadingGate";
import { formatInr, titleCase } from "../utils";

const PAGE_SIZE = 20;

function RentalsInner() {
  const { rentals } = useData();
  const [locality, setLocality] = useState("");
  const [bedroom, setBedroom] = useState("");
  const [page, setPage] = useState(1);

  const active = useMemo(() => rentals.filter((r) => r.is_live === true), [rentals]);
  const localities = useMemo(
    () => [...new Set(active.map((r) => r.locality))].filter(Boolean).sort(),
    [active]
  );

  const filtered = useMemo(() => {
    let rows = active;
    if (locality) rows = rows.filter((r) => r.locality === locality);
    if (bedroom) rows = rows.filter((r) => String(r.bedroom) === bedroom);
    return rows;
  }, [active, locality, bedroom]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <h1>Rent in Gurgaon</h1>
      <div className="filters-bar">
        <div>
          <label>Locality</label>
          <select
            value={locality}
            onChange={(e) => {
              setLocality(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {localities.map((l) => (
              <option key={l} value={l}>
                {titleCase(l)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Bedrooms</label>
          <select
            value={bedroom}
            onChange={(e) => {
              setBedroom(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} BHK
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="result-count">{filtered.length.toLocaleString()} rentals</div>

      {pageRows.length === 0 ? (
        <div className="empty-state">No rentals match these filters.</div>
      ) : (
        <div className="listing-grid">
          {pageRows.map((r) => (
            <div key={r.listing_id} className="listing-card">
              <div className="price">{formatInr(r.price)}/mo</div>
              <div>
                {r.bedroom} BHK in {r.apartment_name}
              </div>
              <div className="meta">
                {titleCase(r.locality)} · Deposit {formatInr(r.deposit)} · {titleCase(r.furnishing)}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button className="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button className="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function Rentals() {
  return (
    <DataLoadingGate>
      <RentalsInner />
    </DataLoadingGate>
  );
}
