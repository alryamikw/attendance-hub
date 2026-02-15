import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';

const PORT = 3003;

// Store connected clients by tenant and user
interface ConnectedClient {
  socketId: string;
  userId: string;
  tenantId: string;
  role: string;
  employeeId?: string;
  branchId?: string;
}

const connectedClients = new Map<string, ConnectedClient>();
const tenantRooms = new Map<string, Set<string>>(); // tenantId -> Set of socketIds

// Create HTTP server
const httpServer = new HttpServer();

// Create Socket.IO server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Authentication middleware
io.use((socket: Socket, next) => {
  const userId = socket.handshake.auth.userId;
  const tenantId = socket.handshake.auth.tenantId;
  const role = socket.handshake.auth.role;
  const employeeId = socket.handshake.auth.employeeId;
  const branchId = socket.handshake.auth.branchId;
  
  if (!userId || !tenantId) {
    return next(new Error('Authentication required'));
  }
  
  // Store auth data in socket
  (socket as any).auth = {
    userId,
    tenantId,
    role,
    employeeId,
    branchId,
  };
  
  next();
});

// Handle connections
io.on('connection', (socket: Socket) => {
  const auth = (socket as any).auth;
  console.log(`Client connected: ${socket.id} (User: ${auth.userId}, Tenant: ${auth.tenantId})`);
  
  // Store client
  connectedClients.set(socket.id, {
    socketId: socket.id,
    userId: auth.userId,
    tenantId: auth.tenantId,
    role: auth.role,
    employeeId: auth.employeeId,
    branchId: auth.branchId,
  });
  
  // Join tenant room
  socket.join(`tenant:${auth.tenantId}`);
  
  // Join role room
  socket.join(`role:${auth.tenantId}:${auth.role}`);
  
  // Join branch room if applicable
  if (auth.branchId) {
    socket.join(`branch:${auth.tenantId}:${auth.branchId}`);
  }
  
  // Notify tenant admins of new connection
  io.to(`role:${auth.tenantId}:company_admin`).emit('user:connected', {
    userId: auth.userId,
    timestamp: new Date().toISOString(),
  });
  
  // ==========================================
  // ATTENDANCE EVENTS
  // ==========================================
  
  socket.on('attendance:checkin', (data) => {
    console.log(`Check-in event from ${auth.userId}:`, data);
    
    // Broadcast to tenant admins and branch admins
    io.to(`role:${auth.tenantId}:company_admin`).emit('attendance:checked_in', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    
    if (auth.branchId) {
      io.to(`branch:${auth.tenantId}:${auth.branchId}`).emit('attendance:checked_in', {
        ...data,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Update live dashboard count
    broadcastLiveStats(auth.tenantId);
  });
  
  socket.on('attendance:checkout', (data) => {
    console.log(`Check-out event from ${auth.userId}:`, data);
    
    io.to(`role:${auth.tenantId}:company_admin`).emit('attendance:checked_out', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    
    if (auth.branchId) {
      io.to(`branch:${auth.tenantId}:${auth.branchId}`).emit('attendance:checked_out', {
        ...data,
        timestamp: new Date().toISOString(),
      });
    }
    
    broadcastLiveStats(auth.tenantId);
  });
  
  socket.on('attendance:break_start', (data) => {
    socket.to(`tenant:${auth.tenantId}`).emit('attendance:on_break', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  });
  
  socket.on('attendance:break_end', (data) => {
    socket.to(`tenant:${auth.tenantId}`).emit('attendance:back_from_break', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  });
  
  // ==========================================
  // LOCATION TRACKING
  // ==========================================
  
  socket.on('location:update', (data) => {
    // Store last known location
    if (connectedClients.has(socket.id)) {
      const client = connectedClients.get(socket.id)!;
      // Broadcast to admins for tracking
      io.to(`role:${auth.tenantId}:company_admin`).emit('employee:location', {
        employeeId: auth.employeeId,
        ...data,
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  // ==========================================
  // LIVE STATS REQUEST
  // ==========================================
  
  socket.on('stats:request', async () => {
    const stats = await getLiveStats(auth.tenantId);
    socket.emit('stats:live', stats);
  });
  
  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  
  socket.on('notification:send', (data) => {
    const { targetUserId, type, title, message } = data;
    
    // Find target user's socket
    for (const [socketId, client] of connectedClients.entries()) {
      if (client.userId === targetUserId) {
        io.to(socketId).emit('notification:received', {
          type,
          title,
          message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });
  
  // ==========================================
  // ADMIN ACTIONS
  // ==========================================
  
  socket.on('admin:broadcast', (data) => {
    if (auth.role !== 'company_admin' && auth.role !== 'platform_owner') {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }
    
    io.to(`tenant:${auth.tenantId}`).emit('admin:announcement', {
      ...data,
      from: auth.userId,
      timestamp: new Date().toISOString(),
    });
  });
  
  // ==========================================
  // DISCONNECT
  // ==========================================
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    const client = connectedClients.get(socket.id);
    if (client) {
      // Notify admins of disconnection
      io.to(`role:${client.tenantId}:company_admin`).emit('user:disconnected', {
        userId: client.userId,
        timestamp: new Date().toISOString(),
      });
    }
    
    connectedClients.delete(socket.id);
  });
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function broadcastLiveStats(tenantId: string) {
  // Get connected users for this tenant
  const tenantClients = Array.from(connectedClients.values())
    .filter(c => c.tenantId === tenantId);
  
  const stats = {
    online: tenantClients.length,
    timestamp: new Date().toISOString(),
  };
  
  io.to(`tenant:${tenantId}`).emit('stats:live', stats);
}

async function getLiveStats(tenantId: string) {
  const tenantClients = Array.from(connectedClients.values())
    .filter(c => c.tenantId === tenantId);
  
  return {
    online: tenantClients.length,
    users: tenantClients.map(c => ({
      userId: c.userId,
      role: c.role,
      branchId: c.branchId,
    })),
    timestamp: new Date().toISOString(),
  };
}

// Health check endpoint
import { createServer } from 'http';

const healthServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      connectedClients: connectedClients.size,
      uptime: process.uptime(),
    }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

healthServer.listen(PORT + 1, () => {
  console.log(`Health check server running on port ${PORT + 1}`);
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🔌 Real-time service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT + 1}/health`);
});

export { io, connectedClients };
