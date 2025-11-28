// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  LOGOUT: `${API_BASE_URL}/auth/logout`,
  REFRESH_TOKEN: `${API_BASE_URL}/auth/refresh`,
  GOOGLE_AUTH: `${API_BASE_URL}/auth/google`,
  FACEBOOK_AUTH: `${API_BASE_URL}/auth/facebook`,

  // User endpoints
  USER_PROFILE: `${API_BASE_URL}/users/profile`,
  UPDATE_PROFILE: `${API_BASE_URL}/users/profile`,
  DELETE_ACCOUNT: `${API_BASE_URL}/users/account`,
  DELETE_ACCOUNT_PERMANENT: `${API_BASE_URL}/users/account/permanent`,

  // Resume endpoints
  RESUMES: `${API_BASE_URL}/resumes`,
  RESUME_BY_ID: (id) => `${API_BASE_URL}/resumes/${id}`,
  DUPLICATE_RESUME: (id) => `${API_BASE_URL}/resumes/${id}/duplicate`,
  RESUME_VERSIONS: (id) => `${API_BASE_URL}/resumes/${id}/versions`,
  SAVE_VERSION: (id) => `${API_BASE_URL}/resumes/${id}/version`,
  RESTORE_VERSION: (id, version) => `${API_BASE_URL}/resumes/${id}/restore/${version}`,
  COMPARE_VERSIONS: (id, v1, v2) => `${API_BASE_URL}/resumes/${id}/compare/${v1}/${v2}`,
  EXPORT_DOCX: (id) => `${API_BASE_URL}/resumes/${id}/export/docx`,
  EXPORT_PDF: (id) => `${API_BASE_URL}/resumes/${id}/export/pdf`,
  EXPORT_SHARED_DOCX: (shareId) => `${API_BASE_URL}/resumes/share/${shareId}/export/docx`,
  EXPORT_SHARED_PDF: (shareId) => `${API_BASE_URL}/resumes/share/${shareId}/export/pdf`,

  // Template endpoints
  TEMPLATES: `${API_BASE_URL}/templates`,
  TEMPLATE_BY_ID: (id) => `${API_BASE_URL}/templates/${id}`,

  // Guide endpoints
  GUIDES: `${API_BASE_URL}/guides`,
  GUIDE_BY_SLUG: (slug) => `${API_BASE_URL}/guides/${slug}`,
  GUIDES_BY_INDUSTRY: (industry) => `${API_BASE_URL}/guides/industry/${industry}`,

  // Notification endpoints
  NOTIFICATIONS: `${API_BASE_URL}/notifications`,
  NOTIFICATIONS_UNREAD_COUNT: `${API_BASE_URL}/notifications/unread-count`,
  MARK_NOTIFICATION_READ: (id) => `${API_BASE_URL}/notifications/${id}/read`,
  MARK_ALL_NOTIFICATIONS_READ: `${API_BASE_URL}/notifications/read-all`,
  DELETE_NOTIFICATION: (id) => `${API_BASE_URL}/notifications/${id}`,

  // Guest endpoints
  GUEST_SESSION: `${API_BASE_URL}/guest/session`,
  GUEST_RESUME: `${API_BASE_URL}/guest/resume`,
  GUEST_RESUME_BY_ID: (id) => `${API_BASE_URL}/guest/resume/${id}`,
  GUEST_RESUMES: `${API_BASE_URL}/guest/resumes`,
  GUEST_MIGRATE: `${API_BASE_URL}/guest/migrate`
};

// API request helper with error handling
export const apiRequest = async (url, options = {}) => {
  const token = localStorage.getItem('token');

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    credentials: 'include', // For cookies (session)
    ...options
  };

  try {
    const response = await fetch(url, defaultOptions);

    // Handle 401 Unauthorized - token expired
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(text || 'Server returned non-JSON response');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

export default API_BASE_URL;
