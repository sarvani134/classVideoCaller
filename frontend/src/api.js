import axios from "axios"

export const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5050"

const api = axios.create({
    baseURL: backendUrl
})

export default api
