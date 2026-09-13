import { createContext, useContext, useEffect, useRef, useState } from "react";
import { fetchAllPages } from "../api/client";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

// We pull the entire dataset once per session and do all filtering, sorting
// and pagination in the browser. This sidesteps the API's broken `page`
// param and its undercounting `total` field entirely — we already know the
// only reliable approach is to page by offset until the server returns
// nothing, so we do that once, up front, instead of re-fighting it on every
// screen.
export function DataProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [listings, setListings] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ listings: 0, rentals: 0, projects: 0 });
  const [error, setError] = useState(null);
  const pulledRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || pulledRef.current) return;
    pulledRef.current = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [l, r, p] = await Promise.all([
          fetchAllPages("/v1/listings", {}, (n) => setProgress((s) => ({ ...s, listings: n }))),
          fetchAllPages("/v1/rentals", {}, (n) => setProgress((s) => ({ ...s, rentals: n }))),
          fetchAllPages("/v1/projects", {}, (n) => setProgress((s) => ({ ...s, projects: n }))),
        ]);
        setListings(l);
        setRentals(r);
        setProjects(p);
      } catch (e) {
        setError(e.message);
        pulledRef.current = false; // allow retry
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoggedIn]);

  return (
    <DataContext.Provider value={{ listings, rentals, projects, loading, progress, error }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
