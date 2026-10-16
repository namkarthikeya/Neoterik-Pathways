import React, { useState, useEffect } from 'react';
import './App.css';
import logo from '../../logo.jpeg';

const configuredApiHost = import.meta.env.VITE_API_BASE_URL?.trim();
const apiOrigin = configuredApiHost
  ? (/^https?:\/\//i.test(configuredApiHost) ? configuredApiHost : `https://${configuredApiHost}`)
  : (import.meta.env.DEV ? 'http://localhost:4000' : '');
const API_BASE = apiOrigin
  ? `${apiOrigin.replace(/\/+$/, '')}${apiOrigin.replace(/\/+$/, '').endsWith('/api') ? '' : '/api'}`
  : '';
const LEGACY_STORAGE_KEY = 'neoterik_pathways_users';
const REGISTERED_FLAG_KEY = 'neoterik_pathways_has_account';
const SESSION_TOKEN_KEY = 'neoterik_pathways_session_token';
const CLASS_OPTIONS = [
  '6th Completed Class',
  '7th Completed Class',
  '8th Completed Class',
  '9th Completed Class',
  '10th Completed Class',
  '11th Completed Class',
  '12th Completed Class'
];
const DEGREE_OPTIONS = [
  'B.Tech',
  'B.E.',
  'B.Sc',
  'B.Com',
  'B.A.',
  'M.Tech',
  'M.Sc',
  'MBA',
  'Other'
];
const SLOT_OPTIONS = [
  '09:00 AM - 10:00 AM',
  '10:00 AM - 11:00 AM',
  '11:00 AM - 12:00 PM',
  '12:00 PM - 01:00 PM',
  '01:00 PM - 02:00 PM',
  '02:00 PM - 03:00 PM',
  '03:00 PM - 04:00 PM',
  '04:00 PM - 05:00 PM',
  '05:00 PM - 06:00 PM',
  '06:00 PM - 07:00 PM',
  '07:00 PM - 08:00 PM',
  '08:00 PM - 09:00 PM'
];

const normalizeEmail = (value) => (value || '').trim().toLowerCase();

const authHeaders = (token, headers = {}) => ({
  ...headers,
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});

const buildUserRecord = (payload) => {
  const email = normalizeEmail(payload.email);
  return {
    id: payload.id || `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: (payload.name || 'User').trim(),
    email,
    mobile: payload.mobile || '',
    presentClass: payload.presentClass || null,
    degree: payload.degree || null,
    role: payload.role || 'Student',
    status: payload.status || 'PENDING'
  };
};

const requestApi = async (path, token, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: authHeaders(token, options.headers || {})
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
};

const getInitialAuthMode = () => {
  try {
    const legacyUsers = localStorage.getItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const saved = JSON.parse(legacyUsers || '[]');
    const hasAccount = localStorage.getItem(REGISTERED_FLAG_KEY) === 'true'
      || (Array.isArray(saved) && saved.length > 0);
    if (hasAccount) localStorage.setItem(REGISTERED_FLAG_KEY, 'true');
    return hasAccount ? 'login' : 'register';
  } catch {
    return 'register';
  }
};

export default function App() {
  // Navigation & Session State
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [isRestoringSession, setIsRestoringSession] = useState(() => Boolean(localStorage.getItem(SESSION_TOKEN_KEY)));
  const [authMode, setAuthMode] = useState(getInitialAuthMode); // 'login' or 'register'

  // Auth Form Inputs
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authMobile, setAuthMobile] = useState('');
  const [authRole, setAuthRole] = useState('Student');
  const [authClass, setAuthClass] = useState('12th Completed Class');
  const [authDegree, setAuthDegree] = useState('B.Tech');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', mobile: '', presentClass: '', degree: '', password: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [dashboardError, setDashboardError] = useState('');

  const authPalette = (() => {
    const selectedRole = authMode === 'register' ? authRole : null;

    if (selectedRole === 'SuperAdmin') {
      return {
        pageBg: 'linear-gradient(135deg, #f7f3ff 0%, #efe7ff 100%)',
        cardBg: '#ffffff',
        primary: '#5b3aa6',
        accent: '#efe7ff',
        border: '#d9ccff',
        title: '#2a1b4d'
      };
    }

    if (selectedRole === 'Admin') {
      return {
        pageBg: 'linear-gradient(135deg, #edf9f4 0%, #e5f3eb 100%)',
        cardBg: '#ffffff',
        primary: '#236b4a',
        accent: '#e9f7ef',
        border: '#cfe9dc',
        title: '#1f4d3a'
      };
    }

    return {
      pageBg: 'linear-gradient(135deg, #eff6ff 0%, #edf4ff 100%)',
      cardBg: '#ffffff',
      primary: '#0f4c81',
      accent: '#eaf2ff',
      border: '#d7e7ff',
      title: '#173d5b'
    };
  })();

  // Page 2: Student Dashboard State
  const [assignedAdmin, setAssignedAdmin] = useState(null);
  const [bookingSlot, setBookingSlot] = useState('09:00 AM - 10:00 AM');
  const [bookingType, setBookingType] = useState('chat');
  const [bookingMsg, setBookingMsg] = useState('');
  const [bookingRequests, setBookingRequests] = useState([]);
  const [messageDrafts, setMessageDrafts] = useState({});
  const [openConversations, setOpenConversations] = useState({});
  // Page 3: Admin Dashboard State
  const [pendingSlots, setPendingSlots] = useState([]);
  const [myStudents, setMyStudents] = useState([]);

  // Page 4: Super Admin State
  const [allAdmins, setAllAdmins] = useState([]);
  const [studentMatrix, setStudentMatrix] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [newCollege, setNewCollege] = useState({ name: '', cutoff: '', location: '' });
  const [allUsers, setAllUsers] = useState([]);
  const [bookingRecords, setBookingRecords] = useState([]);

  useEffect(() => {
    if (!token) return undefined;

    let active = true;
    const restoreSession = async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/profile`, {
          headers: authHeaders(token)
        });
        const data = await response.json().catch(() => ({}));
        if (!active) return;

        if (response.status === 401) {
          localStorage.removeItem(SESSION_TOKEN_KEY);
          setToken(null);
          setUser(null);
          setAuthError(data.error || 'Your session expired. Please log in again.');
          return;
        }
        if (!response.ok || !data.user) {
          throw new Error(data.error || 'Unable to restore your session.');
        }

        setUser(buildUserRecord(data.user));
        setAssignedAdmin(data.user.assignedAdmin || null);
      } catch (error) {
        if (!active) return;
        setAuthError(error instanceof Error ? error.message : 'Unable to restore your session.');
      } finally {
        if (active) setIsRestoringSession(false);
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, [token]);

  // Handle Login & Registration
  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthNotice('');

    const email = normalizeEmail(authEmail);
    const password = authPassword;

    try {
      const isLogin = authMode === 'login';
      if (!isLogin && !authName.trim()) {
        setAuthError('Full name is required.');
        return;
      }
      if (!email || !password) {
        setAuthError('Email and password are required.');
        return;
      }

      const response = await fetch(`${API_BASE}/auth/${isLogin ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLogin ? { email, password } : {
          name: authName,
          email,
          password,
          mobile: authMobile,
          presentClass: authRole === 'Student' ? authClass : null,
          degree: authRole === 'Student' ? authDegree : null,
          role: authRole
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || (isLogin ? 'Login failed' : 'Registration failed'));
      }
      if (!data.user) {
        throw new Error('The server returned an invalid account response.');
      }

      if (isLogin) {
        if (!data.token) throw new Error('The server did not issue a sign-in token.');
        const loggedInUser = buildUserRecord(data.user);
        localStorage.setItem(REGISTERED_FLAG_KEY, 'true');
        localStorage.setItem(SESSION_TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(loggedInUser);
        return;
      }

      const newUser = buildUserRecord(data.user);
      localStorage.setItem(REGISTERED_FLAG_KEY, 'true');

      if (newUser.role === 'Admin') {
        setAuthEmail(email);
        setAuthPassword('');
        setAuthMode('login');
        setAuthNotice('Registration received. You can log in after the super admin approves your account.');
        return;
      }

      if (!data.token) throw new Error('The server did not issue a sign-in token.');
      localStorage.setItem(SESSION_TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(newUser);
      setAuthMode('login');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to connect to the authentication service.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setDashboardError('');
  };

  const handleOpenProfile = () => {
    setProfileForm({
      name: user.name || '',
      mobile: user.mobile || '',
      presentClass: user.presentClass || CLASS_OPTIONS[CLASS_OPTIONS.length - 1],
      degree: user.degree || DEGREE_OPTIONS[0],
      password: ''
    });
    setProfileMessage('');
    setProfileError('');
    setProfileOpen(true);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setProfileMessage('');
    setProfileError('');

    const name = profileForm.name.trim();
    const mobile = profileForm.mobile.trim();
    if (!name || !mobile) {
      setProfileError('Name and mobile number are required.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PATCH',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name,
          mobile,
          ...(user.role === 'Student' ? { presentClass: profileForm.presentClass, degree: profileForm.degree } : {}),
          ...(profileForm.password.trim() ? { password: profileForm.password } : {})
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.user) {
        throw new Error(data.error || 'Unable to update your profile.');
      }

      const updatedUser = buildUserRecord(data.user);
      setUser(updatedUser);
      if (updatedUser.role === 'Student') {
        setAssignedAdmin(data.user.assignedAdmin || null);
      }
      setProfileForm((currentForm) => ({ ...currentForm, password: '' }));
      setProfileMessage('Profile updated successfully.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to update your profile.');
    }
  };

  // Load dashboard data from the authenticated API.
  useEffect(() => {
    if (!token || !user?.id || !user?.role) return;

    let active = true;
    const refreshDashboardData = async () => {
      setDashboardError('');
      try {
        if (user.role === 'Student') {
          const [profile, bookings] = await Promise.all([
            requestApi('/auth/profile', token),
            requestApi('/bookings', token)
          ]);
          if (!active) return;
          const updatedUser = buildUserRecord(profile.user);
          setUser(updatedUser);
          setAssignedAdmin(profile.user.assignedAdmin || null);
          setBookingRequests(bookings);
        } else if (user.role === 'Admin') {
          const [dashboard, bookings] = await Promise.all([
            requestApi('/users/dashboard', token),
            requestApi('/bookings', token)
          ]);
          if (!active) return;
          setPendingSlots(dashboard.pendingStudents.map((student) => ({
            id: student.id,
            slot: 'Waiting for admin review',
            type: 'pending',
            student: {
              name: student.name,
              email: student.email,
              mobile: student.mobile || 'N/A',
              presentClass: student.presentClass || 'N/A',
              degree: student.degree || 'N/A'
            }
          })));
          setMyStudents(dashboard.assignedStudents.map((student) => ({
            ...student,
            mobile: student.mobile || 'N/A',
            presentClass: student.presentClass || 'N/A',
            degree: student.degree || 'N/A'
          })));
          setBookingRequests(bookings);
        } else if (user.role === 'SuperAdmin') {
          const [users, colleges, records] = await Promise.all([
            requestApi('/users', token),
            requestApi('/colleges', token),
            requestApi('/bookings/records', token)
          ]);
          if (!active) return;
          setAllUsers(users);
          setBookingRecords(records);
          setAllAdmins(users.filter((entry) => entry.role === 'Admin'));
          setStudentMatrix(users
            .filter((entry) => entry.role === 'Student')
            .map((student) => ({ ...student, assignedAdmin: student.assignedAdmin || null })));
          setColleges(colleges.map((college) => ({
            ...college,
            cutoff: college.cutoff || 'N/A',
            location: college.location || 'N/A'
          })));
        }
      } catch (error) {
        if (!active) return;
        setDashboardError(error instanceof Error ? error.message : 'Unable to load dashboard data.');
      }
    };

    refreshDashboardData();
    const refreshTimer = window.setInterval(refreshDashboardData, 15000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [token, user?.id, user?.role]);

  // Student: Book Slot
  const handleBookSlot = async () => {
    setBookingMsg('');
    try {
      await requestApi('/bookings', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: bookingSlot, type: bookingType })
      });
      setBookingRequests(await requestApi('/bookings', token));
      setBookingMsg(`Your request for ${bookingSlot} has been sent to ${assignedAdmin.name}.`);
      setDashboardError('');
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Unable to request a session.');
    }
  };

  // Admin: Approve student registration.
  const handleAcceptSlot = async (bookingId) => {
    try {
      await requestApi(`/users/students/${bookingId}/approve`, token, { method: 'PATCH' });
      const dashboard = await requestApi('/users/dashboard', token);
      setPendingSlots(dashboard.pendingStudents.map((student) => ({
        id: student.id,
        slot: 'Waiting for admin review',
        type: 'pending',
        student: {
          name: student.name,
          email: student.email,
          mobile: student.mobile || 'N/A',
          presentClass: student.presentClass || 'N/A',
          degree: student.degree || 'N/A'
        }
      })));
      setMyStudents(dashboard.assignedStudents);
      setDashboardError('');
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Unable to accept this student.');
    }
  };

  const handleAcceptBooking = async (bookingId) => {
    try {
      await requestApi(`/bookings/${bookingId}/accept`, token, { method: 'PATCH' });
      setBookingRequests(await requestApi('/bookings', token));
      setDashboardError('');
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Unable to accept this session.');
    }
  };

  const handleSendMessage = async (bookingId) => {
    const body = (messageDrafts[bookingId] || '').trim();
    if (!body) return;

    try {
      await requestApi(`/bookings/${bookingId}/messages`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      });
      setBookingRequests(await requestApi('/bookings', token));
      setMessageDrafts((previous) => ({ ...previous, [bookingId]: '' }));
      setDashboardError('');
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Unable to send your message.');
    }
  };

  const renderConversation = (booking) => (
    <div style={styles.conversation}>
      <div style={styles.messageThread}>
        {(booking.messages || []).length === 0 ? (
          <p style={{ color: '#667085', margin: 0 }}>No messages yet.</p>
        ) : booking.messages.map((message) => (
          <p key={message.id} style={styles.messageItem}>
            <strong>{message.senderName}:</strong> {message.body}
          </p>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSendMessage(booking.id);
        }}
        style={styles.messageForm}
      >
        <input
          type="text"
          value={messageDrafts[booking.id] || ''}
          onChange={(event) => setMessageDrafts((previous) => ({ ...previous, [booking.id]: event.target.value }))}
          placeholder="Write a message"
          aria-label="Write a message"
          style={styles.input}
          required
        />
        <button className="ui-button" type="submit" style={styles.btnPrimary}>Send</button>
      </form>
    </div>
  );

  const renderSessionActions = (booking, contactLabel, mobile) => (
    <>
      <div style={styles.sessionActions}>
        <button
          className="ui-button"
          type="button"
          onClick={() => setOpenConversations((previous) => ({
            ...previous,
            [booking.id]: !previous[booking.id]
          }))}
          style={styles.btnSecondary}
          aria-expanded={Boolean(openConversations[booking.id])}
        >
          {openConversations[booking.id] ? 'Close chat' : 'Open chat'}
        </button>
        {mobile && mobile !== 'N/A' ? (
          <a className="ui-button" href={`tel:${mobile}`} style={styles.callLink}>Call {contactLabel}</a>
        ) : (
          <button className="ui-button" type="button" disabled style={styles.btnSecondary}>Call unavailable</button>
        )}
      </div>
      {openConversations[booking.id] && renderConversation(booking)}
      <p style={styles.recordNotice}>
        Chat messages are saved for safety. Participants can see their session chat; saved session records are available only to Super Admin.
      </p>
    </>
  );

  const syncSuperAdminUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: authHeaders(token)
      });
      if (!response.ok) throw new Error('Failed to load users');

      const users = await response.json();
      const nextUsers = Array.isArray(users) ? users : [];
      setAllUsers(nextUsers);

      const admins = nextUsers.filter((entry) => entry.role === 'Admin');
      const students = nextUsers.filter((entry) => entry.role === 'Student');
      const studentRows = students.map((student) => ({
        ...student,
        assignedAdmin: student.assignedAdmin || null
      }));

      setAllAdmins(admins);
      setStudentMatrix(studentRows);
      setDashboardError('');
      return nextUsers;
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Unable to load administrator data.');
      setAllUsers([]);
      setAllAdmins([]);
      setStudentMatrix([]);
      return null;
    }
  };

  // Super Admin: Approve Admin
  const handleApproveAdmin = async (adminId, status) => {
    try {
      const response = await fetch(`${API_BASE}/users/${adminId}`, {
        method: 'PATCH',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status })
      });

      if (!response.ok) throw new Error('Unable to update admin status');
      setDashboardError('');
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Unable to update admin status.');
      return;
    }

    await syncSuperAdminUsers();
  };

  const handleRemoveUser = async (managedUser) => {
    const details = managedUser.role === 'Admin'
      ? 'Their assigned students will become unassigned.'
      : 'Their account will lose access.';
    const confirmed = window.confirm(
      `Remove ${managedUser.role.toLowerCase()} "${managedUser.name}"? ${details} Historical bookings will be kept.`
    );
    if (!confirmed) return;

    try {
      await requestApi(`/users/${managedUser.id}`, token, { method: 'DELETE' });
      setDashboardError('');
      await syncSuperAdminUsers();
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Unable to remove this account.');
    }
  };

  // Super Admin: Add College
  const handleAddCollege = async () => {
    if (!newCollege.name.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/colleges`, {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: newCollege.name.trim(),
          cutoff: newCollege.cutoff.trim() || null,
          location: newCollege.location.trim() || null
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to add college.');

      setColleges((previous) => [...previous, {
        ...data,
        cutoff: data.cutoff || 'N/A',
        location: data.location || 'N/A'
      }]);
      setNewCollege({ name: '', cutoff: '', location: '' });
      setDashboardError('');
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Unable to add college.');
    }
  };

  // ==========================================
  // PAGE 1: AUTHENTICATION INTERFACE
  // ==========================================
  if (isRestoringSession) {
    return (
      <div role="status" style={{ ...styles.authContainer, background: authPalette.pageBg }}>
        <p style={{ ...styles.subtitle, color: authPalette.primary }}>Restoring your session...</p>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <div style={{ ...styles.authContainer, background: authPalette.pageBg }}>
        <div className="auth-panel" style={{ ...styles.authBox, background: authPalette.cardBg, border: `1px solid ${authPalette.border}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <img src={logo} alt="Neoterik Pathways logo" style={{ width: 280, height: 'auto', borderRadius: 14, boxShadow: '0 10px 30px rgba(15, 76, 129, 0.12)' }} />
            <h1 style={{ ...styles.logo, color: authPalette.title, margin: 0 }}>NEOTERIK PATHWAYS</h1>
          </div>
          <p style={{ ...styles.subtitle, color: authPalette.primary }}>{authMode === 'login' ? 'Sign in to access your portal' : 'Create a new account'}</p>
          
          {authError && <div style={styles.errorBox}>{authError}</div>}
          {authNotice && <div style={styles.noticeBox}>{authNotice}</div>}

          <form onSubmit={handleAuth} style={styles.form}>
            {authMode === 'register' && (
              <>
                <input className="auth-control" type="text" placeholder="Full Name" value={authName} onChange={e => setAuthName(e.target.value)} style={styles.input} required />
                <input className="auth-control" type="text" placeholder="Mobile Number" value={authMobile} onChange={e => setAuthMobile(e.target.value)} style={styles.input} required />
                <select className="auth-control" value={authRole} onChange={e => setAuthRole(e.target.value)} style={styles.input}>
                  <option value="Student">Student</option>
                  <option value="Admin">Admin</option>
                </select>
                {authRole === 'Student' && (
                  <>
                    <select className="auth-control" value={authClass} onChange={e => setAuthClass(e.target.value)} style={styles.input}>
                      {CLASS_OPTIONS.map((classOption) => (
                        <option key={classOption} value={classOption}>{classOption}</option>
                      ))}
                    </select>
                    <select className="auth-control" value={authDegree} onChange={e => setAuthDegree(e.target.value)} style={styles.input}>
                      {DEGREE_OPTIONS.map((degreeOption) => (
                        <option key={degreeOption} value={degreeOption}>{degreeOption}</option>
                      ))}
                    </select>
                  </>
                )}
              </>
            )}

            <input className="auth-control" type="email" placeholder="Email Address" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={styles.input} required />
            <input className="auth-control" type={showPassword ? 'text' : 'password'} placeholder={authMode === 'register' ? 'Password (at least 12 characters)' : 'Password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={styles.input} minLength={authMode === 'register' ? 12 : undefined} maxLength={72} required />
            <div style={{ textAlign: 'right', marginTop: -4 }}>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={{ ...styles.showPasswordToggle, color: authPalette.primary }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈 Hide' : '👁️ Show'}
              </button>
            </div>

            <button className="ui-button" type="submit" style={{ ...styles.btnPrimary, background: authPalette.primary }}>
              {authMode === 'login' ? 'Login' : 'Register Account'}
            </button>
          </form>

          <p style={styles.toggleText}>
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <span style={{ ...styles.toggleLink, color: authPalette.primary }} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? 'Register' : 'Login'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // HEADER BAR (COMMON FOR PAGES 2, 3 & 4)
  // ==========================================
  const renderHeader = (title) => (
    <>
      <header className="dashboard-header" style={styles.header}>
        <div className="dashboard-header-title">
          <h2 style={{ margin: 0, color: '#1a1a1a' }}>{title}</h2>
          <span className="dashboard-user-badge" style={styles.userBadge}>👤 {user.name} ({user.role})</span>
        </div>
        <div className="dashboard-header-actions" style={styles.headerActions}>
          {user.role !== 'SuperAdmin' && (
            <button className="ui-button" onClick={handleOpenProfile} style={styles.btnSecondary}>My Profile</button>
          )}
          <button className="ui-button" onClick={handleLogout} style={styles.btnSecondary}>Logout</button>
        </div>
      </header>
      {dashboardError && <div role="alert" style={styles.errorBox}>{dashboardError}</div>}
      {profileOpen && (
        <div className="profile-backdrop" onClick={() => setProfileOpen(false)}>
          <section
            className="profile-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-heading">
              <h2 id="profile-title">My Profile</h2>
              <button type="button" onClick={() => setProfileOpen(false)} aria-label="Close profile" className="profile-close">×</button>
            </div>
            <form onSubmit={handleSaveProfile} style={styles.form}>
              <label style={styles.profileLabel}>
                Email address
                <input type="email" value={user.email} style={styles.input} readOnly />
              </label>
              <label style={styles.profileLabel}>
                Full name
                <input type="text" value={profileForm.name} onChange={(event) => setProfileForm((form) => ({ ...form, name: event.target.value }))} style={styles.input} required />
              </label>
              <label style={styles.profileLabel}>
                Mobile number
                <input type="tel" value={profileForm.mobile} onChange={(event) => setProfileForm((form) => ({ ...form, mobile: event.target.value }))} style={styles.input} required />
              </label>
              {user.role === 'Student' && (
                <>
                  <label style={styles.profileLabel}>
                    Completed class
                    <select value={profileForm.presentClass} onChange={(event) => setProfileForm((form) => ({ ...form, presentClass: event.target.value }))} style={styles.input}>
                      {CLASS_OPTIONS.map((classOption) => <option key={classOption} value={classOption}>{classOption}</option>)}
                    </select>
                  </label>
                  <label style={styles.profileLabel}>
                    Degree
                    <select value={profileForm.degree} onChange={(event) => setProfileForm((form) => ({ ...form, degree: event.target.value }))} style={styles.input}>
                      {DEGREE_OPTIONS.map((degreeOption) => <option key={degreeOption} value={degreeOption}>{degreeOption}</option>)}
                    </select>
                  </label>
                </>
              )}
              <label style={styles.profileLabel}>
                New password <span style={{ color: '#667085', fontWeight: 'normal' }}>(optional; at least 12 characters)</span>
                <input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={profileForm.password} onChange={(event) => setProfileForm((form) => ({ ...form, password: event.target.value }))} style={styles.input} />
              </label>
              {profileError && <div style={styles.errorBox}>{profileError}</div>}
              {profileMessage && <div style={styles.noticeBox}>{profileMessage}</div>}
              <div className="profile-actions">
                <button type="button" onClick={() => setProfileOpen(false)} style={styles.btnSecondary}>Cancel</button>
                <button className="ui-button" type="submit" style={styles.btnPrimary}>Save changes</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );

  // ==========================================
  // PAGE 2: STUDENT DASHBOARD
  // ==========================================
  if (user.role === 'Student') {
    return (
      <div className="dashboard-container" style={styles.dashboard}>
        {renderHeader('Student Career & Counseling Portal')}

        <div className="dashboard-grid" style={styles.grid}>
          {/* Card 1: Assigned Admin */}
          <div className="dashboard-card" style={styles.card}>
            <h3>👩‍🏫 Admin Who Accepted You</h3>
            {assignedAdmin ? (
              <div>
                <p><strong>Name:</strong> {assignedAdmin.name}</p>
                <p><strong>Email:</strong> {assignedAdmin.email}</p>
                <p><strong>Mobile:</strong> {assignedAdmin.mobile}</p>
              </div>
            ) : (
              <p style={{ color: '#666' }}>Admin details will appear here after an admin accepts your registration.</p>
            )}
          </div>

          {/* Card 2: Book Chat/Call Slot */}
          <div className="dashboard-card" style={styles.card}>
            <h3>📅 Book Counseling Slot</h3>
            <select value={bookingSlot} onChange={e => setBookingSlot(e.target.value)} style={styles.input} disabled={!assignedAdmin}>
              {SLOT_OPTIONS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
            <select value={bookingType} onChange={e => setBookingType(e.target.value)} style={styles.input} disabled={!assignedAdmin}>
              <option value="chat">Live Chat Session</option>
              <option value="call">Voice/Video Call</option>
            </select>
            <button className="ui-button" onClick={handleBookSlot} style={styles.btnPrimary} disabled={!assignedAdmin}>Request Slot</button>
            {bookingMsg && <p style={{ color: 'green', marginTop: 10 }}>{bookingMsg}</p>}
            {!assignedAdmin && <p style={{ color: '#667085', marginTop: 10 }}>Slot booking opens after an admin accepts your registration.</p>}
          </div>

          <div className="dashboard-card" style={styles.card}>
            <h3>📝 Your Slot Requests</h3>
            {bookingRequests.length === 0 ? <p>No slot requests yet.</p> : bookingRequests.map((booking) => (
              <div key={booking.id} style={styles.sessionItem}>
                <p><strong>{booking.slot}</strong> · {booking.type === 'call' ? 'Call' : 'Chat'}</p>
                {booking.status === 'PENDING' ? (
                  <p style={{ color: '#8a5a00' }}>Waiting for admin to accept this slot.</p>
                ) : (
                  <>
                    <p>Accepted by {booking.acceptedBy?.name || booking.adminName}</p>
                    {renderSessionActions(
                      booking,
                      'Admin',
                      booking.acceptedBy?.mobile || assignedAdmin?.mobile
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // PAGE 3: ADMIN DASHBOARD
  // ==========================================
  if (user.role === 'Admin') {
    return (
      <div className="dashboard-container" style={styles.dashboard}>
        {renderHeader('Admin Counseling Management')}

        <div className="dashboard-grid" style={styles.grid}>
          {/* Card 1: Pending Slot Requests */}
          <div className="dashboard-card" style={{ ...styles.card, gridColumn: 'span 2' }}>
            <h3>🧑‍🎓 Students Waiting for Admin</h3>
            {pendingSlots.length === 0 ? <p>No students are waiting for admin approval.</p> : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Completed Class</th>
                    <th>Degree</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSlots.map(s => (
                    <tr key={s.id}>
                      <td>{s.student.name}</td>
                      <td>{s.student.email}</td>
                      <td>{s.student.mobile}</td>
                      <td>{s.student.presentClass || 'N/A'}</td>
                      <td>{s.student.degree || 'N/A'}</td>
                      <td>Waiting for admin</td>
                      <td>
                        <button className="ui-button" onClick={() => handleAcceptSlot(s.id)} style={styles.btnSuccess}>
                          Accept Student
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="dashboard-card" style={{ ...styles.card, gridColumn: 'span 2' }}>
            <h3>📩 Student Slot Requests</h3>
            {bookingRequests.filter((booking) => booking.status === 'PENDING').length === 0 ? (
              <p>No slot requests are waiting for your approval.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Contact</th>
                    <th>Requested Slot</th>
                    <th>Session</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingRequests.filter((booking) => booking.status === 'PENDING').map((booking) => (
                    <tr key={booking.id}>
                      <td>{booking.studentName}</td>
                      <td>{booking.studentEmail}<br />{booking.studentMobile}</td>
                      <td>{booking.slot}</td>
                      <td>{booking.type === 'call' ? 'Call' : 'Chat'}</td>
                      <td><button className="ui-button" onClick={() => handleAcceptBooking(booking.id)} style={styles.btnSuccess}>Accept Slot</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="dashboard-card" style={{ ...styles.card, gridColumn: 'span 2' }}>
            <h3>✅ Accepted Sessions</h3>
            {bookingRequests.filter((booking) => booking.status === 'ACCEPTED').length === 0 ? (
              <p>Accepted slot conversations will appear here.</p>
            ) : bookingRequests.filter((booking) => booking.status === 'ACCEPTED').map((booking) => (
              <div key={booking.id} style={styles.sessionItem}>
                <h4>{booking.studentName} · {booking.slot}</h4>
                <p>{booking.type === 'call' ? 'Call session' : 'Chat session'} · {booking.studentEmail}</p>
                {renderSessionActions(booking, 'student', booking.studentMobile)}
              </div>
            ))}
          </div>

          {/* Card 2: My Permanently Assigned Students */}
          <div className="dashboard-card" style={{ ...styles.card, gridColumn: 'span 2' }}>
            <h3>🔒 My Locked Students</h3>
            {myStudents.length === 0 ? <p>No students locked to your profile yet.</p> : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Completed Class</th>
                    <th>Degree</th>
                  </tr>
                </thead>
                <tbody>
                  {myStudents.map(st => (
                    <tr key={st.id}>
                      <td>{st.name}</td>
                      <td>{st.email}</td>
                      <td>{st.mobile}</td>
                      <td>{st.presentClass || 'N/A'}</td>
                      <td>{st.degree || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PAGE 4: SUPER ADMIN CONTROL PANEL
  // ==========================================
  if (user.role === 'SuperAdmin') {
    return (
      <div className="dashboard-container" style={styles.dashboard}>
        {renderHeader('Super Admin Master Control Panel')}

        <div className="dashboard-grid" style={styles.grid}>
          {/* Section 1: Admin Approvals */}
          <div className="dashboard-card" style={{ ...styles.card, gridColumn: 'span 2' }}>
            <h3>🛡️ Admin Registration Approvals</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Admin Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allAdmins.length === 0 ? (
                  <tr><td colSpan="4">No admin registrations are waiting for review.</td></tr>
                ) : allAdmins.map(adm => (
                  <tr key={adm.id}>
                    <td>{adm.name}</td>
                    <td>{adm.email}</td>
                    <td>
                      <span style={{ 
                        color: adm.status === 'APPROVED' ? 'green' : adm.status === 'PENDING' ? 'orange' : 'red',
                        fontWeight: 'bold' 
                      }}>
                        {adm.status}
                      </span>
                    </td>
                    <td>
                      {adm.status === 'PENDING' && (
                        <>
                          <button className="ui-button" onClick={() => handleApproveAdmin(adm.id, 'APPROVED')} style={styles.btnSuccess}>Approve</button>
                          <button className="ui-button" onClick={() => handleApproveAdmin(adm.id, 'REJECTED')} style={styles.btnDanger}>Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 2: Student Allocation Matrix */}
          <div className="dashboard-card" style={{ ...styles.card, gridColumn: 'span 2' }}>
            <h3>📊 Student Allocation Matrix</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Assigned Counselor Admin</th>
                </tr>
              </thead>
              <tbody>
                {studentMatrix.length === 0 ? (
                  <tr><td colSpan="3">No registered students yet.</td></tr>
                ) : studentMatrix.map(m => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.email}</td>
                    <td>{m.assignedAdmin ? `${m.assignedAdmin.name} (${m.assignedAdmin.email})` : 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 3: User Management */}
          <div className="dashboard-card" style={{ ...styles.card, gridColumn: 'span 2' }}>
            <h3>👥 Manage Students and Admins</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.filter((entry) => ['Student', 'Admin'].includes(entry.role)).length === 0 ? (
                  <tr><td colSpan="5">No student or admin accounts to manage.</td></tr>
                ) : allUsers.filter((entry) => ['Student', 'Admin'].includes(entry.role)).map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.name}</td>
                    <td>{entry.email}</td>
                    <td>{entry.role}</td>
                    <td>{entry.status}</td>
                    <td>
                      <button
                        className="ui-button"
                        type="button"
                        onClick={() => handleRemoveUser(entry)}
                        style={styles.btnDanger}
                        aria-label={`Remove ${entry.role.toLowerCase()} ${entry.name}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 4: Super-admin-only session records */}
          <div className="dashboard-card" style={{ ...styles.card, gridColumn: 'span 2' }}>
            <h3>🔒 Student Safety Session Records</h3>
            <p style={styles.recordNotice}>
              Saved chat transcripts are restricted to this Super Admin records view. Phone calls use the device dialer and are not recorded.
            </p>
            {bookingRecords.length === 0 ? (
              <p>No session records are available yet.</p>
            ) : bookingRecords.map((booking) => (
              <div key={booking.id} style={styles.sessionItem}>
                <h4>{booking.studentName} · {booking.slot}</h4>
                <p>
                  {booking.type === 'call' ? 'Call session' : 'Chat session'} · {booking.status} ·
                  {' '}{booking.adminName} · {booking.studentEmail}
                </p>
                {(booking.messages || []).length === 0 ? (
                  <p>No chat messages were sent in this session.</p>
                ) : (
                  <div style={styles.messageThread}>
                    {booking.messages.map((message) => (
                      <p key={message.id} style={styles.messageItem}>
                        <strong>{message.senderName}</strong>
                        {' · '}{new Date(message.sentAt).toLocaleString()}
                        <br />
                        {message.body}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Section 5: Preferred Colleges Manager */}
          <div className="dashboard-card" style={{ ...styles.card, gridColumn: 'span 2' }}>
            <h3>🎓 Preferred College Cutoff Directory</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
              <input type="text" placeholder="College Name" value={newCollege.name} onChange={e => setNewCollege({ ...newCollege, name: e.target.value })} style={styles.input} />
              <input type="text" placeholder="Cutoff Score/Rank" value={newCollege.cutoff} onChange={e => setNewCollege({ ...newCollege, cutoff: e.target.value })} style={styles.input} />
              <input type="text" placeholder="Location" value={newCollege.location} onChange={e => setNewCollege({ ...newCollege, location: e.target.value })} style={styles.input} />
              <button className="ui-button" onClick={handleAddCollege} style={styles.btnPrimary}>Add College</button>
            </div>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th>College Name</th>
                  <th>Cutoff</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {colleges.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.cutoff}</td>
                    <td>{c.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Inline CSS Styles for Immediate Rendering
const styles = {
  authContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #eef7ff 0%, #f3ebff 50%, #eafaf1 100%)' },
  authBox: { background: '#fff', padding: 40, borderRadius: 20, width: 420, border: '1px solid rgba(124, 143, 255, 0.15)', boxShadow: '0 18px 45px rgba(48, 72, 123, 0.12)' },
  logo: { fontSize: 26, margin: '0 0 5px 0', textAlign: 'center', color: '#1a1a1a', letterSpacing: 0.4 },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 20, fontSize: 15 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: 12, border: '1px solid #d9e2f2', borderRadius: 10, fontSize: 14, width: '100%', boxSizing: 'border-box', background: '#f9fbff' },
  btnPrimary: { padding: 12, background: 'linear-gradient(135deg, #3c7cff 0%, #5b3aa6 100%)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 18px rgba(68, 100, 255, 0.22)' },
  btnSecondary: { padding: '8px 16px', background: 'linear-gradient(135deg, #edf3ff 0%, #eafaf1 100%)', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold', color: '#193d6b' },
  btnSuccess: { padding: '6px 12px', background: 'linear-gradient(135deg, #2ec27e 0%, #128f5c 100%)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', marginRight: 5, boxShadow: '0 6px 14px rgba(48, 170, 126, 0.2)' },
  btnDanger: { padding: '6px 12px', background: 'linear-gradient(135deg, #ff7a7a 0%, #dc3545 100%)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', boxShadow: '0 6px 14px rgba(220, 53, 69, 0.2)' },
  toggleText: { marginTop: 20, textAlign: 'center', fontSize: 14, color: '#666' },
  toggleLink: { color: '#0066ff', fontWeight: 'bold', cursor: 'pointer' },
  showPasswordToggle: { color: '#0066ff', fontSize: 12, cursor: 'pointer', fontWeight: 'bold', background: 'transparent', border: 'none', padding: 0 },
  errorBox: { background: 'linear-gradient(135deg, #fff1f1 0%, #ffe9e9 100%)', color: '#d8000c', padding: 10, borderRadius: 10, marginBottom: 15, fontSize: 14, border: '1px solid #ffd3d3' },
  noticeBox: { background: 'linear-gradient(135deg, #ebfff4 0%, #e6f9ef 100%)', color: '#236b4a', padding: 10, borderRadius: 10, marginBottom: 15, fontSize: 14, border: '1px solid #bee9d0' },
  dashboard: { padding: 30, background: 'linear-gradient(180deg, #f6f8ff 0%, #edf7f2 100%)', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #ffffff 0%, #eef9ff 100%)', padding: '18px 24px', borderRadius: 16, boxShadow: '0 8px 24px rgba(34, 44, 88, 0.10)', marginBottom: 25, border: '1px solid rgba(90, 121, 190, 0.12)' },
  headerActions: { display: 'flex', gap: 8, alignItems: 'center' },
  profileLabel: { display: 'grid', gap: 6, color: '#344054', fontSize: 13, fontWeight: 'bold' },
  userBadge: { fontSize: 12, background: 'linear-gradient(135deg, #edf4ff 0%, #ebf9f0 100%)', color: '#184a8d', padding: '6px 10px', borderRadius: 999, fontWeight: 'bold', border: '1px solid rgba(76, 103, 183, 0.12)' },
  grid: { display: 'grid', gap: 20 },
  card: { background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)', padding: 20, borderRadius: 18, border: '1px solid #e5edf7', boxShadow: '0 10px 22px rgba(70, 94, 129, 0.08)' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 10 },
  sessionItem: { borderTop: '1px solid #e3e9ef', padding: '14px 0' },
  conversation: { marginTop: 12 },
  sessionActions: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  recordNotice: { margin: '10px 0 0', color: '#667085', fontSize: 13 },
  messageThread: { display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto', padding: 12, background: 'linear-gradient(180deg, #f8fbff 0%, #f2f8ff 100%)', border: '1px solid #e3e9ef', borderRadius: 10 },
  messageItem: { margin: 0, padding: '8px 10px', background: '#fff', border: '1px solid #e8edf2', borderRadius: 8, overflowWrap: 'anywhere' },
  messageForm: { display: 'flex', gap: 8, marginTop: 8 },
  callLink: { display: 'inline-block', margin: '4px 0', padding: '7px 12px', borderRadius: 10, background: 'linear-gradient(135deg, #e9f3ff 0%, #edf9f0 100%)', color: '#0f4c81', fontWeight: 'bold', textDecoration: 'none' },
  aiReplyBox: { marginTop: 15, padding: 12, background: '#f0f7ff', borderRadius: 6, fontSize: 14, color: '#004085' }
};