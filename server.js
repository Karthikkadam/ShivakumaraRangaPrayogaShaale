const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Create necessary directories if they don't exist
const dirs = ['uploads', 'data'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Serve static files with caching headers
app.use(express.static(path.join(__dirname), {
    maxAge: '1h',
    setHeaders: function (res, path) {
        if (path.endsWith('.pdf')) {
            res.set('Cache-Control', 'public, max-age=3600');
        }
    }
}));
app.use('/uploads', express.static('uploads', { maxAge: '1h' }));
app.use('/public', express.static('public', { maxAge: '1h' }));

// Configure multer for file uploads with file type validation
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads');
    },
    filename: function (req, file, cb) {
        // Add timestamp to filename to prevent conflicts
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Allow only images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Initialize data storage with persistence
let photos = [];
let events = [];
let siteContent = {
    heroTitle: 'Welcome to Our Community',
    heroText: 'Join us in celebrating our shared values and traditions',
    aboutTeaser: 'Discover our rich heritage and vibrant community',
    footerInfo: '© 2024 Our Community. All rights reserved.'
};

// Load data from files if they exist
try {
    if (fs.existsSync('data/photos.json')) {
        photos = JSON.parse(fs.readFileSync('data/photos.json'));
    }
    if (fs.existsSync('data/events.json')) {
        events = JSON.parse(fs.readFileSync('data/events.json'));
    }
    if (fs.existsSync('data/content.json')) {
        siteContent = JSON.parse(fs.readFileSync('data/content.json'));
    }
} catch (error) {
    console.error('Error loading data:', error);
}

// Helper function to save data to files with error handling
function saveData() {
    try {
        if (!fs.existsSync('data')) {
            fs.mkdirSync('data');
        }
        fs.writeFileSync('data/photos.json', JSON.stringify(photos, null, 2));
        fs.writeFileSync('data/events.json', JSON.stringify(events, null, 2));
        fs.writeFileSync('data/content.json', JSON.stringify(siteContent, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'kk.html'));
});

// API Routes

// Photos
app.get('/api/photos', (req, res) => {
    res.json(photos);
});

app.post('/api/photos', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const newPhoto = {
            id: Date.now().toString(),
            imageUrl: `${baseUrl}/uploads/${req.file.filename}`,
            caption: req.body.caption || '',
            dateAdded: new Date().toISOString()
        };

        photos.push(newPhoto);
        saveData();
        res.json(newPhoto);
    } catch (error) {
        console.error('Error in photo upload:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

app.delete('/api/photos/:id', async (req, res) => {
    try {
        const photo = photos.find(p => p.id === req.params.id);
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Delete the file
        const imagePath = path.join(__dirname, photo.imageUrl.split('/uploads/')[1]);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        photos = photos.filter(p => p.id !== req.params.id);
        saveData();
        res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

// Events routes with proper file handling
app.post('/api/events', upload.single('image'), (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const newEvent = {
            id: Date.now().toString(),
            title: req.body.title,
            date: req.body.date,
            location: req.body.location,
            description: req.body.description,
            imageUrl: req.file ? `${baseUrl}/uploads/${req.file.filename}` : null,
            dateAdded: new Date().toISOString()
        };

        events.push(newEvent);
        saveData();
        res.json(newEvent);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// Content
app.get('/api/content', (req, res) => {
    res.json(siteContent);
});

app.post('/api/content', express.json(), (req, res) => {
    siteContent = {
        ...siteContent,
        ...req.body
    };
    saveData();
    res.json(siteContent);
});

// Handle errors globally
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File is too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).send('Not Found');
});

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running locally at http://localhost:${port}`);
    console.log(`For other devices use: http://<your-ip-address>:${port}`);
    console.log(`Uploads directory: ${path.join(__dirname, 'uploads')}`);
    console.log(`Data directory: ${path.join(__dirname, 'data')}`);
});