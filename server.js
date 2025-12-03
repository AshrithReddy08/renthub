// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// MongoDB Connection
console.log('🔍 Attempting to connect to:', process.env.MONGODB_URI.replace(/\/\/(.+):(.+)@/, '//$1:****@'));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        console.log('📍 Database Host:', mongoose.connection.host);
        console.log('📁 Database Name:', mongoose.connection.name);
    })
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// ==================== DATABASE SCHEMAS ====================

// User Schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    phone: String,
    address: String,
    profilePicture: String,
    role: {
        type: String,
        enum: ['buyer', 'seller', 'both'],
        default: 'both'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Item Schema (Updated with userId)
const itemSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    category: {
        type: String,
        required: true
    },
    availability: {
        type: String,
        enum: ['available', 'not-available'],
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    photo: String,
    dateAdded: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create Models
const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);

// ==================== MIDDLEWARE ====================

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided. Please login.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token. Please login again.',
            error: error.message
        });
    }
};

// ==================== AUTHENTICATION ROUTES ====================

// 1. SIGNUP Route
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, confirmPassword, phone } = req.body;

        // Validation
        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered. Please login.'
            });
        }

        // Hash password
        const hashedPassword = await bcryptjs.hash(password, 10);

        // Create user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            role: 'both'
        });

        await newUser.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: newUser._id, email: newUser.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully!',
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during registration',
            error: error.message
        });
    }
});

// 2. LOGIN Route
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during login',
            error: error.message
        });
    }
});

// 3. GET Current User (Protected Route)
app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user',
            error: error.message
        });
    }
});

// 4. LOGOUT Route
app.post('/api/auth/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully!'
    });
});

// ==================== ITEM ROUTES (UPDATED WITH AUTH) ====================

// GET all items (Public)
app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find()
            .populate('userId', 'name email phone')
            .sort({ createdAt: -1 });
        
        res.json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching items',
            error: error.message
        });
    }
});

// GET single item (Public)
app.get('/api/items/:id', async (req, res) => {
    try {
        const item = await Item.findById(req.params.id)
            .populate('userId', 'name email phone');
        
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }
        
        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching item',
            error: error.message
        });
    }
});

// POST - Create item (PROTECTED - Requires Auth)
app.post('/api/items', verifyToken, async (req, res) => {
    try {
        const { name, description, category, availability, price, photo } = req.body;

        if (!name || !category || !availability || !price || !photo) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        const newItem = new Item({
            userId: req.userId, // User ID from JWT token
            name,
            description,
            category,
            availability,
            price,
            photo
        });

        const savedItem = await newItem.save();
        await savedItem.populate('userId', 'name email phone');

        res.status(201).json({
            success: true,
            message: 'Item created successfully',
            data: savedItem
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating item',
            error: error.message
        });
    }
});

// PUT - Update item (PROTECTED - Only owner can update)
app.put('/api/items/:id', verifyToken, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        // Check if user owns the item
        if (item.userId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own items'
            });
        }

        // Update item
        const updatedItem = await Item.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('userId', 'name email phone');

        res.json({
            success: true,
            message: 'Item updated successfully',
            data: updatedItem
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating item',
            error: error.message
        });
    }
});

// DELETE - Delete item (PROTECTED - Only owner can delete)
app.delete('/api/items/:id', verifyToken, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

        // Check if user owns the item
        if (item.userId.toString() !== req.userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own items'
            });
        }

        await Item.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting item',
            error: error.message
        });
    }
});

// GET user's items (Protected)
app.get('/api/my-items', verifyToken, async (req, res) => {
    try {
        const items = await Item.find({ userId: req.userId })
            .populate('userId', 'name email phone')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching your items',
            error: error.message
        });
    }
});

// GET items by seller (Public)
app.get('/api/seller/:userId/items', async (req, res) => {
    try {
        const items = await Item.find({ userId: req.params.userId })
            .populate('userId', 'name email phone')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching seller items',
            error: error.message
        });
    }
});

// Search items (Public)
app.get('/api/search/:query', async (req, res) => {
    try {
        const items = await Item.find({
            $or: [
                { name: { $regex: req.params.query, $options: 'i' } },
                { description: { $regex: req.params.query, $options: 'i' } }
            ]
        }).populate('userId', 'name email phone');

        res.json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error searching items',
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Backend is running!',
        timestamp: new Date()
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📂 Frontend available at http://localhost:${PORT}`);
    console.log(`🔗 API available at http://localhost:${PORT}/api`);
});
