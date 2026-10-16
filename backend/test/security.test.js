import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { after, before, test } from 'node:test';

const { app } = await import('../src/app.js');
const { prisma } = await import('../src/lib/prisma.js');

let server;
let baseUrl;
let studentToken;
let superAdminToken;
let superAdminId;
let adminToken;
let studentId;
let adminId;
let bookingId;

before(async () => {
  const admin = await prisma.user.create({
    data: {
      name: 'Test Root',
      email: process.env.SUPER_ADMIN_EMAIL,
      password: await bcrypt.hash('test-super-admin-password', 12),
      role: 'SuperAdmin',
      status: 'APPROVED'
    }
  });
  superAdminId = admin.id;
  const counselor = await prisma.user.create({
    data: {
      name: 'Test Counselor',
      email: 'counselor@example.test',
      password: await bcrypt.hash('test-counselor-password', 12),
      role: 'Admin',
      status: 'APPROVED'
    }
  });
  adminId = counselor.id;
  await prisma.user.create({
    data: {
      name: 'Legacy Student',
      email: 'legacy@example.test',
      password: 'legacy-password',
      role: 'Student',
      status: 'PENDING'
    }
  });

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}/api`;

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: admin.email, password: 'test-super-admin-password' })
  });
  assert.equal(response.status, 200);
  superAdminToken = (await response.json()).token;

  const adminLoginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: counselor.email, password: 'test-counselor-password' })
  });
  assert.equal(adminLoginResponse.status, 200);
  adminToken = (await adminLoginResponse.json()).token;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await prisma.$disconnect();
});

test('registration hashes passwords and issues a server token', async () => {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Student',
      email: 'student@example.test',
      password: 'test-student-password',
      role: 'Student'
    })
  });
  const data = await response.json();

  assert.equal(response.status, 201);
  assert.equal(typeof data.token, 'string');
  assert.equal(Object.hasOwn(data.user, 'password'), false);

  studentToken = data.token;
  studentId = data.user.id;
  const storedUser = await prisma.user.findUnique({ where: { email: 'student@example.test' } });
  assert.notEqual(storedUser.password, 'test-student-password');
  assert.equal(await bcrypt.compare('test-student-password', storedUser.password), true);
});

test('registration rejects attempts to create a super-admin role', async () => {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Attacker',
      email: 'attacker@example.test',
      password: 'attacker-password-123',
      role: 'SuperAdmin'
    })
  });

  assert.equal(response.status, 400);
});

test('successful login upgrades a legacy plaintext password to a hash', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'legacy@example.test', password: 'legacy-password' })
  });

  assert.equal(response.status, 200);
  assert.equal(typeof (await response.json()).token, 'string');
  const storedUser = await prisma.user.findUnique({ where: { email: 'legacy@example.test' } });
  assert.notEqual(storedUser.password, 'legacy-password');
  assert.equal(await bcrypt.compare('legacy-password', storedUser.password), true);
});

test('user records require a super-admin token and never return password hashes', async () => {
  const unauthenticated = await fetch(`${baseUrl}/users`);
  assert.equal(unauthenticated.status, 401);

  const studentResponse = await fetch(`${baseUrl}/users`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert.equal(studentResponse.status, 403);

  const adminResponse = await fetch(`${baseUrl}/users`, {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert.equal(adminResponse.status, 200);
  const users = await adminResponse.json();
  assert.equal(users.length, 4);
  assert.equal(users.every((user) => !Object.hasOwn(user, 'password')), true);
});

test('admin can claim a pending student once and student profile returns assigned admin', async () => {
  const response = await fetch(`${baseUrl}/users/students/${studentId}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(response.status, 200);

  const duplicateResponse = await fetch(`${baseUrl}/users/students/${studentId}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(duplicateResponse.status, 409);

  const profileResponse = await fetch(`${baseUrl}/auth/profile`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  const profile = await profileResponse.json();
  assert.equal(profile.user.assignedAdmin.id, adminId);
});

test('student can create an owned booking; assigned admin can accept and message it', async () => {
  const createResponse = await fetch(`${baseUrl}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`
    },
    body: JSON.stringify({ slot: '09:00 AM - 10:00 AM', type: 'chat' })
  });
  assert.equal(createResponse.status, 201);
  const booking = await createResponse.json();
  assert.equal(booking.studentId, studentId);
  assert.equal(booking.adminId, adminId);
  bookingId = booking.id;

  const anotherPendingBooking = await fetch(`${baseUrl}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`
    },
    body: JSON.stringify({ slot: '10:00 AM - 11:00 AM', type: 'call' })
  });
  assert.equal(anotherPendingBooking.status, 409);

  const acceptResponse = await fetch(`${baseUrl}/bookings/${bookingId}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(acceptResponse.status, 200);

  const messageResponse = await fetch(`${baseUrl}/bookings/${bookingId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`
    },
    body: JSON.stringify({ body: 'Please confirm the meeting.' })
  });
  assert.equal(messageResponse.status, 201);

  const adminBookings = await fetch(`${baseUrl}/bookings`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const [adminBooking] = await adminBookings.json();
  assert.equal(adminBooking.messages[0].body, 'Please confirm the meeting.');
});

