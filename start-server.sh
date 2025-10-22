#!/bin/bash
echo "Installing backend dependencies..."
npm install

echo ""
echo "Starting backend server..."
echo "Server will be available at http://localhost:5000"
echo "Press Ctrl+C to stop the server"
echo ""

npm start

