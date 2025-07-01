const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; // Use promises for async file operations
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ensure directories exist
const dirs = ['uploads', 'data'];
(async () => {
    for (const dir of dirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            console.error(`Error creating directory ${dir}:`, error);
        }
    }
})();

// Serve static files
app.use(express.static(path.join(__dirname), { maxAge: '1h' }));
app.use('/uploads', express.static('uploads', { maxAge: '1h' }));
app.use('/public', express.static('public', { maxAge: '1h' }));

// Multer configuration
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
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Initialize data
let photos = [];
let events = [];
let siteContent = {};

(async () => {
    try {
        if (await fs.access('data/photos.json').then(() => true).catch(() => false)) {
            photos = JSON.parse(await fs.readFile('data/photos.json', 'utf8'));
        }
        if (await fs.access('data/events.json').then(() => true).catch(() => false)) {
            events = JSON.parse(await fs.readFile('data/events.json', 'utf8'));
        }
        if (await fs.access('data/content.json').then(() => true).catch(() => false)) {
            siteContent = JSON.parse(await fs.readFile('data/content.json', 'utf8'));
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
})();

async function saveData() {
    try {
        await fs.mkdir('data', { recursive: true });
        await Promise.all([
            fs.writeFile('data/photos.json', JSON.stringify(photos, null, 2)),
            fs.writeFile('data/events.json', JSON.stringify(events, null, 2)),
            fs.writeFile('data/content.json', JSON.stringify(siteContent, null, 2))
        ]);
    } catch (error) {
        console.error('Error saving data:', error);
        throw error;
    }
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Photos
app.get('/api/photos', (req, res) => res.json(photos));

app.post('/api/photos', upload.single('image'), async (req, res) => {
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
        await saveData();
        res.json(newPhoto);
    } catch (error) {
        console.error('Error in photo upload:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

app.delete('/api/photos/:id', async (req, res) => {
    try {
        const photo = photos.find(p => p.id === req.params.id);
        if (!photo) return res.status(404).json({ error: 'Photo not found' });

        // Extract filename from imageUrl
        const filename = photo.imageUrl.split('/uploads/')[1];
        const imagePath = path.join(__dirname, 'uploads', filename);
        try {
            await fs.access(imagePath);
            await fs.unlink(imagePath);
        } catch (error) {
            console.warn(`Image file not found or could not be deleted: ${imagePath}`);
        }

        photos = photos.filter(p => p.id !== req.params.id);
        await saveData();
        res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

// Events
app.get('/api/events', (req, res) => res.json(events));

app.post('/api/events', upload.single('image'), async (req, res) => {
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
        await saveData();
        res.json(newEvent);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

app.put('/api/events/:id', upload.single('image'), async (req, res) => {
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
                const filename = events[eventIndex].imageUrl.split('/uploads/')[1];
                const oldImagePath = path.join(__dirname, 'uploads', filename);
                try {
                    await fs.access(oldImagePath);
                    await fs.unlink(oldImagePath);
                } catch (error) {
                    console.warn(`Old event image not found or could not be deleted: ${oldImagePath}`);
                }
            }
            updatedEvent.imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
        }

        events[eventIndex] = updatedEvent;
        await saveData();
        res.json(updatedEvent);
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

app.delete('/api/events/:id', async (req, res) => {
    try {
        const eventIndex = events.findIndex(e => e.id === req.params.id);
        if (eventIndex === -1) return res.status(404).json({ error: 'Event not found' });

        if (events[eventIndex].imageUrl) {
            const filename = events[eventIndex].imageUrl.split('/uploads/')[1];
            const imagePath = path.join(__dirname, 'uploads', filename);
            try {
                await fs.access(imagePath);
                await fs.unlink(imagePath);
            } catch (error) {
                console.warn(`Event image not found or could not be deleted: ${imagePath}`);
            }
        }

        events.splice(eventIndex, 1);
        await saveData();
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Content
app.get('/api/content', (req, res) => res.json(siteContent));

app.post('/api/content', async (req, res) => {
    try {
        siteContent = { ...siteContent, ...req.body };
        await saveData();
        res.json(siteContent);
    } catch (error) {
        console.error('Error saving content:', error);
        res.status(500).json({ error: 'Failed to save content' });
    }
});

// Endpoint to list all images in uploads directory
app.get('/api/all-uploads', async (req, res) => {
    try {
        const files = await fs.readdir(path.join(__dirname, 'uploads'));
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const imageUrls = imageFiles.map(file => {
            // Find if this image has a caption in the photos collection
            const photo = photos.find(p => p.imageUrl.includes(file));
            return {
                imageUrl: `${baseUrl}/uploads/${file}`,
                caption: photo?.caption || 'Gallery Image'
            };
        });
        res.json(imageUrls);
    } catch (error) {
        console.error('Error reading uploads directory:', error);
        res.status(500).json({ error: 'Failed to read uploads directory' });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large. Maximum size is 5MB.' });
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => res.status(404).send('Not Found'));

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running locally at http://localhost:${port}`);
});