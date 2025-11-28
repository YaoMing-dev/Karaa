import { API_ENDPOINTS } from '../config/api';

// Get token from localStorage
const getToken = () => localStorage.getItem('token');

// API request wrapper
const apiRequest = async (url, options = {}) => {
  const token = getToken();
  const guestSessionId = localStorage.getItem('guestSessionId');

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    credentials: 'include',
    ...options
  };

  try {
    const response = await fetch(url, defaultOptions);

    // Handle 401 Unauthorized
    if (response.status === 401) {
      // Only redirect to login if not a guest user
      if (!guestSessionId) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Session expired');
      }
      // For guest users, just throw error without redirect
      throw new Error('Authentication required');
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(text || 'Server returned non-JSON response');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Resume Services
export const resumeService = {
  // Get all resumes
  getAll: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_ENDPOINTS.RESUMES}?${query}` : API_ENDPOINTS.RESUMES;
    return apiRequest(url);
  },

  // Get single resume
  getById: async (id) => {
    return apiRequest(API_ENDPOINTS.RESUME_BY_ID(id));
  },

  // Create resume
  create: async (data) => {
    return apiRequest(API_ENDPOINTS.RESUMES, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Update resume
  update: async (id, data) => {
    return apiRequest(API_ENDPOINTS.RESUME_BY_ID(id), {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Delete resume
  delete: async (id) => {
    return apiRequest(API_ENDPOINTS.RESUME_BY_ID(id), {
      method: 'DELETE'
    });
  },

  // Duplicate resume
  duplicate: async (id) => {
    return apiRequest(`${API_ENDPOINTS.RESUME_BY_ID(id)}/duplicate`, {
      method: 'POST'
    });
  },

  // Get stats
  getStats: async () => {
    return apiRequest(`${API_ENDPOINTS.RESUMES}/stats`);
  },

  // Export resume as DOCX
  exportDocx: async (id) => {
    const token = getToken();
    const response = await fetch(API_ENDPOINTS.EXPORT_DOCX(id), {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to export resume');
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'resume.docx';
    if (contentDisposition) {
      const matches = /filename="([^"]*)"/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = matches[1];
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  },

  // Export resume as PDF
  exportPdf: async (id) => {
    const token = getToken();
    const response = await fetch(API_ENDPOINTS.EXPORT_PDF(id), {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to export resume as PDF');
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'resume.pdf';
    if (contentDisposition) {
      const matches = /filename="([^"]*)"/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = matches[1];
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  },

  // Generate share link
  generateShareLink: async (id, settings = {}) => {
    return apiRequest(`${API_ENDPOINTS.RESUME_BY_ID(id)}/share`, {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  },

  // Update share settings
  updateShareSettings: async (id, settings = {}) => {
    return apiRequest(`${API_ENDPOINTS.RESUME_BY_ID(id)}/share`, {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },

  // Get shared resume
  getSharedResume: async (shareId, password = null) => {
    const url = password
      ? `${API_ENDPOINTS.RESUMES}/share/${shareId}?password=${password}`
      : `${API_ENDPOINTS.RESUMES}/share/${shareId}`;
    return apiRequest(url);
  },

  // Export shared resume as DOCX
  exportSharedDocx: async (shareId, password = null) => {
    const url = password
      ? `${API_ENDPOINTS.EXPORT_SHARED_DOCX(shareId)}?password=${password}`
      : API_ENDPOINTS.EXPORT_SHARED_DOCX(shareId);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to export shared resume');
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'resume.docx';
    if (contentDisposition) {
      const matches = /filename="([^"]*)"/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = matches[1];
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  },

  // Export shared resume as PDF
  exportSharedPdf: async (shareId, password = null) => {
    const url = password
      ? `${API_ENDPOINTS.EXPORT_SHARED_PDF(shareId)}?password=${password}`
      : API_ENDPOINTS.EXPORT_SHARED_PDF(shareId);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to export shared resume as PDF');
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'resume.pdf';
    if (contentDisposition) {
      const matches = /filename="([^"]*)"/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = matches[1];
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  }
};

// Template Services
export const templateService = {
  // Get all templates
  getAll: async (params = {}) => {
    // Add skipCache by default to prevent stale data
    const finalParams = { skipCache: true, ...params };
    const query = new URLSearchParams(finalParams).toString();
    const url = query ? `${API_ENDPOINTS.TEMPLATES}?${query}` : `${API_ENDPOINTS.TEMPLATES}?skipCache=true`;
    return apiRequest(url);
  },

  // Get single template
  getById: async (id, skipCache = true) => {
    const url = skipCache ? `${API_ENDPOINTS.TEMPLATE_BY_ID(id)}?skipCache=true` : API_ENDPOINTS.TEMPLATE_BY_ID(id);
    return apiRequest(url);
  },

  // Get categories
  getCategories: async () => {
    return apiRequest(`${API_ENDPOINTS.TEMPLATES}/categories`);
  },

  // Get popular templates
  getPopular: async (limit = 6) => {
    return apiRequest(`${API_ENDPOINTS.TEMPLATES}/popular?limit=${limit}`);
  }
};

// User Services
export const userService = {
  // Get profile
  getProfile: async () => {
    return apiRequest(API_ENDPOINTS.USER_PROFILE);
  },

  // Update profile
  updateProfile: async (data) => {
    return apiRequest(API_ENDPOINTS.UPDATE_PROFILE, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Change password
  changePassword: async (data) => {
    return apiRequest(`${API_ENDPOINTS.USER_PROFILE}/change-password`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Get activity
  getActivity: async (limit = 10) => {
    return apiRequest(`${API_ENDPOINTS.USER_PROFILE}/activity?limit=${limit}`);
  },

  // Delete account (soft delete)
  deleteAccount: async () => {
    return apiRequest(API_ENDPOINTS.DELETE_ACCOUNT, {
      method: 'DELETE'
    });
  },

  // Permanent delete account
  permanentDeleteAccount: async (password, confirmation) => {
    return apiRequest(API_ENDPOINTS.DELETE_ACCOUNT_PERMANENT, {
      method: 'DELETE',
      body: JSON.stringify({ password, confirmation })
    });
  }
};

// Auth Services
export const authService = {
  // Login
  login: async (email, password) => {
    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text || 'Server returned non-JSON response');
      }

      const data = await response.json();

      // Don't throw error if verification is required
      if (data.requiresVerification) {
        return data;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      return data;
    } catch (error) {
      console.error('Login Error:', error);
      throw error;
    }
  },

  // Register
  register: async (name, email, password) => {
    try {
      const response = await fetch(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include'
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text || 'Server returned non-JSON response');
      }

      const data = await response.json();

      // If verification is required (email sent)
      if (data.requiresVerification) {
        return {
          success: false,
          requiresVerification: true,
          email: data.email || email,
          message: data.message || 'Please verify your email'
        };
      }

      // If registration succeeded without verification (email disabled or auto-verified)
      if (response.ok && data.success) {
        return data;
      }

      // If there's an error
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      return data;
    } catch (error) {
      console.error('Register Error:', error);
      throw error;
    }
  },

  // Logout
  logout: async () => {
    return apiRequest(API_ENDPOINTS.LOGOUT, {
      method: 'POST'
    });
  }
};

// Guest Services
export const guestService = {
  // Create guest session
  createSession: async () => {
    try {
      const response = await fetch(API_ENDPOINTS.GUEST_SESSION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create guest session');
      }

      return data;
    } catch (error) {
      console.error('Create Guest Session Error:', error);
      throw error;
    }
  },

  // Save guest resume
  saveResume: async (sessionId, resumeData) => {
    try {
      const response = await fetch(API_ENDPOINTS.GUEST_RESUME, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId, ...resumeData })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save guest resume');
      }

      return data;
    } catch (error) {
      console.error('Save Guest Resume Error:', error);
      throw error;
    }
  },

  // Get guest resumes
  getResumes: async (sessionId) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.GUEST_RESUMES}?sessionId=${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get guest resumes');
      }

      return data;
    } catch (error) {
      console.error('Get Guest Resumes Error:', error);
      throw error;
    }
  },

  // Update guest resume
  updateResume: async (id, sessionId, resumeData) => {
    try {
      const response = await fetch(API_ENDPOINTS.GUEST_RESUME_BY_ID(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId, ...resumeData })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update guest resume');
      }

      return data;
    } catch (error) {
      console.error('Update Guest Resume Error:', error);
      throw error;
    }
  }
};

// Export all services
export default {
  resume: resumeService,
  template: templateService,
  user: userService,
  auth: authService,
  guest: guestService
};
