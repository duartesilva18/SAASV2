import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Enviar idioma atual para o backend (para respostas localizadas)
  const language = localStorage.getItem('language');
  if (language) {
    config.headers['Accept-Language'] = language;
  }
  return config;
});

// Interceptor para lidar com erros 401 (token expirado) e erros de rede
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Erro de rede (servidor não acessível)
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('Erro de rede: O servidor backend pode não estar a correr.');
      console.error('URL da API:', api.defaults.baseURL);
      // Não fazer nada - deixar o componente lidar com o erro
      return Promise.reject(error);
    }
    
    // Erro 401 (token expirado)
    if (error.response?.status === 401) {
      // Token expirado ou inválido - limpar tokens
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      // Redirecionar para login apenas se estiver numa página protegida
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/')) {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

export const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default api;

