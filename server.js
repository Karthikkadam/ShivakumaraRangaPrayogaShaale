const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const app = express();
const port = 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Create necessary directories
const dirs = ['uploads', 'data'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static('uploads'));

// Serve PDF file
app.get('/pdf.pdf', (req, res) => {
    const pdfPath = path.join(__dirname, 'pdf.pdf');
    console.log('Attempting to serve PDF from:', pdfPath);
    
    if (fs.existsSync(pdfPath)) {
        console.log('PDF file found, sending to client');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=registration_form.pdf');
        res.sendFile(pdfPath, (err) => {
            if (err) {
                console.error('Error sending PDF:', err);
                res.status(500).send('Error sending PDF file');
            }
        });
    } else {
        console.error('PDF file not found at:', pdfPath);
        res.status(404).send('PDF file not found');
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Initialize data storage
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

// Helper function to save data to files
function saveData() {
    fs.writeFileSync('data/photos.json', JSON.stringify(photos));
    fs.writeFileSync('data/events.json', JSON.stringify(events));
    fs.writeFileSync('data/content.json', JSON.stringify(siteContent));
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
    const newPhoto = {
        id: Date.now().toString(),
        imageUrl: `/uploads/${req.file.filename}`,
        caption: req.body.caption
    };
    photos.push(newPhoto);
    saveData();
    res.json(newPhoto);
});

app.delete('/api/photos/:id', (req, res) => {
    const photo = photos.find(p => p.id === req.params.id);
    if (photo) {
        const imagePath = path.join(__dirname, photo.imageUrl.substring(1));
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
        photos = photos.filter(p => p.id !== req.params.id);
        saveData();
        res.json({ message: 'Photo deleted successfully' });
    } else {
        res.status(404).json({ error: 'Photo not found' });
    }
});

// Events
app.get('/api/events', (req, res) => {
    res.json(events);
});

app.post('/api/events', upload.single('image'), (req, res) => {
    const newEvent = {
        id: Date.now().toString(),
        title: req.body.title,
        date: req.body.date,
        location: req.body.location,
        description: req.body.description,
        imageUrl: req.file ? `/uploads/${req.file.filename}` : null
    };
    events.push(newEvent);
    saveData();
    res.json(newEvent);
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

// Handle 404 errors
app.use((req, res) => {
    res.status(404).send('Not Found');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 