import { Link } from "react-router-dom";
import { useFavourites } from "../context/FavouritesContext";
import { formatInr, titleCase } from "../utils";

export default function Saved() {
  const { favourites, loaded, toggle } = useFavourites();

  return (
    <div>
      <h1>Saved listings</h1>
      {!loaded && <div className="loading-block">Loading your saved listings…</div>}
      {loaded && favourites.length === 0 && (
        <div className="empty-state">Nothing saved yet — browse listings and hit Save.</div>
      )}
      {favourites.length > 0 && (
        <div className="listing-grid">
          {favourites.map((l) => (
            <div key={l.listing_id} className="listing-card">
              <Link to={`/listings/${l.listing_id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="price">{formatInr(l.price)}</div>
                <div>
                  {l.bedroom} BHK {titleCase(l.property_type)} in {l.apartment_name}
                </div>
                <div className="meta">{titleCase(l.locality)}</div>
              </Link>
              <button className="save-btn secondary" onClick={() => toggle(l)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
