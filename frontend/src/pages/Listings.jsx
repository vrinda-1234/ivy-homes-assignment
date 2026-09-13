import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../context/DataContext";
import DataLoadingGate from "../components/DataLoadingGate";
import { formatInr, titleCase } from "../utils";
import { useFavourites } from "../context/FavouritesContext";

const PAGE_SIZE = 20;

function ListingsInner() {
  const { listings } = useData();
  const { isSaved, toggle } = useFavourites();

  const [locality, setLocality] = useState("");
  const [bedroom, setBedroom] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [furnishing, setFurnishing] = useState("");
  const [sortBy, setSortBy] = useState("posted_at");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);

  // Only ever show listings that are actually live — the docs claim
  // /v1/listings returns active-only, but it doesn't (see findings); we
  // enforce that promise ourselves on the client.
  const active = useMemo(() => listings.filter((l) => l.is_live === true), [listings]);

  const localities = useMemo(
    () => [...new Set(active.map((l) => l.locality))].filter(Boolean).sort(),
    [active]
  );

  const filtered = useMemo(() => {
    let rows = active;
    if (locality) rows = rows.filter((l) => l.locality === locality);
    if (bedroom) rows = rows.filter((l) => String(l.bedroom) === bedroom);
    if (minPrice) rows = rows.filter((l) => l.price >= Number(minPrice));
    if (maxPrice) rows = rows.filter((l) => l.price <= Number(maxPrice));
    if (furnishing) rows = rows.filter((l) => l.furnishing === furnishing);

    const sorted = [...rows].sort((a, b) => {
      const dir = order === "asc" ? 1 : -1;
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      if (sortBy === "posted_at") return dir * (new Date(av) - new Date(bv));
      return dir * (av - bv);
    });
    return sorted;
  }, [active, locality, bedroom, minPrice, maxPrice, furnishing, sortBy, order]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage(setter) {
    return (val) => {
      setter(val);
      setPage(1);
    };
  }

  return (
    <div>
      <h1>Buy in Gurgaon</h1>

      <div className="filters-bar">
        <div>
          <label>Locality</label>
          <select value={locality} onChange={(e) => resetPage(setLocality)(e.target.value)}>
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
          <select value={bedroom} onChange={(e) => resetPage(setBedroom)(e.target.value)}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} BHK
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Min price</label>
          <input
            type="number"
            placeholder="₹"
            value={minPrice}
            onChange={(e) => resetPage(setMinPrice)(e.target.value)}
            style={{ width: "110px" }}
          />
        </div>
        <div>
          <label>Max price</label>
          <input
            type="number"
            placeholder="₹"
            value={maxPrice}
            onChange={(e) => resetPage(setMaxPrice)(e.target.value)}
            style={{ width: "110px" }}
          />
        </div>
        <div>
          <label>Furnishing</label>
          <select value={furnishing} onChange={(e) => resetPage(setFurnishing)(e.target.value)}>
            <option value="">Any</option>
            <option value="unfurnished">Unfurnished</option>
            <option value="semi-furnished">Semi-furnished</option>
            <option value="fully-furnished">Fully-furnished</option>
          </select>
        </div>
        <div>
          <label>Sort by</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="posted_at">Newest</option>
            <option value="price">Price</option>
            <option value="carpet_area">Area</option>
          </select>
        </div>
        <div>
          <label>Order</label>
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      <div className="result-count">
        {filtered.length.toLocaleString()} listing{filtered.length === 1 ? "" : "s"}
      </div>

      {pageRows.length === 0 ? (
        <div className="empty-state">No listings match these filters. Try widening them.</div>
      ) : (
        <div className="listing-grid">
          {pageRows.map((l) => (
            <div key={l.listing_id} className="listing-card" style={{ position: "relative" }}>
              <Link to={`/listings/${l.listing_id}`} style={{ textDecoration: "none", color: "inherit" }}>
                {l.is_verified && <span className="badge">Verified</span>}
                <div className="price">{formatInr(l.price)}</div>
                <div>
                  {l.bedroom} BHK {titleCase(l.property_type)} in {l.apartment_name}
                </div>
                <div className="meta">
                  {titleCase(l.locality)} · {l.carpet_area} sqft · {titleCase(l.furnishing)}
                </div>
              </Link>
              <button className="save-btn secondary" onClick={() => toggle(l)}>
                {isSaved(l.listing_id) ? "Saved ✓" : "Save"}
              </button>
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

export default function Listings() {
  return (
    <DataLoadingGate>
      <ListingsInner />
    </DataLoadingGate>
  );
}
