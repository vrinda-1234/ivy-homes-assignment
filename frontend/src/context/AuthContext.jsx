import { createContext, useContext, useEffect, useState } from "react";
import * as api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(api.getAuth());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // On mount (including after a page refresh), pick up whatever's in
    // localStorage. We don't force a network call here — client.js
    // refreshes lazily the moment a request actually needs a fresh token.
    setAuth(api.getAuth());
    setReady(true);
  }, []);

  async function login(email, password) {
    const result = await api.login(email, password);
    setAuth(result);
    return result;
  }

  function logout() {
    api.logout();
    setAuth(null);
  }

  return (
    <AuthContext.Provider value={{ auth, ready, isLoggedIn: !!auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
