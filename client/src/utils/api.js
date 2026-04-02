import axios from "axios";

const api = axios.create({
  baseURL: "https://fuel-spotter-server.onrender.com/api",
  timeout: 10000,
});

api.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default api;
