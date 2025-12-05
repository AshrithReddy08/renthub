// auth.js - Authentication Module
// MUST load AFTER config.js

console.log('Loading auth.js...');

const auth = {
  // Use the global API_BASE_URL from config.js
  APIURL: `${API_BASE_URL}/api/auth`,

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    const token = localStorage.getItem('token');
    return token !== null && token !== undefined && token !== '';
  },

  /**
   * Get current user object
   */
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error('Error parsing user:', e);
      return null;
    }
  },

  /**
   * Get current user - property access
   */
  get user() {
    return this.getCurrentUser();
  },

  /**
   * Get token - property access
   */
  get token() {
    return localStorage.getItem('token');
  },

  /**
   * Get token - method version
   */
  getToken() {
    return localStorage.getItem('token');
  },

  /**
   * Logout user
   */
  logout() {
    console.log('Logging out user...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  },

  /**
   * Signup new user
   */
  async signup(name, email, password, phone) {
    try {
      console.log('Attempting signup for:', email);
      const response = await fetch(`${this.APIURL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          password,
          phone
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('Signup successful');
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return { success: true, user: data.user };
      } else {
        console.error('Signup failed:', data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  },

  /**
   * Login user
   */
  async login(email, password) {
    try {
      console.log('Attempting login for:', email);
      const response = await fetch(`${this.APIURL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('Login successful');
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return { success: true, user: data.user };
      } else {
        console.error('Login failed:', data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  }
};

console.log('✅ Auth module loaded successfully');
