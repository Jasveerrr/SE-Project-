import { AuthContextProvider } from "../context/AuthContext.jsx";
import { NearbyProvider } from "../context/NearbyContext.jsx";

export function AppProviders({ children }) {
  return (
    <AuthContextProvider>
      <NearbyProvider>{children}</NearbyProvider>
    </AuthContextProvider>
  );
}
