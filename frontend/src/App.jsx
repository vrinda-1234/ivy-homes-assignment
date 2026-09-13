import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { FavouritesProvider } from "./context/FavouritesContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Listings from "./pages/Listings";
import ListingDetail from "./pages/ListingDetail";
import Rentals from "./pages/Rentals";
import Projects from "./pages/Projects";
import Saved from "./pages/Saved";
import Insights from "./pages/Insights";

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <FavouritesProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/listings" replace />} />
              <Route path="/listings" element={<Listings />} />
              <Route path="/listings/:id" element={<ListingDetail />} />
              <Route path="/rentals" element={<Rentals />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/insights" element={<Insights />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </FavouritesProvider>
      </DataProvider>
    </AuthProvider>
  );
}
