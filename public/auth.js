// ==================== AUTH UTILITY FUNCTIONS ====================

class AuthManager {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user')) || null;
        this.API_URL =`${API_BASE_URL}/api/auth`;
    }

    // Check if user is logged in
    isLoggedIn() {
        return !!this.token;
    }

    // Get current user
    getCurrentUser() {
        return this.user;
    }

    // Get token
    getToken() {
        return this.token;
    }

    // Set token and user
    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }

    // Clear auth (logout)
    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    // Get Authorization header for API calls
    getAuthHeader() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // Redirect to login if not authenticated
    redirectToLoginIfNotAuthenticated() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    // Show user info in navbar
    displayUserInfo() {
        const userNameElement = document.getElementById('userName');
        const userEmailElement = document.getElementById('userEmail');
        
        if (userNameElement && this.user) {
            userNameElement.textContent = this.user.name;
        }
        if (userEmailElement && this.user) {
            userEmailElement.textContent = this.user.email;
        }
    }

    // Logout
    logout() {
        this.clearAuth();
        window.location.href = 'index.html';
    }

    // Get user's items
    async getMyItems() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/my-items`, {

                method: 'GET',
                headers: this.getAuthHeader()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching your items:', error);
            return { success: false, error: error.message };
        }
    }

    // Get seller's items
    async getSellerItems(userId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/seller/${userId}/items`, {
                method: 'GET'
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching seller items:', error);
            return { success: false, error: error.message };
        }
    }

    // Create item (Protected)
    async createItem(itemData) {
        try {
         const response = await fetch(`${API_BASE_URL}/api/my-items`, {

                method: 'POST',
                headers: this.getAuthHeader(),
                body: JSON.stringify(itemData)
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error creating item:', error);
            return { success: false, error: error.message };
        }
    }

    // Update item (Protected)
    async updateItem(itemId, itemData) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/items/${itemId}`, {
                method: 'PUT',
                headers: this.getAuthHeader(),
                body: JSON.stringify(itemData)
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error updating item:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete item (Protected)
    async deleteItem(itemId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/items/${itemId}`, {
                method: 'DELETE',
                headers: this.getAuthHeader()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error deleting item:', error);
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
const auth = new AuthManager();

// Check authentication status and update UI
document.addEventListener('DOMContentLoaded', function() {
    updateAuthUI();
});

function updateAuthUI() {
    const loginSignupButtons = document.getElementById('loginSignupButtons');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    if (auth.isLoggedIn()) {
        // User is logged in - show user dropdown
        if (loginSignupButtons) {
            loginSignupButtons.style.display = 'none';
        }
        if (userDropdown) {
            userDropdown.style.display = 'flex';
            auth.displayUserInfo();
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => auth.logout());
        }
    } else {
        // User is not logged in - show login/signup
        if (loginSignupButtons) {
            loginSignupButtons.style.display = 'flex';
        }
        if (userDropdown) {
            userDropdown.style.display = 'none';
        }
    }
}
