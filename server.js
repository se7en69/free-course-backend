const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Configure CORS for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://learnbioinformatics.online',
      'https://free-course-frontend.onrender.com',
      'https://free-course-frontend.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'enrollments.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create enrollments table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    course_title TEXT NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, course_title)
  )`, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('Enrollments table ready');
    }
  });
});

// API Routes

// Get all enrollments
app.get('/api/enrollments', (req, res) => {
  db.all('SELECT * FROM enrollments ORDER BY enrolled_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Check if user is enrolled in a specific course
app.get('/api/enrollments/check/:courseTitle/:email', (req, res) => {
  const { courseTitle, email } = req.params;
  
  db.get(
    'SELECT * FROM enrollments WHERE course_title = ? AND email = ?',
    [courseTitle, email],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ enrolled: !!row, user: row });
    }
  );
});

// Enroll user in a course
app.post('/api/enrollments', (req, res) => {
  const { email, name, courseTitle } = req.body;
  
  if (!email || !name || !courseTitle) {
    res.status(400).json({ error: 'Email, name, and course title are required' });
    return;
  }
  
  // Check if already enrolled
  db.get(
    'SELECT * FROM enrollments WHERE course_title = ? AND email = ?',
    [courseTitle, email],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (row) {
        res.status(409).json({ error: 'User already enrolled in this course' });
        return;
      }
      
      // Insert new enrollment
      db.run(
        'INSERT INTO enrollments (email, name, course_title) VALUES (?, ?, ?)',
        [email, name, courseTitle],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          res.json({
            id: this.lastID,
            email,
            name,
            courseTitle,
            enrolledAt: new Date().toISOString(),
            message: 'Successfully enrolled!'
          });
        }
      );
    }
  );
});

// Get enrollment statistics
app.get('/api/enrollments/stats', (req, res) => {
  const queries = [
    'SELECT COUNT(*) as total_enrollments FROM enrollments',
    'SELECT COUNT(DISTINCT email) as unique_users FROM enrollments',
    'SELECT course_title, COUNT(*) as enrollments FROM enrollments GROUP BY course_title ORDER BY enrollments DESC'
  ];
  
  Promise.all(queries.map(query => 
    new Promise((resolve, reject) => {
      db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    })
  )).then(([total, unique, byCourse]) => {
    res.json({
      totalEnrollments: total[0].total_enrollments,
      uniqueUsers: unique[0].unique_users,
      enrollmentsByCourse: byCourse
    });
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

// Contact form email endpoint
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  
  if (!name || !email || !subject || !message) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }
  
  // For now, we'll just log the contact form data
  // In production, you would integrate with an email service like SendGrid, Nodemailer, etc.
  console.log('=== CONTACT FORM SUBMISSION ===');
  console.log('Name:', name);
  console.log('Email:', email);
  console.log('Subject:', subject);
  console.log('Message:', message);
  console.log('Timestamp:', new Date().toISOString());
  console.log('===============================');
  
  // Store contact form data in database
  db.run(
    'CREATE TABLE IF NOT EXISTS contact_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, subject TEXT, message TEXT, submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    (err) => {
      if (err) {
        console.error('Error creating contact table:', err.message);
      }
    }
  );
  
  db.run(
    'INSERT INTO contact_submissions (name, email, subject, message) VALUES (?, ?, ?, ?)',
    [name, email, subject, message],
    function(err) {
      if (err) {
        console.error('Error storing contact submission:', err.message);
        res.status(500).json({ error: 'Failed to store contact form' });
        return;
      }
      
      res.json({
        success: true,
        message: 'Thank you for your message! We will get back to you soon.',
        id: this.lastID
      });
    }
  );
});

// Get contact form submissions (for admin purposes)
app.get('/api/contact/submissions', (req, res) => {
  db.all('SELECT * FROM contact_submissions ORDER BY submitted_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Export for Vercel
module.exports = app;

// Start server (only if not in Vercel environment)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api/`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed');
    process.exit(0);
  });
});
