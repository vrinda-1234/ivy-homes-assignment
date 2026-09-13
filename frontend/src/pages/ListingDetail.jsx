import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useFavourites } from "../context/FavouritesContext";
import DataLoadingGate from "../components/DataLoadingGate";
import { getListing } from "../api/client";
import { formatInr, titleCase } from "../utils";

function DetailInner() {
  const { id } = useParams();
  const { listings } = useData();
  const { isSaved, toggle } = useFavourites();
  const [listing, setListing] = useState(() => listings.find((l) => l.listing_id === id) || null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // If it's not in the already-pulled dataset (e.g. someone shared a
    // direct link before the pull finished), fetch it directly — this also
    // exercises GET /v1/listing/{id} on its own.
    if (listing) return;
    getListing(id)
      .then(setListing)
      .catch(() => setNotFound(true));
  }, [id, listing]);

  const similar = useMemo(() => {
    if (!listing) return [];
    return listings
      .filter(
        (l) =>
          l.listing_id !== listing.listing_id &&
          l.locality === listing.locality &&
          l.bedroom === listing.bedroom &&
          l.is_live
      )
      .slice(0, 4);
  }, [listing, listings]);

  if (notFound) return <div className="empty-state">This listing couldn't be found.</div>;
  if (!listing) return <div className="loading-block">Loading listing…</div>;

  return (
    <div>
      <Link to="/listings" style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>
        ← Back to listings
      </Link>
      <h1 style={{ marginTop: "0.6rem" }}>{formatInr(listing.price)}</h1>
      <h2>
        {listing.bedroom} BHK {titleCase(listing.property_type)} in {listing.apartment_name}
      </h2>
      <p>
        {titleCase(listing.locality)} · Listed by {listing.posted_by_name} ({listing.posted_by} ·{" "}
        {listing.posted_by_contact})
      </p>

      <div className="detail-grid">
        <div>
          <p>{listing.description}</p>

          <div className="detail-facts">
            <div>
              <div className="k">Carpet area</div>
              <div className="v">{listing.carpet_area} sqft</div>
            </div>
            <div>
              <div className="k">Super built-up area</div>
              <div className="v">{listing.super_built_up_area} sqft</div>
            </div>
            <div>
              <div className="k">Bathrooms</div>
              <div className="v">{listing.bathroom}</div>
            </div>
            <div>
              <div className="k">Balcony</div>
              <div className="v">{listing.balcony}</div>
            </div>
            <div>
              <div className="k">Floor</div>
              <div className="v">
                {listing.floor} of {listing.total_floors}
              </div>
            </div>
            <div>
              <div className="k">Facing</div>
              <div className="v">{titleCase(listing.facing_direction)}</div>
            </div>
            <div>
              <div className="k">Furnishing</div>
              <div className="v">{titleCase(listing.furnishing)}</div>
            </div>
            <div>
              <div className="k">Parking</div>
              <div className="v">{listing.covered_parking} covered</div>
            </div>
          </div>

          <button onClick={() => toggle(listing)}>
            {isSaved(listing.listing_id) ? "Remove from saved" : "Save this listing"}
          </button>
        </div>

        <div>
          <h3>Similar nearby</h3>
          {similar.length === 0 && <p>No close matches in the current dataset.</p>}
          {similar.map((s) => (
            <Link
              key={s.listing_id}
              to={`/listings/${s.listing_id}`}
              style={{ display: "block", textDecoration: "none", color: "inherit", marginTop: "0.8rem" }}
            >
              <div className="listing-card" style={{ padding: "0.7rem" }}>
                <div className="price" style={{ fontSize: "1.05rem" }}>
                  {formatInr(s.price)}
                </div>
                <div className="meta">
                  {s.carpet_area} sqft · {titleCase(s.apartment_name)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ListingDetail() {
  return (
    <DataLoadingGate>
      <DetailInner />
    </DataLoadingGate>
  );
}
