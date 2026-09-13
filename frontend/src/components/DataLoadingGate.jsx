import { useData } from "../context/DataContext";

// Wraps pages that need the pulled dataset. Shows progress while it's still
// loading, and a plain error state if the pull failed.
export default function DataLoadingGate({ children }) {
  const { loading, error, listings, progress } = useData();

  if (error) {
    return (
      <div className="empty-state">
        <p>Couldn't load property data: {error}</p>
      </div>
    );
  }

  if (loading && listings.length === 0) {
    return (
      <div className="loading-block">
        <p>Loading the full dataset — this only happens once per session.</p>
        <p>
          {progress.listings} listings · {progress.rentals} rentals · {progress.projects} projects
        </p>
      </div>
    );
  }

  return children;
}
