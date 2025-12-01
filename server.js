// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors()); // Allow cross-origin requests
app.use(express.json({ limit: '50mb' })); // Parse JSON, allow large images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public')); // Serve static HTML files

// MongoDB Connection
console.log('🔍 Attempting to connect to:', process.env.MONGODB_URI.replace(/\/\/(.+):(.+)@/, '//$1:****@')); // Hide password

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        console.log('📍 Database Host:', mongoose.connection.host);
        console.log('📁 Database Name:', mongoose.connection.name);
    })
    .catch((err) => console.error('❌ MongoDB connection error:', err));


// Define Item Schema (structure of data)
const itemSchema = new mongoose.Schema({
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
    photo: String, // Base64 image string
    dateAdded: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Create Model from Schema
const Item = mongoose.model('Item', itemSchema);

// ==================== API ROUTES ====================

// 1. GET all items
app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find().sort({ createdAt: -1 }); // Newest first
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

// 2. GET single item by ID
app.get('/api/items/:id', async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        
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

// 3. POST - Create new item
app.post('/api/items', async (req, res) => {
    try {
        const { name, description, category, availability, price, photo } = req.body;

        // Validate required fields
        if (!name || !category || !availability || !price || !photo) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Create new item
        const newItem = new Item({
            name,
            description,
            category,
            availability,
            price,
            photo
        });

        // Save to database
        const savedItem = await newItem.save();

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

// 4. PUT - Update item
app.put('/api/items/:id', async (req, res) => {
    try {
        const updatedItem = await Item.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedItem) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

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

// 5. DELETE - Delete item
app.delete('/api/items/:id', async (req, res) => {
    try {
        const deletedItem = await Item.findByIdAndDelete(req.params.id);

        if (!deletedItem) {
            return res.status(404).json({
                success: false,
                message: 'Item not found'
            });
        }

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

// 6. GET - Search items
app.get('/api/items/search/:query', async (req, res) => {
    try {
        const searchQuery = req.params.query;
        
        const items = await Item.find({
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ]
        });

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

// Health check route
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
    console.log(`🔗 API available at http://localhost:${PORT}/api/items`);
});