test('session records are available only to super admins', async () => {
  const unauthenticatedResponse = await fetch(`${baseUrl}/bookings/records`);
  assert.equal(unauthenticatedResponse.status, 401);

  const studentResponse = await fetch(`${baseUrl}/bookings/records`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert.equal(studentResponse.status, 403);

  const adminResponse = await fetch(`${baseUrl}/bookings/records`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminResponse.status, 403);

  const superAdminResponse = await fetch(`${baseUrl}/bookings/records`, {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert.equal(superAdminResponse.status, 200);
  const [record] = await superAdminResponse.json();
  assert.equal(record.id, bookingId);
  assert.equal(record.messages[0].body, 'Please confirm the meeting.');
});

test('sensitive write routes require an authorized role', async () => {
  const unauthenticated = await fetch(`${baseUrl}/colleges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Private College' })
  });
  assert.equal(unauthenticated.status, 401);

  const studentResponse = await fetch(`${baseUrl}/colleges`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert.equal(studentResponse.status, 403);

  const collegeCreateResponse = await fetch(`${baseUrl}/colleges`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ name: 'Test College', cutoff: '1000', location: 'Test City' })
  });
  assert.equal(collegeCreateResponse.status, 201);
  const college = await collegeCreateResponse.json();
  assert.equal(college.cutoff, '1000');

  const bookingResponse = await fetch(`${baseUrl}/bookings`);
  assert.equal(bookingResponse.status, 401);
});

test('only a super admin can remove students and admins while retaining booking history', async () => {
  const assignedStudent = await prisma.user.create({
    data: {
      name: 'Student for removal',
      email: 'remove-student@example.test',
      password: 'test-password',
      role: 'Student',
      status: 'APPROVED',
      assignedAdminId: adminId
    }
  });
  const retainedBooking = await prisma.booking.create({
    data: {
      userId: assignedStudent.id,
      adminId: adminId,
      studentName: assignedStudent.name,
      status: 'PENDING'
    }
  });

  const forbiddenResponse = await fetch(`${baseUrl}/users/${assignedStudent.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert.equal(forbiddenResponse.status, 403);

  const removeStudentResponse = await fetch(`${baseUrl}/users/${assignedStudent.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert.equal(removeStudentResponse.status, 204);
  assert.equal(await prisma.user.findUnique({ where: { id: assignedStudent.id } }), null);
  const studentBooking = await prisma.booking.findUnique({ where: { id: retainedBooking.id } });
  assert.equal(studentBooking.userId, null);
  assert.equal(studentBooking.studentName, assignedStudent.name);

  const removeAdminResponse = await fetch(`${baseUrl}/users/${adminId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert.equal(removeAdminResponse.status, 204);
  assert.equal(await prisma.user.findUnique({ where: { id: adminId } }), null);
  const adminBooking = await prisma.booking.findUnique({ where: { id: retainedBooking.id } });
  assert.equal(adminBooking.adminId, null);

  const removeSuperAdminResponse = await fetch(`${baseUrl}/users/${superAdminId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert.equal(removeSuperAdminResponse.status, 404);
  assert.notEqual(await prisma.user.findUnique({ where: { id: superAdminId } }), null);
});
