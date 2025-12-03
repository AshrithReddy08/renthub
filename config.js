// API Configuration for deployment
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : 'BACKEND_URL_PLACEHOLDER';

console.log('🌐 Using API:', API_BASE_URL);
