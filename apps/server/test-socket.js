// const { io } = require('socket.io-client');

// // Test Socket.IO connection
// const testSocketConnection = () => {
//   const socket = io('http://localhost:1284', {
//     auth: {
//       token: 'demo-token'
//     }
//   });

//   socket.on('connect', () => {
//     console.log('✅ Successfully connected to Socket.IO server!');
//     console.log('Socket ID:', socket.id);

//     // Test a simple event
//     socket.emit('createRoom', { roomId: 'test-room' }, (response) => {
//       console.log('✅ Room creation response:', response);
//     });
//   });

//   socket.on('connect_error', (error) => {
//     console.error('❌ Connection error:', error.message);
//   });

//   socket.on('disconnect', (reason) => {
//     console.log('🔌 Disconnected:', reason);
//   });

//   // Cleanup after 5 seconds
//   setTimeout(() => {
//     socket.disconnect();
//     process.exit(0);
//   }, 5000);
// };

// // Test HTTP health endpoint
// const testHealthEndpoint = async () => {
//   try {
//     const response = await fetch('http://localhost:1284/health');
//     const data = await response.json();
//     console.log('✅ Health check response:', data);
//   } catch (error) {
//     console.error('❌ Health check failed:', error.message);
//   }
// };

// // Run tests
// console.log('🧪 Testing Socket.IO connection...');
// testHealthEndpoint();
// testSocketConnection();
