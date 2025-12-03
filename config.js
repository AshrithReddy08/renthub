// API Configuration for RentHub
// Automatically detects if running locally or in production
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : 'https://renthub-ndky.onrender.com';

console.log('🌐 Using API:', API_BASE_URL);
console.log('📍 Current hostname:', window.location.hostname);
