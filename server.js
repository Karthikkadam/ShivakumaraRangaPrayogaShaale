const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dirs = ['uploads', 'data'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

app.use(express.static(path.join(__dirname), { maxAge: '1h' }));
app.use('/uploads', express.static('uploads', { maxAge: '1h' }));
app.use('/public', express.static('public', { maxAge: '1h' }));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed!'));
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

let photos = [];
let events = [];
let siteContent = {};

try {
    if (fs.existsSync('data/photos.json')) photos = JSON.parse(fs.readFileSync('data/photos.json'));
    if (fs.existsSync('data/events.json')) events = JSON.parse(fs.readFileSync('data/events.json'));
    if (fs.existsSync('data/content.json')) siteContent = JSON.parse(fs.readFileSync('data/content.json'));
} catch (error) {
    console.error('Error loading data:', error);
}

function saveData() {
    try {
        if (!fs.existsSync('data')) fs.mkdirSync('data');
        fs.writeFileSync('data/photos.json', JSON.stringify(photos, null, 2));
        fs.writeFileSync('data/events.json', JSON.stringify(events, null, 2));
        fs.writeFileSync('data/content.json', JSON.stringify(siteContent, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Photos
app.get('/api/photos', (req, res) => res.json(photos));

app.post('/api/photos', upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
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

app.delete('/api/photos/:id', (req, res) => {
    try {
        const photo = photos.find(p => p.id === req.params.id);
        if (!photo) return res.status(404).json({ error: 'Photo not found' });
        const imagePath = path.join(__dirname, photo.imageUrl.split('/uploads/')[1]);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        photos = photos.filter(p => p.id !== req.params.id);
        saveData();
        res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

// Events
app.get('/api/events', (req, res) => res.json(events));

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

app.put('/api/events/:id', upload.single('image'), (req, res) => {
    try {
        const eventIndex = events.findIndex(e => e.id === req.params.id);
        if (eventIndex === -1) return res.status(404).json({ error: 'Event not found' });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const updatedEvent = {
            ...events[eventIndex],
            title: req.body.title,
            date: req.body.date,
            location: req.body.location,
            description: req.body.description,
            dateUpdated: new Date().toISOString()
        };

        if (req.file) {
            if (events[eventIndex].imageUrl) {
                const oldImagePath = path.join(__dirname, events[eventIndex].imageUrl.split('/uploads/')[1]);
                if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
            }
            updatedEvent.imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
        }

        events[eventIndex] = updatedEvent;
        saveData();
        res.json(updatedEvent);
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

app.delete('/api/events/:id', (req, res) => {
    try {
        const eventIndex = events.findIndex(e => e.id === req.params.id);
        if (eventIndex === -1) return res.status(404).json({ error: 'Event not found' });

        if (events[eventIndex].imageUrl) {
            const imagePath = path.join(__dirname, events[eventIndex].imageUrl.split('/uploads/')[1]);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }

        events.splice(eventIndex, 1);
        saveData();
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Content
app.get('/api/content', (req, res) => res.json(siteContent));

app.post('/api/content', (req, res) => {
    siteContent = { ...siteContent, ...req.body };
    saveData();
    res.json(siteContent);
});

app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large. Maximum size is 5MB.' });
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => res.status(404).send('Not Found'));

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running locally at http://localhost:${port}`);
});