require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

// Production CORS configuration
const allowedOrigins = [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'https://renthub-ndky.onrender.com',
    'https://renthub-frontend.vercel.app',
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        console.log('🔍 Request from origin:', origin);
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

console.log('✅ CORS enabled for:', allowedOrigins);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'your_mongodb_connection_string';
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ Connected to MongoDB');
    console.log('📍 Database Host:', mongoose.connection.host);
    console.log('📁 Database Name:', mongoose.connection.name);
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
});

// ============================================
// SCHEMAS
// ============================================

// User Schema - ENHANCED with profile fields
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    // NEW PROFILE FIELDS
    bio: { type: String, default: '' },
    profilePic: { type: String, default: '' },
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalItemsListed: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Item Schema - Keep as is
const itemSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    availability: {
        type: String,
        enum: ['available', 'not-available'],
        default: 'available'
    },
    price: { type: Number, required: true },
    photo: { type: String },
    dateAdded: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Item = mongoose.model('Item', itemSchema);

// NEW: Review Schema
const reviewSchema = new mongoose.Schema({
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const Review = mongoose.model('Review', reviewSchema);

// ============================================
// MIDDLEWARE
// ============================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key', (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ============================================
// AUTH ROUTES (Keep existing)
// ============================================

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            phone
        });
        await newUser.save();

        const token = jwt.sign(
            { userId: newUser._id, email: newUser.email },
            process.env.JWT_SECRET || 'your_jwt_secret_key',
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
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
            message: 'Server error during signup'
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'your_jwt_secret_key',
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
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
            message: 'Server error during login'
        });
    }
});

// ============================================
// NEW: PROFILE ROUTES
// ============================================

// Get logged-in user's profile
app.get('/api/profile/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ success: false, message: 'Error fetching profile' });
    }
});

// Update user profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { name, phone, bio, profilePic } = req.body;
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (bio !== undefined) user.bio = bio;
        if (profilePic !== undefined) user.profilePic = profilePic;

        await user.save();
        
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: userResponse
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Error updating profile' });
    }
});

// Get public user/seller profile
app.get('/api/users/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-password -email');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, message: 'Error fetching user' });
    }
});

// Get user's items (for seller profile)
app.get('/api/users/:userId/items', async (req, res) => {
    try {
        const items = await Item.find({ userId: req.params.userId }).sort({ dateAdded: -1 });
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error fetching user items:', error);
        res.status(500).json({ success: false, message: 'Error fetching items' });
    }
});

// ============================================
// ITEM ROUTES (Keep existing, no changes)
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Backend is running!',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find().populate('userId', 'name phone profilePic averageRating').sort({ dateAdded: -1 });
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ success: false, message: 'Error fetching items' });
    }
});

app.get('/api/items/:id', async (req, res) => {
    try {
        const item = await Item.findById(req.params.id).populate('userId', 'name phone profilePic averageRating totalReviews');
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        res.json({ success: true, data: item });
    } catch (error) {
        console.error('Error fetching item:', error);
        res.status(500).json({ success: false, message: 'Error fetching item' });
    }
});

app.post('/api/items', authenticateToken, async (req, res) => {
    try {
        const { name, description, category, availability, price, photo } = req.body;
        const newItem = new Item({
            userId: req.user.userId,
            name,
            description,
            category,
            availability: availability || 'available',
            price,
            photo
        });
        await newItem.save();
        
        // Update user's total items
        await User.findByIdAndUpdate(req.user.userId, { $inc: { totalItemsListed: 1 } });
        
        console.log('✅ Item created:', newItem.name);
        res.status(201).json({
            success: true,
            message: 'Item created successfully',
            data: newItem
        });
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({ success: false, message: 'Error creating item' });
    }
});

app.get('/api/items/seller/my-items', authenticateToken, async (req, res) => {
    try {
        const items = await Item.find({ userId: req.user.userId }).sort({ dateAdded: -1 });
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error fetching seller items:', error);
        res.status(500).json({ success: false, message: 'Error fetching items' });
    }
});

app.put('/api/items/:id', authenticateToken, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (item.userId.toString() !== req.user.userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const { name, description, category, availability, price, photo } = req.body;
        if (name) item.name = name;
        if (description) item.description = description;
        if (category) item.category = category;
        if (availability) item.availability = availability;
        if (price) item.price = price;
        if (photo) item.photo = photo;
        item.updatedAt = Date.now();

        await item.save();
        console.log('✅ Item updated:', item.name);
        res.json({
            success: true,
            message: 'Item updated successfully',
            data: item
        });
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ success: false, message: 'Error updating item' });
    }
});

app.delete('/api/items/:id', authenticateToken, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (item.userId.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await Item.findByIdAndDelete(req.params.id);
        
        // Update user's total items
        await User.findByIdAndUpdate(req.user.userId, { $inc: { totalItemsListed: -1 } });
        
        console.log('✅ Item deleted:', item.name);
        res.json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ success: false, message: 'Error deleting item' });
    }
});

app.get('/api/items/search/:query', async (req, res) => {
    try {
        const query = req.params.query;
        const items = await Item.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } },
                { category: { $regex: query, $options: 'i' } }
            ]
        });
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('Error searching items:', error);
        res.status(500).json({ success: false, message: 'Error searching items' });
    }
});

// ============================================
// NEW: REVIEW/RATING ROUTES
// ============================================

// Get reviews for an item
app.get('/api/items/:id/reviews', async (req, res) => {
    try {
        const reviews = await Review.find({ itemId: req.params.id })
            .populate('buyerId', 'name profilePic')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: reviews });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, message: 'Error fetching reviews' });
    }
});

// Create a review
app.post('/api/items/:id/reviews', authenticateToken, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const item = await Item.findById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        // Prevent self-review
        if (item.userId.toString() === req.user.userId) {
            return res.status(400).json({ success: false, message: 'Cannot review your own item' });
        }

        const newReview = new Review({
            itemId: req.params.id,
            sellerId: item.userId,
            buyerId: req.user.userId,
            rating,
            comment
        });

        await newReview.save();

        // Recalculate seller's average rating
        const allReviews = await Review.find({ sellerId: item.userId });
        const avgRating = allReviews.reduce((sum, rev) => sum + rev.rating, 0) / allReviews.length;
        
        await User.findByIdAndUpdate(item.userId, {
            averageRating: avgRating.toFixed(1),
            totalReviews: allReviews.length
        });

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: newReview
        });
    } catch (error) {
        console.error('Error creating review:', error);
        res.status(500).json({ success: false, message: 'Error creating review' });
    }
});

// ============================================
// DEFAULT & ERROR ROUTES
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

app.listen(PORT, () => {
    console.log('🚀 Server running on http://localhost:' + PORT);
    console.log('📍 Environment:', process.env.NODE_ENV || 'development');
});
