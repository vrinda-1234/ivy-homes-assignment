import { createContext, useContext, useEffect, useState } from "react";
import * as api from "../api/client";
import { useAuth } from "./AuthContext";

const FavouritesContext = createContext(null);

export function FavouritesProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [favourites, setFavourites] = useState([]); // full listing objects
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setFavourites([]);
      setLoaded(false);
      return;
    }
    api
      .getFavourites()
      .then((data) => setFavourites(data.results || []))
      .catch(() => setFavourites([]))
      .finally(() => setLoaded(true));
  }, [isLoggedIn]);

  function isSaved(listingId) {
    return favourites.some((f) => f.listing_id === listingId);
  }

  async function toggle(listing) {
    if (isSaved(listing.listing_id)) {
      setFavourites((prev) => prev.filter((f) => f.listing_id !== listing.listing_id)); // optimistic
      try {
        await api.removeFavourite(listing.listing_id);
      } catch {
        setFavourites((prev) => [...prev, listing]); // revert on failure
      }
    } else {
      setFavourites((prev) => [...prev, listing]); // optimistic
      try {
        await api.addFavourite(listing.listing_id);
      } catch {
        setFavourites((prev) => prev.filter((f) => f.listing_id !== listing.listing_id)); // revert
      }
    }
  }

  return (
    <FavouritesContext.Provider value={{ favourites, loaded, isSaved, toggle }}>
      {children}
    </FavouritesContext.Provider>
  );
}

export function useFavourites() {
  return useContext(FavouritesContext);
}
