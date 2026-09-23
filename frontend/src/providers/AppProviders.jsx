import { AuthContextProvider } from "../context/AuthContext.jsx";

export function AppProviders({ children }) {
  return <AuthContextProvider>{children}</AuthContextProvider>;
}
