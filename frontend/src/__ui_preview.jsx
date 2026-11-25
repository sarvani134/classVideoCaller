import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AuthProvider } from "./context/AuthContext"
import { DashBoardProvider } from "./context/DashboardContext"
import HomePage from "./components/HomePage"
import Navbar from "./components/Navbar"
import "./index.css"
import "./App.css"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <DashBoardProvider>
        <Navbar />
        <HomePage />
      </DashBoardProvider>
    </AuthProvider>
  </StrictMode>,
)
