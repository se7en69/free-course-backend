// Serverless-compatible database module for Vercel
// Uses JSON file storage that works in serverless environments

const fs = require('fs').promises;
const path = require('path');

class ServerlessDatabase {
  constructor() {
    // Use /tmp for Vercel serverless, local directory for development
    const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
    const baseDir = isVercel ? '/tmp' : './data';
    
    this.dataFile = `${baseDir}/enrollments.json`;
    this.contactFile = `${baseDir}/contact.json`;
    this.data = {
      enrollments: [],
      contactSubmissions: []
    };
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      // Try to load existing data
      const enrollmentsData = await fs.readFile(this.dataFile, 'utf8').catch(() => '{"enrollments": []}');
      const contactData = await fs.readFile(this.contactFile, 'utf8').catch(() => '{"contactSubmissions": []}');
      
      this.data.enrollments = JSON.parse(enrollmentsData).enrollments || [];
      this.data.contactSubmissions = JSON.parse(contactData).contactSubmissions || [];
      
      this.initialized = true;
      console.log('Serverless database initialized');
    } catch (error) {
      console.error('Error initializing database:', error);
      // Start with empty data
      this.data = {
        enrollments: [],
        contactSubmissions: []
      };
      this.initialized = true;
    }
  }

  async saveEnrollments() {
    try {
      await fs.writeFile(this.dataFile, JSON.stringify({ enrollments: this.data.enrollments }));
    } catch (error) {
      console.error('Error saving enrollments:', error);
    }
  }

  async saveContact() {
    try {
      await fs.writeFile(this.contactFile, JSON.stringify({ contactSubmissions: this.data.contactSubmissions }));
    } catch (error) {
      console.error('Error saving contact submissions:', error);
    }
  }

  // Enrollment methods
  async getAllEnrollments() {
    await this.init();
    return this.data.enrollments.sort((a, b) => new Date(b.enrolled_at) - new Date(a.enrolled_at));
  }

  async getEnrollmentByCourseAndEmail(courseTitle, email) {
    await this.init();
    return this.data.enrollments.find(
      enrollment => enrollment.course_title === courseTitle && enrollment.email === email
    );
  }

  async createEnrollment(email, name, courseTitle) {
    await this.init();
    
    // Check if already enrolled
    const existing = await this.getEnrollmentByCourseAndEmail(courseTitle, email);
    if (existing) {
      throw new Error('User already enrolled in this course');
    }

    const enrollment = {
      id: Date.now(), // Simple ID generation
      email,
      name,
      course_title: courseTitle,
      enrolled_at: new Date().toISOString()
    };

    this.data.enrollments.push(enrollment);
    await this.saveEnrollments();
    
    return enrollment;
  }

  async getEnrollmentStats() {
    await this.init();
    
    const totalEnrollments = this.data.enrollments.length;
    const uniqueUsers = new Set(this.data.enrollments.map(e => e.email)).size;
    
    // Group by course
    const byCourse = {};
    this.data.enrollments.forEach(enrollment => {
      const course = enrollment.course_title;
      byCourse[course] = (byCourse[course] || 0) + 1;
    });

    const enrollmentsByCourse = Object.entries(byCourse)
      .map(([course_title, enrollments]) => ({ course_title, enrollments }))
      .sort((a, b) => b.enrollments - a.enrollments);

    return {
      totalEnrollments,
      uniqueUsers,
      enrollmentsByCourse
    };
  }

  // Contact form methods
  async createContactSubmission(name, email, subject, message) {
    await this.init();
    
    const submission = {
      id: Date.now(),
      name,
      email,
      subject,
      message,
      submitted_at: new Date().toISOString()
    };

    this.data.contactSubmissions.push(submission);
    await this.saveContact();
    
    return submission;
  }

  async getAllContactSubmissions() {
    await this.init();
    return this.data.contactSubmissions.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  }
}

// Create singleton instance
const db = new ServerlessDatabase();

module.exports = db;
