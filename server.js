const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');

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

// Initialize serverless database
db.init().then(() => {
  console.log('Serverless database ready');
}).catch(err => {
  console.error('Error initializing database:', err);
});

// API Routes

// Get all enrollments
app.get('/api/enrollments', async (req, res) => {
  try {
    const enrollments = await db.getAllEnrollments();
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if user is enrolled in a specific course
app.get('/api/enrollments/check/:courseTitle/:email', async (req, res) => {
  try {
    const { courseTitle, email } = req.params;
    const enrollment = await db.getEnrollmentByCourseAndEmail(courseTitle, email);
    res.json({ enrolled: !!enrollment, user: enrollment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enroll user in a course
app.post('/api/enrollments', async (req, res) => {
  try {
    const { email, name, courseTitle } = req.body;
    
    if (!email || !name || !courseTitle) {
      res.status(400).json({ error: 'Email, name, and course title are required' });
      return;
    }
    
    const enrollment = await db.createEnrollment(email, name, courseTitle);
    
    res.json({
      id: enrollment.id,
      email: enrollment.email,
      name: enrollment.name,
      courseTitle: enrollment.course_title,
      enrolledAt: enrollment.enrolled_at,
      message: 'Successfully enrolled!'
    });
  } catch (err) {
    if (err.message === 'User already enrolled in this course') {
      res.status(409).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Get enrollment statistics
app.get('/api/enrollments/stats', async (req, res) => {
  try {
    const stats = await db.getEnrollmentStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contact form email endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }
    
    // Log the contact form data
    console.log('=== CONTACT FORM SUBMISSION ===');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Subject:', subject);
    console.log('Message:', message);
    console.log('Timestamp:', new Date().toISOString());
    console.log('===============================');
    
    // Store contact form data
    const submission = await db.createContactSubmission(name, email, subject, message);
    
    res.json({
      success: true,
      message: 'Thank you for your message! We will get back to you soon.',
      id: submission.id
    });
  } catch (err) {
    console.error('Error storing contact submission:', err.message);
    res.status(500).json({ error: 'Failed to store contact form' });
  }
});

// Get contact form submissions (for admin purposes)
app.get('/api/contact/submissions', async (req, res) => {
  try {
    const submissions = await db.getAllContactSubmissions();
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// Graceful shutdown (not needed for serverless)
process.on('SIGINT', () => {
  console.log('Server shutting down');
  process.exit(0);
});
