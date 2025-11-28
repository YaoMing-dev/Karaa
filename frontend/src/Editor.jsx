/**
 * ================================================================================
 * RESUME BUILDER - EDITOR COMPONENT
 * ================================================================================
 * Main editor component for creating and editing resumes
 *
 * Features:
 * - Multi-tab form interface (Personal, Experience, Education, Skills, etc.)
 * - Real-time preview with drag-and-drop reordering
 * - Template switching and customization
 * - Auto-save functionality
 * - Guest mode support
 * - PDF export
 *
 * File Size: ~3000 lines
 * - State Management: Lines 130-250
 * - Data Handlers: Lines 250-1200
 * - Form Tabs: Lines 1600-2420
 * - Render: Lines 2420-2972
 * ================================================================================
 */

// ================================================================================
// REACT & ROUTING IMPORTS
// ================================================================================
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams, useParams, useNavigate } from 'react-router-dom';
import './Editor.css';

// ================================================================================
// CUSTOM COMPONENTS
// ================================================================================
import EditableField from './components/EditableField';
import SortableSection from './components/SortableSection';
import SimpleSortableItem from './components/SimpleSortableItem';
import CustomizationPanel from './components/CustomizationPanel';
import TemplateSwitcher from './components/TemplateSwitcher';
import ResumePreview from './components/ResumePreview';

// ================================================================================
// API & SERVICES
// ================================================================================
import { API_ENDPOINTS, apiRequest } from './config/api';
import { useAuth } from './AuthContext';
import { resumeService } from './services/api.service';
import {
  saveGuestResume,
  getGuestResume,
  updateGuestResume,
  migrateGuestData,
  isGuestMode
} from './utils/guestSession';
import { exportResumeAsHtmlPdf } from './utils/htmlToPdfExport';

// ================================================================================
// CUSTOM HOOKS
// ================================================================================
import useArrayCRUD from './hooks/useArrayCRUD';

// ================================================================================
// DRAG & DROP LIBRARIES
// ================================================================================
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ================================================================================
// SORTABLE FORM ITEM COMPONENT
// ================================================================================
/**
 * Reusable sortable wrapper for form items (Education, Projects, Certificates, etc.)
 * Provides drag-and-drop functionality with visual feedback
 */
const SortableFormItem = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: isDragging
      ? `${CSS.Transform.toString(transform)} rotate(2deg)`
      : CSS.Transform.toString(transform),
    transition: isDragging ? transition : `${transition}, box-shadow 0.2s ease, transform 0.2s ease`,
    position: 'relative',
    padding: '16px 16px 16px 60px',
    margin: '12px 0',
    backgroundColor: isDragging ? '#EEF2FF' : '#F9FAFB',
    border: `2px solid ${isDragging ? '#4F46E5' : '#E5E7EB'}`,
    borderRadius: '12px',
    opacity: isDragging ? 0.8 : 1,
    boxShadow: isDragging
      ? '0 8px 20px rgba(79, 70, 229, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)'
      : '0 1px 3px rgba(0, 0, 0, 0.05)',
    zIndex: isDragging ? 9999 : 'auto',
    cursor: isDragging ? 'grabbing' : 'default',
  };

  const handleStyle = {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '36px',
    height: '80%',
    minHeight: '48px',
    maxHeight: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FFFFFF',
    border: '2px solid #D1D5DB',
    borderRadius: '8px',
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    zIndex: 10000, // VERY HIGH to ensure it's on top
    pointerEvents: 'auto', // ALWAYS receive pointer events
    transition: 'all 0.15s ease',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  };

  const handleActiveStyle = {
    ...handleStyle,
    cursor: 'grabbing',
    background: '#EEF2FF',
    borderColor: '#4F46E5',
    borderWidth: '2px',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
    transform: 'translateY(-50%) scale(1.05)',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="listitem"
      aria-label="Draggable item"
    >
      {/* DRAG HANDLE - MUST be OUTSIDE and INDEPENDENT */}
      <div
        ref={setActivatorNodeRef}
        style={isDragging ? handleActiveStyle : handleStyle}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        onMouseDown={(e) => {
          e.stopPropagation(); // Prevent any parent handlers
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="7" cy="5" r="2" fill={isDragging ? "#4F46E5" : "#9CA3AF"}/>
          <circle cx="13" cy="5" r="2" fill={isDragging ? "#4F46E5" : "#9CA3AF"}/>
          <circle cx="7" cy="10" r="2" fill={isDragging ? "#4F46E5" : "#9CA3AF"}/>
          <circle cx="13" cy="10" r="2" fill={isDragging ? "#4F46E5" : "#9CA3AF"}/>
          <circle cx="7" cy="15" r="2" fill={isDragging ? "#4F46E5" : "#9CA3AF"}/>
          <circle cx="13" cy="15" r="2" fill={isDragging ? "#4F46E5" : "#9CA3AF"}/>
        </svg>
      </div>

      {/* CONTENT - with pointer events enabled for interaction */}
      <div style={{ 
        pointerEvents: 'auto',
        position: 'relative',
        zIndex: 1
      }}>
        {children}
      </div>
    </div>
  );
};

// ================================================================================
// MAIN EDITOR COMPONENT
// ================================================================================
const Editor = () => {
  // ============================================================================
  // ROUTING & AUTH
  // ============================================================================
  const [searchParams] = useSearchParams();
  const { id: resumeId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isGuest } = useAuth();
  const templateId = searchParams.get('template');
  const action = searchParams.get('action');

  // ============================================================================
  // UI STATE
  // ============================================================================
  const [activeTab, setActiveTab] = useState('personal');
  const [showCustomization, setShowCustomization] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [showRealtimePreview, setShowRealtimePreview] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState(''); // For controlled skill input

  const previewRef = useRef(null);

  // ============================================================================
  // LOADING & STATUS STATE
  // ============================================================================
  const [currentResumeId, setCurrentResumeId] = useState(resumeId || null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', 'error'
  const [guestMode, setGuestMode] = useState(isGuest);
  const [userDataPrefilled, setUserDataPrefilled] = useState(false);

  // ============================================================================
  // CUSTOMIZATION STATE
  // ============================================================================
  const [customization, setCustomization] = useState({
    font: 'Inter',
    fontSize: 'medium',
    colorScheme: 'blue',
    spacing: 'normal',
    layout: 'single-column',
    templateId: templateId || null,
    photoStyle: 'circle',
    photoPosition: 'header'
  });

  // ============================================================================
  // TEMPLATE STATE
  // ============================================================================
  const [currentTemplate, setCurrentTemplate] = useState({
    _id: null,
    name: 'Default',
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #9333EA 70.71%)',
    layout: { type: 'single-column', columns: { count: 1, widths: ['100%'], gap: '0px' } },
    sections: {
      order: ['personal', 'summary', 'experience', 'education', 'skills', 'projects', 'certificates', 'activities'],
      visible: { personal: true, summary: true, experience: true, education: true, skills: true, projects: true, certificates: true, activities: true }
    },
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      sizes: { name: '36px', heading: '20px', subheading: '17px', body: '14px' }
    },
    colors: {
      primary: '#3B82F6',
      secondary: '#1E40AF',
      text: '#111827',
      textLight: '#6B7280',
      background: '#FFFFFF'
    },
    features: { hasPhoto: false, hasIcons: false, hasCharts: false, atsFriendly: true, multiPage: false }
  });

  // ============================================================================
  // SECTION ORDER & VISIBILITY
  // ============================================================================
  const [sectionOrder, setSectionOrder] = useState([
    'personal', 'experience', 'education', 'skills', 'projects', 'certificates', 'activities'
  ]);

  const [sectionVisibility, setSectionVisibility] = useState({
    personal: true,
    experience: true,
    education: true,
    skills: true,
    projects: true,
    certificates: true,
    activities: true
  });

  // Sync section order & visibility with current template
  useEffect(() => {
    if (currentTemplate?.sections?.order) {
      setSectionOrder(currentTemplate.sections.order);
    }
    if (currentTemplate?.sections?.visible) {
      setSectionVisibility(currentTemplate.sections.visible);
    }
  }, [currentTemplate?.sections?.order, currentTemplate?.sections?.visible]);

  // Get visible tabs based on template
  const getVisibleTabs = () => {
    const tabConfig = [
      { id: 'personal', label: 'Personal Info', icon: '👤', alwaysShow: true },
      { id: 'experience', label: 'Experience', icon: '💼' },
      { id: 'education', label: 'Education', icon: '🎓' },
      { id: 'skills', label: 'Skills', icon: '⚡' },
      { id: 'projects', label: 'Projects', icon: '🚀' },
      { id: 'certificates', label: 'Certificates', icon: '🏆' },
      { id: 'activities', label: 'Activities', icon: '🎯' }
    ];

    return tabConfig.filter(tab => 
      tab.alwaysShow || sectionVisibility[tab.id] !== false
    );
  };

  // ============================================================================
  // CV DATA STATE (Main Resume Content)
  // ============================================================================
  const [cvData, setCvData] = useState({
    personal: {
      fullName: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      website: '',
      summary: '',
      photo: '' // Base64 encoded photo
    },
    experience: [],
    education: [],
    skills: {
      technical: [],
      soft: [],
      languages: []
    },
    skillsWithProficiency: [],
    projects: [],
    certificates: [],
    activities: []
  });

  // Use ref to prevent duplicate creation
  const isCreatingRef = useRef(false);

  // Pre-fill personal info from user profile (only for new resumes)
  useEffect(() => {
    const prefillUserData = async () => {
      // Only prefill when creating new resume (no resumeId) and user is authenticated
      if (!currentResumeId && isAuthenticated && !isGuest && user && !userDataPrefilled) {
        try {
          // Fetch full user profile to get phone, location, bio
          const token = localStorage.getItem('token');
          const response = await fetch(API_ENDPOINTS.USER_PROFILE, {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            credentials: 'include'
          });

          const data = await response.json();

          if (response.ok && data.success) {
            setCvData(prev => ({
              ...prev,
              personal: {
                ...prev.personal,
                fullName: user.name || '',
                email: user.email || '',
                phone: data.data.phone || '',
                location: data.data.location || ''
              }
            }));
            setUserDataPrefilled(true);
          }
        } catch (error) {
          console.warn('Could not prefill user data:', error);
          // Fallback to basic user data from AuthContext
          setCvData(prev => ({
            ...prev,
            personal: {
              ...prev.personal,
              fullName: user.name || '',
              email: user.email || ''
            }
          }));
          setUserDataPrefilled(true);
        }
      } else if (!isAuthenticated || isGuest) {
        // For guests, mark as prefilled immediately (no data to prefill)
        setUserDataPrefilled(true);
      }
    };

    prefillUserData();
  }, [currentResumeId, isAuthenticated, isGuest, user, userDataPrefilled]);

  // Create resume when using template
  useEffect(() => {
    const initializeResume = async () => {
      // Wait for user data to be prefilled before creating resume
      if (action === 'use' && templateId && !currentResumeId && !isCreatingRef.current && userDataPrefilled) {
        isCreatingRef.current = true;
        try {
          setLoading(true);

          // Use current cvData (which may have been pre-filled with user data)
          let initialContent = cvData;
          let initialCustomization = { ...customization, templateId: templateId };

          // Fetch template data from backend
          try {
            // Add skipCache=true to get fresh template data
            const templateData = await apiRequest(`${API_ENDPOINTS.TEMPLATE_BY_ID(templateId)}?skipCache=true`);
            if (templateData.success && templateData.data) {
              const template = templateData.data;

              // Set current template with full configuration
              setCurrentTemplate({
                _id: template._id,
                name: template.name,
                description: template.description,
                category: template.category,
                color: template.color || '#3B82F6',
                gradient: template.gradient || 'linear-gradient(135deg, #3B82F6 0%, #9333EA 70.71%)',
                layout: template.layout || { type: 'single-column', columns: { count: 1, widths: ['100%'], gap: '0px' } },
                sections: template.sections || {
                  order: ['personal', 'summary', 'experience', 'education', 'skills', 'projects', 'certificates', 'activities'],
                  visible: { personal: true, summary: true, experience: true, education: true, skills: true, projects: true, certificates: true, activities: true }
                },
                typography: template.typography || {
                  headingFont: 'Inter',
                  bodyFont: 'Inter',
                  sizes: { name: '36px', heading: '20px', subheading: '17px', body: '14px' }
                },
                colors: template.colors || {
                  primary: '#3B82F6',
                  secondary: '#1E40AF',
                  text: '#111827',
                  textLight: '#6B7280',
                  background: '#FFFFFF'
                },
                features: template.features || { hasPhoto: false, hasIcons: false, hasCharts: false, atsFriendly: true, multiPage: false }
              });

              // Apply template config to customization if available
              if (template.config) {
                if (template.config.fontFamily) {
                  initialCustomization.font = template.config.fontFamily;
                }
                if (template.config.fontSize) {
                  initialCustomization.fontSize = template.config.fontSize;
                }
                if (template.config.spacing) {
                  initialCustomization.spacing = template.config.spacing;
                }
                if (template.config.layout) {
                  initialCustomization.layout = template.config.layout;
                }
              }
            }
          } catch (e) {
            console.warn('Could not fetch template data, using defaults.', e);
          }

          // Update state before saving
          setCvData(initialContent);
          setCustomization(initialCustomization);

          // Guest mode - save to Redis
          if (guestMode) {
            const guestResume = await saveGuestResume({
              title: 'Untitled Resume',
              template_id: templateId,
              content: initialContent,
              customization: initialCustomization
            });

            if (guestResume) {
              setCurrentResumeId(guestResume.id);
              setLoading(false); // Clear loading before navigate
              navigate(`/editor/${guestResume.id}`, { replace: true });
            } else {
              setLoading(false);
              throw new Error('Failed to create guest resume');
            }
          }
          // Authenticated mode - save to MongoDB
          else {
            const requestBody = {
              title: 'Untitled Resume',
              template_id: templateId,
              content: initialContent,
              customization: initialCustomization
            };

            const response = await apiRequest(API_ENDPOINTS.RESUMES, {
              method: 'POST',
              body: JSON.stringify(requestBody)
            });

            if (response.success) {
              const newId = response.data._id || response.data.id;
              setCurrentResumeId(newId);
              setLoading(false); // Clear loading before navigate
              navigate(`/editor/${newId}`, { replace: true });
            } else {
              console.error('❌ Failed to create resume:', response);
              setLoading(false);
              throw new Error(response.message || 'Failed to create resume');
            }
          }
        } catch (error) {
          console.error('❌ ERROR CREATING RESUME');
          console.error('Error:', error);
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);

          // Show more detailed error to user
          const errorMsg = error.message || 'Unknown error occurred';
          alert(`Failed to create resume:\n\n${errorMsg}\n\nPlease check:\n1. You are logged in\n2. Backend server is running\n3. Template ID is valid\n\nCheck browser console for more details.`);
        } finally {
          setLoading(false);
          isCreatingRef.current = false;
        }
      }
    };

    initializeResume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, templateId, userDataPrefilled]);

  // Load existing resume if editing
  useEffect(() => {
    const loadResume = async () => {
      if (currentResumeId && !action) {
        try {
          setLoading(true);

          // Guest mode - load from Redis
          if (guestMode) {
            const resume = await getGuestResume(currentResumeId);

            if (resume) {
              if (resume.content) {
                setCvData(resume.content);
              }
              if (resume.customization) {
                setCustomization(prev => ({ ...prev, ...resume.customization }));

                // Fetch template if templateId exists
                if (resume.customization.templateId || resume.template_id) {
                  const tid = resume.customization.templateId || resume.template_id;
                  try {
                    // Use cached template data for performance
                    const templateData = await apiRequest(API_ENDPOINTS.TEMPLATE_BY_ID(tid));
                    if (templateData.success && templateData.data) {
                      const template = templateData.data;
                      setCurrentTemplate({
                        _id: template._id,
                        name: template.name,
                        description: template.description,
                        category: template.category,
                        color: template.color || '#3B82F6',
                        gradient: template.gradient || 'linear-gradient(135deg, #3B82F6 0%, #9333EA 70.71%)',
                        layout: template.layout || { type: 'single-column', columns: { count: 1, widths: ['100%'], gap: '0px' } },
                        sections: template.sections || {
                          order: ['personal', 'summary', 'experience', 'education', 'skills', 'projects', 'certificates', 'activities'],
                          visible: { personal: true, summary: true, experience: true, education: true, skills: true, projects: true, certificates: true, activities: true }
                        },
                        typography: template.typography || {
                          headingFont: 'Inter',
                          bodyFont: 'Inter',
                          sizes: { name: '36px', heading: '20px', subheading: '17px', body: '14px' }
                        },
                        colors: template.colors || {
                          primary: '#3B82F6',
                          secondary: '#1E40AF',
                          text: '#111827',
                          textLight: '#6B7280',
                          background: '#FFFFFF'
                        },
                        features: template.features || { hasPhoto: false, hasIcons: false, hasCharts: false, atsFriendly: true, multiPage: false },
                        photoConfig: template.photoConfig || { style: 'circle', position: 'header' }
                      });
                      
                      // Sync customization layout with template layout
                      setCustomization(prev => ({
                        ...prev,
                        layout: template.layout?.type || prev.layout
                      }));
                    }
                  } catch (e) {
                    console.warn('Could not fetch template:', e);
                  }
                }
              }
            }
          }
          // Authenticated mode - load from MongoDB
          else {
            const response = await apiRequest(API_ENDPOINTS.RESUME_BY_ID(currentResumeId));

            if (response.success && response.data) {
              const resume = response.data;
              if (resume.content) {
                setCvData(resume.content);
              }
              if (resume.customization) {
                setCustomization(prev => ({ ...prev, ...resume.customization }));
              }
              // Set privacy status
              if (resume.isPublic !== undefined) {
                setIsPrivate(!resume.isPublic); // isPrivate is opposite of isPublic
              }

              // Fetch template if exists
              if (resume.template_id || resume.template) {
                const tid = resume.template_id || resume.template?._id || resume.template;
                try {
                  // Use cached template data for performance
                  const templateData = await apiRequest(API_ENDPOINTS.TEMPLATE_BY_ID(tid));
                  if (templateData.success && templateData.data) {
                    const template = templateData.data;
                    setCurrentTemplate({
                      _id: template._id,
                      name: template.name,
                      description: template.description,
                      category: template.category,
                      color: template.color || '#3B82F6',
                      gradient: template.gradient || 'linear-gradient(135deg, #3B82F6 0%, #9333EA 70.71%)',
                      layout: template.layout || { type: 'single-column', columns: { count: 1, widths: ['100%'], gap: '0px' } },
                      sections: template.sections || {
                        order: ['personal', 'summary', 'experience', 'education', 'skills', 'projects', 'certificates', 'activities'],
                        visible: { personal: true, summary: true, experience: true, education: true, skills: true, projects: true, certificates: true, activities: true }
                      },
                      typography: template.typography || {
                        headingFont: 'Inter',
                        bodyFont: 'Inter',
                        sizes: { name: '36px', heading: '20px', subheading: '17px', body: '14px' }
                      },
                      colors: template.colors || {
                        primary: '#3B82F6',
                        secondary: '#1E40AF',
                        text: '#111827',
                        textLight: '#6B7280',
                        background: '#FFFFFF'
                      },
                      features: template.features || { hasPhoto: false, hasIcons: false, hasCharts: false, atsFriendly: true, multiPage: false },
                      photoConfig: template.photoConfig || { style: 'circle', position: 'header' }
                    });
                    
                    // Sync customization layout with template layout
                    setCustomization(prev => ({
                      ...prev,
                      layout: template.layout?.type || prev.layout
                    }));
                  }
                } catch (e) {
                  console.warn('Could not fetch template:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error loading resume:', error);
          alert('Failed to load resume.');
        } finally {
          setLoading(false);
        }
      }
    };

    loadResume();
  }, [currentResumeId, guestMode, action]);

  // Auto-save functionality
  useEffect(() => {
    if (!currentResumeId) return;

    const timer = setTimeout(async () => {
      try {
        setSaveStatus('saving');

        // Guest mode - save to Redis
        if (guestMode) {
          await updateGuestResume(currentResumeId, {
            title: cvData.personal.fullName ? `${cvData.personal.fullName}'s Resume` : 'Untitled Resume',
            content: cvData,
            customization: customization
          });
        }
        // Authenticated mode - save to MongoDB
        else {
          await apiRequest(API_ENDPOINTS.RESUME_BY_ID(currentResumeId), {
            method: 'PUT',
            body: JSON.stringify({
              title: cvData.personal.fullName ? `${cvData.personal.fullName}'s Resume` : 'Untitled Resume',
              content: cvData,
              customization: customization
            })
          });
        }

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (error) {
        console.error('Error auto-saving:', error);
        setSaveStatus('error');
      }
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [cvData, customization, currentResumeId, guestMode]);

  // Detect authentication change and migrate guest data
  useEffect(() => {
    const handleAuthChange = async () => {
      // Only migrate if:
      // 1. User is authenticated (logged in)
      // 2. User is NOT in guest mode (real account, not guest)
      // 3. There is guest data in localStorage to migrate
      if (isAuthenticated && !isGuest && isGuestMode()) {
        try {
          setLoading(true);
          const result = await migrateGuestData();

          if (result.success) {
            setGuestMode(false);
            alert(`Successfully migrated your resume(s)! You can now access them from your dashboard.`);
            navigate('/dashboard');
          }
        } catch (error) {
          console.error('Error migrating guest data:', error);
          alert('Signed in successfully! However, failed to migrate your draft. Please save your resume again.');
          setGuestMode(false);
        } finally {
          setLoading(false);
        }
      }
    };

    handleAuthChange();
  }, [isAuthenticated, isGuest, navigate]);

  // ============================================================================
  // PERSONAL INFO HANDLERS
  // ============================================================================
  /**
   * Update personal information fields (name, email, phone, etc.)
   */
  const updatePersonalInfo = (field, value) => {
    setCvData(prev => ({
      ...prev,
      personal: {
        ...prev.personal,
        [field]: value
      }
    }));
  };

  // ============================================================================
  // ARRAY CRUD HOOKS - Replaces 18+ duplicate functions
  // ============================================================================
  const experienceCRUD = useArrayCRUD(cvData, setCvData, 'experience');
  const educationCRUD = useArrayCRUD(cvData, setCvData, 'education');
  const projectsCRUD = useArrayCRUD(cvData, setCvData, 'projects');
  const certificatesCRUD = useArrayCRUD(cvData, setCvData, 'certificates');
  const activitiesCRUD = useArrayCRUD(cvData, setCvData, 'activities');
  const skillsProfCRUD = useArrayCRUD(cvData, setCvData, 'skillsWithProficiency');

  // ============================================================================
  // EXPERIENCE HANDLERS
  // ============================================================================
  /**
   * Add a new work experience entry - Refactored to use useArrayCRUD
   */
  const addExperience = () => {
    const newExp = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      jobTitle: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: ''
    };
    experienceCRUD.add(newExp);
  };

  const updateExperience = (id, field, value) => experienceCRUD.update(id, field, value);
  const removeExperience = (id) => experienceCRUD.remove(id);

  const addEducation = () => {
    const newEdu = {
      id: `edu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      degree: '',
      school: '',
      location: '',
      startDate: '',
      endDate: '',
      gpa: '',
      description: ''
    };
    educationCRUD.add(newEdu);
  };

  const updateEducation = (id, field, value) => educationCRUD.update(id, field, value);
  const removeEducation = (id) => educationCRUD.remove(id);

  const _addSkill = (category, skill) => {
    if (skill.trim()) {
      setCvData(prev => ({
        ...prev,
        skills: {
          ...prev.skills,
          [category]: [...prev.skills[category], skill.trim()]
        }
      }));
    }
  };

  const _removeSkill = (category, index) => {
    setCvData(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [category]: prev.skills[category].filter((_, i) => i !== index)
      }
    }));
  };

  const addSkillWithProficiency = (name, category = 'technical', proficiency = 3) => {
    if (!name.trim()) return;
    const newSkill = {
      id: `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      category,
      proficiency
    };
    skillsProfCRUD.add(newSkill);
  };

  const updateSkillProficiency = (id, proficiency) => skillsProfCRUD.update(id, 'proficiency', proficiency);
  const removeSkillWithProficiency = (id) => skillsProfCRUD.remove(id);

  const COMMON_SKILLS = {
    technical: {
      'Programming': ['JavaScript', 'Python', 'Java', 'C++', 'TypeScript', 'Go', 'Ruby', 'PHP'],
      'Frontend': ['React', 'Vue.js', 'Angular', 'HTML/CSS', 'Tailwind', 'Next.js', 'Redux'],
      'Backend': ['Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'Laravel', 'Ruby on Rails'],
      'Database': ['MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Firebase', 'DynamoDB'],
      'Cloud': ['AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform'],
      'Tools': ['Git', 'GitHub', 'JIRA', 'VS Code', 'Figma', 'Postman']
    },
    soft: ['Leadership', 'Communication', 'Problem Solving', 'Team Collaboration', 'Time Management', 'Critical Thinking', 'Adaptability', 'Creativity'],
    languages: ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean']
  };

  const ACTION_VERBS = {
    leadership: ['Led', 'Managed', 'Directed', 'Coordinated', 'Supervised', 'Mentored', 'Guided', 'Orchestrated'],
    achievement: ['Achieved', 'Accomplished', 'Delivered', 'Exceeded', 'Improved', 'Increased', 'Reduced', 'Optimized'],
    creation: ['Created', 'Developed', 'Built', 'Designed', 'Implemented', 'Launched', 'Established', 'Initiated'],
    analysis: ['Analyzed', 'Evaluated', 'Assessed', 'Investigated', 'Researched', 'Identified', 'Measured', 'Calculated'],
    collaboration: ['Collaborated', 'Partnered', 'Facilitated', 'Contributed', 'Supported', 'Assisted', 'Cooperated']
  };

  const addAchievement = (expId, verb = '') => {
    setCvData(prev => ({
      ...prev,
      experience: prev.experience.map(exp =>
        exp.id === expId
          ? { ...exp, achievements: [...(exp.achievements || []), verb] }
          : exp
      )
    }));
  };

  const updateAchievement = (expId, index, value) => {
    setCvData(prev => ({
      ...prev,
      experience: prev.experience.map(exp =>
        exp.id === expId
          ? {
              ...exp,
              achievements: exp.achievements.map((ach, i) => i === index ? value : ach)
            }
          : exp
      )
    }));
  };

  const removeAchievement = (expId, index) => {
    setCvData(prev => ({
      ...prev,
      experience: prev.experience.map(exp =>
        exp.id === expId
          ? {
              ...exp,
              achievements: exp.achievements.filter((_, i) => i !== index)
            }
          : exp
      )
    }));
  };

  // ============================================================================
  // PROJECTS HANDLERS
  // ============================================================================
  /**
   * Add a new project entry - Refactored to use useArrayCRUD
   */
  const addProject = () => {
    const newProject = {
      id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      description: '',
      technologies: '',
      link: '',
      startDate: '',
      endDate: ''
    };
    projectsCRUD.add(newProject);
  };

  const updateProject = (id, field, value) => projectsCRUD.update(id, field, value);
  const removeProject = (id) => projectsCRUD.remove(id);

  const addCertificate = () => {
    const newCert = {
      id: `cert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      issuer: '',
      date: '',
      link: '',
      description: ''
    };
    certificatesCRUD.add(newCert);
  };

  const updateCertificate = (id, field, value) => certificatesCRUD.update(id, field, value);
  const removeCertificate = (id) => certificatesCRUD.remove(id);

  const addActivity = () => {
    const newActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: '',
      organization: '',
      startDate: '',
      endDate: '',
      description: ''
    };
    activitiesCRUD.add(newActivity);
  };

  const updateActivity = (id, field, value) => activitiesCRUD.update(id, field, value);
  const removeActivity = (id) => activitiesCRUD.remove(id);

  // Move functions for reordering items - Refactored to use useArrayCRUD
  const _moveExperienceUp = (id) => experienceCRUD.moveUp(id);
  const _moveExperienceDown = (id) => experienceCRUD.moveDown(id);

   

  // ============================================================================
  // SAVE & EXPORT HANDLERS
  // ============================================================================
  /**
   * Export resume to PDF format
   */
  const exportToPDF = async () => {
    if (!currentResumeId) {
      alert('Please save your resume first before exporting.');
      return;
    }

    if (guestMode) {
      alert('PDF export is only available for logged-in users. Please sign in to use this feature.');
      return;
    }

    try {
      setSaveStatus('saving');

      const token = localStorage.getItem('token');
      if (!token) {
        alert('You are not logged in. Please log in to export PDF.');
        setSaveStatus('error');
        return;
      }

      await exportResumeAsHtmlPdf(currentResumeId, previewRef, token);

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setSaveStatus('error');

      // Show detailed error message
      const errorMessage = error.message || 'Failed to export PDF. Please try again.';
      alert(`PDF Export Failed\n\n${errorMessage}\n\nPlease check the console for more details or contact support.`);
    }
  };

  const exportToDOCX = async () => {
    if (!currentResumeId) {
      alert('Please save your resume first before exporting.');
      return;
    }

    if (guestMode) {
      alert('DOCX export is only available for logged-in users. Please sign in to use this feature.');
      return;
    }

    try {
      setSaveStatus('saving');

      // Use resumeService to export
      const { blob, filename } = await resumeService.exportDocx(currentResumeId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error exporting DOCX:', error);
      setSaveStatus('error');
      alert('Failed to export DOCX. Please try again.');
    }
  };

  const saveDraft = async () => {
    if (!currentResumeId) {
      alert('No resume to save. Please create a resume first.');
      return;
    }

    try {
      setSaveStatus('saving');
      await apiRequest(API_ENDPOINTS.RESUME_BY_ID(currentResumeId), {
        method: 'PUT',
        body: JSON.stringify({
          title: cvData.personal.fullName ? `${cvData.personal.fullName}'s Resume` : 'Untitled Resume',
          content: cvData,
          customization: customization
        })
      });
      setSaveStatus('saved');
      alert('Resume saved successfully!');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error saving resume:', error);
      setSaveStatus('error');
      alert('Failed to save resume. Please try again.');
    }
  };

  const generateShareLink = async () => {
    if (!currentResumeId) {
      alert('Please save your resume first before generating share link.');
      return;
    }

    if (guestMode) {
      alert('Share link is only available for logged-in users. Please sign in to use this feature.');
      return;
    }

    try {
      setSaveStatus('saving');

      // Call backend API to generate share link with consent
      const response = await resumeService.generateShareLink(currentResumeId, {
        allowDownload: true,
        consent: true // Explicitly provide consent
      });

      const shareUrl = response.data.shareUrl;
      setShareLink(shareUrl);
      setShowShareModal(true);

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error generating share link:', error);
      setSaveStatus('error');
      alert(error.message || 'Failed to generate share link. Please try again.');
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Link copied to clipboard!');
  };

  const togglePrivateStatus = async () => {
    if (!currentResumeId) {
      alert('Please save your resume first.');
      return;
    }

    try {
      const newPrivateStatus = !isPrivate;
      setIsPrivate(newPrivateStatus);

      // Call API to update share settings
      await resumeService.updateShareSettings(currentResumeId, {
        isPublic: !newPrivateStatus, // isPublic is opposite of isPrivate
        consent: !newPrivateStatus // Require consent when making public
      });

      const statusMessage = newPrivateStatus
        ? 'Resume is now private. The share link will no longer be accessible.'
        : 'Resume is now public. Anyone with the link can view it.';

      alert(statusMessage);
    } catch (error) {
      console.error('Error updating privacy status:', error);
      setIsPrivate(!isPrivate); // Revert on error
      alert(error.message || 'Failed to update privacy status. Please try again.');
    }
  };

  const updateCustomization = (key, value) => {
    setCustomization(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const _moveSectionUp = (index) => {
    if (index > 0) {
      const newOrder = [...sectionOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setSectionOrder(newOrder);
    }
  };

  const _moveSectionDown = (index) => {
    if (index < sectionOrder.length - 1) {
      const newOrder = [...sectionOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setSectionOrder(newOrder);
    }
  };

  const _toggleSectionVisibility = (sectionName) => {
    setSectionVisibility(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  // Drag and Drop Sensors
  // ============================================================================
  // DRAG & DROP SENSORS
  // ============================================================================
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Reduced to 5px for better responsiveness
        delay: 0,
        tolerance: 0
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ============================================================================
  // DRAG & DROP HANDLERS - GENERIC FACTORY
  // ============================================================================
  /**
   * Generic drag handler factory - Replaces 6 duplicate handlers
   * Reduces code from ~90 lines to ~25 lines (-72%)
   */
  const createArrayDragHandler = (arrayKey) => (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setCvData(prev => {
        const array = prev[arrayKey];
        return {
          ...prev,
          [arrayKey]: arrayMove(
            array,
            array.findIndex(item => item.id === active.id),
            array.findIndex(item => item.id === over.id)
          )
        };
      });
    }
  };

  // Handle section drag end (special case - uses sectionOrder state)
  const _handleSectionDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Create all array drag handlers using the factory
  const handleExperienceDragEnd = createArrayDragHandler('experience');
  const handleEducationDragEnd = createArrayDragHandler('education');
  const handleSkillsDragEnd = createArrayDragHandler('skillsWithProficiency');
  const handleProjectDragEnd = createArrayDragHandler('projects');
  const handleCertificateDragEnd = createArrayDragHandler('certificates');
  const handleActivityDragEnd = createArrayDragHandler('activities');

  // Memoized items arrays for stable SortableContext references
  const experienceIds = useMemo(() => cvData.experience.map(e => e.id), [cvData.experience]);
  const educationIds = useMemo(() => cvData.education.map(e => e.id), [cvData.education]);
  const skillsIds = useMemo(() => cvData.skillsWithProficiency.map(s => s.id), [cvData.skillsWithProficiency]);
  const projectsIds = useMemo(() => cvData.projects.map(p => p.id), [cvData.projects]);
  const certificatesIds = useMemo(() => cvData.certificates.map(c => c.id), [cvData.certificates]);
  const activitiesIds = useMemo(() => cvData.activities.map(a => a.id), [cvData.activities]);

  // ============================================================================
  // DRAG & DROP HANDLERS (Preview Side - WYSIWYG)
  // ============================================================================
  /**
   * Handle section reordering from preview (WYSIWYG drag & drop)
   */
  const handlePreviewSectionReorder = (activeId, overId) => {
    if (activeId !== overId) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handle item reordering from preview (using index)
  const handlePreviewExperienceReorder = (activeIndex, overIndex) => {
    if (activeIndex !== overIndex) {
      setCvData(prev => ({
        ...prev,
        experience: arrayMove(prev.experience, activeIndex, overIndex)
      }));
    }
  };

  const handlePreviewEducationReorder = (activeIndex, overIndex) => {
    if (activeIndex !== overIndex) {
      setCvData(prev => ({
        ...prev,
        education: arrayMove(prev.education, activeIndex, overIndex)
      }));
    }
  };

  const handlePreviewProjectsReorder = (activeIndex, overIndex) => {
    if (activeIndex !== overIndex) {
      setCvData(prev => ({
        ...prev,
        projects: arrayMove(prev.projects, activeIndex, overIndex)
      }));
    }
  };

  const handlePreviewCertificatesReorder = (activeIndex, overIndex) => {
    if (activeIndex !== overIndex) {
      setCvData(prev => ({
        ...prev,
        certificates: arrayMove(prev.certificates, activeIndex, overIndex)
      }));
    }
  };

  const handlePreviewActivitiesReorder = (activeIndex, overIndex) => {
    if (activeIndex !== overIndex) {
      setCvData(prev => ({
        ...prev,
        activities: arrayMove(prev.activities, activeIndex, overIndex)
      }));
    }
  };

  const calculateProgress = () => {
    const requiredFields = [
      cvData.personal.fullName,
      cvData.personal.email,
      cvData.personal.phone,
      cvData.experience.some(exp => exp.jobTitle || exp.company),
      cvData.education.some(edu => edu.degree || edu.school),
      cvData.skills.technical.length > 0 || cvData.skills.soft.length > 0
    ];
    const filledCount = requiredFields.filter(Boolean).length;
    return Math.round((filledCount / requiredFields.length) * 100);
  };

  // ============================================================================
  // TEMPLATE & CUSTOMIZATION HANDLERS
  // ============================================================================
  /**
   * Handle template change - Update FULL template configuration
   */
  const handleTemplateChange = async (template) => {
    // Update current template with FULL configuration
    setCurrentTemplate({
      _id: template._id,
      name: template.name,
      description: template.description,
      category: template.category,
      color: template.color || '#3B82F6',
      gradient: template.gradient || 'linear-gradient(135deg, #3B82F6 0%, #9333EA 70.71%)',
      layout: template.layout || { type: 'single-column', columns: { count: 1, widths: ['100%'], gap: '0px' } },
      sections: template.sections || {
        order: ['personal', 'summary', 'experience', 'education', 'skills', 'projects', 'certificates', 'activities'],
        visible: { personal: true, summary: true, experience: true, education: true, skills: true, projects: true, certificates: true, activities: true }
      },
      typography: template.typography || {
        headingFont: 'Inter',
        bodyFont: 'Inter',
        sizes: { name: '36px', heading: '20px', subheading: '17px', body: '14px' }
      },
      colors: template.colors || {
        primary: '#3B82F6',
        secondary: '#1E40AF',
        text: '#111827',
        textLight: '#6B7280',
        background: '#FFFFFF'
      },
      features: template.features || { hasPhoto: false, hasIcons: false, hasCharts: false, atsFriendly: true, multiPage: false },
      photoConfig: template.photoConfig || { enabled: false, style: 'circle', position: 'header', size: 'medium' }
    });

    // RESET customization to template defaults (no carry-over from previous template)
    setCustomization({
      font: template.typography?.headingFont || 'Inter',
      fontSize: 'medium',
      colorScheme: template.category || 'blue',
      spacing: 'normal',
      layout: template.layout?.type || 'single-column',
      templateId: template._id,
      photoStyle: template.photoConfig?.style || 'circle',
      photoPosition: template.photoConfig?.position || 'header',
      primaryColor: template.colors?.primary || '#3B82F6',
      accentColor: template.colors?.secondary || '#1E40AF',
      lineHeight: 1.6,
      margins: 40
    });

    // RESET section order to template defaults
    const templateSectionOrder = template.sections?.order || [
      'personal', 'summary', 'experience', 'education', 'skills', 'projects', 'certificates', 'activities'
    ];
    setSectionOrder(templateSectionOrder);

    // RESET section visibility to template defaults
    const templateSectionVisibility = template.sections?.visible || {
      personal: true,
      summary: true,
      experience: true,
      education: true,
      skills: true,
      projects: true,
      certificates: true,
      activities: true
    };
    setSectionVisibility(templateSectionVisibility);
  };

  // Handle photo upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Convert to base64 for storage
    const reader = new FileReader();
    reader.onloadend = () => {
      updatePersonalInfo('photo', reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Remove photo
  const handlePhotoRemove = () => {
    updatePersonalInfo('photo', '');
  };

  return (
    <>
    <div className="editor-page">
      {/* Loading Screen */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #4f46e5',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}></div>
          <p style={{ marginTop: '20px', fontSize: '16px', color: '#6B7280' }}>
            Creating your resume...
          </p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Header */}
      <header className="editor-header">
        <div className="editor-header-content">
          <Link to="/dashboard" className="btn-back">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 18l-8-8 8-8M2 10h16" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Back to Dashboard</span>
          </Link>

          <div className="editor-title-section">
            <input
              type="text"
              className="resume-title-input"
              value={cvData.personal.fullName ? `${cvData.personal.fullName}'s Resume` : "My Professional Resume"}
              placeholder="Resume Title"
              readOnly
            />
            {saveStatus && (
              <span className={`save-status save-status-${saveStatus}`}>
                {saveStatus === 'saving' && '💾 Saving...'}
                {saveStatus === 'saved' && '✓ Saved'}
                {saveStatus === 'error' && '⚠ Error saving'}
              </span>
            )}
          </div>

          <div className="editor-actions">
            <button className="btn-action btn-realtime" onClick={() => setShowRealtimePreview(true)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" stroke="#4F46E5" strokeWidth="1.5"/>
                <path d="M8 6.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5S6.5 8.83 6.5 8 7.17 6.5 8 6.5z" fill="#4F46E5"/>
              </svg>
              <span>View Realtime</span>
            </button>
            <button className="btn-action" onClick={() => setShowCustomization(!showCustomization)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="#374151" strokeWidth="1.5"/>
                <path d="M14 8c0-.5-.1-1-.3-1.4l1.2-1.2-2-2-1.2 1.2c-.4-.2-.9-.3-1.4-.3-.5 0-1 .1-1.4.3L7.7 3.4l-2 2 1.2 1.2c-.2.4-.3.9-.3 1.4 0 .5.1 1 .3 1.4l-1.2 1.2 2 2 1.2-1.2c.4.2.9.3 1.4.3.5 0 1-.1 1.4-.3l1.2 1.2 2-2-1.2-1.2c.2-.4.3-.9.3-1.4z" stroke="#374151" strokeWidth="1.5"/>
              </svg>
              <span>Customize</span>
            </button>
            <button className="btn-action" onClick={generateShareLink}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 6l3-3m0 0l-3-3m3 3H6a4 4 0 00-4 4v1m4 5l-3 3m0 0l3 3m-3-3h8a4 4 0 004-4v-1" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>Share</span>
            </button>
            <button className="btn-action" onClick={saveDraft}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 2H4a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2zM10 2v4H6V2m2 6h0" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>Save</span>
            </button>
            <button className="btn-action btn-primary" onClick={exportToPDF}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 8h8M4 4h8M4 12h5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>Export PDF</span>
            </button>
            <button className="btn-action" onClick={exportToDOCX}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3m8-5l-2-2m0 0L6 5m2-2v10" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>DOCX</span>
            </button>
          </div>
        </div>
      </header>

      {/* Guest Mode Banner */}
      {guestMode && (
        <div className="guest-mode-banner">
          <div className="guest-banner-content">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 12a1 1 0 110-2 1 1 0 010 2zm1-4a1 1 0 01-2 0V6a1 1 0 112 0v4z" fill="#F59E0B"/>
            </svg>
            <div className="guest-banner-text">
              <strong>Guest Mode:</strong> Your resume will be saved temporarily for 24 hours.
              <Link to="/login" className="guest-banner-link">Sign in</Link> to save permanently.
            </div>
          </div>
        </div>
      )}

      {/* Main Editor */}
      <div className="editor-main">
        {/* Left Sidebar - Form */}
        <div className="editor-sidebar">
          {/* Template Info Banner */}
          {currentTemplate && currentTemplate._id && (
            <div style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#FFFFFF',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                📄 {currentTemplate.name}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                {currentTemplate.description}
              </div>
            </div>
          )}

          <div className="editor-tabs">
            {getVisibleTabs().map(tab => (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="editor-form">
            {/* ================================================================
                FORM TAB: PERSONAL INFORMATION
                ================================================================ */}
            {activeTab === 'personal' && (
              <div className="form-section">
                <h3 className="section-title">Personal Information</h3>

                {/* Photo Upload */}
                <div className="form-group">
                  <label>Profile Photo</label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    background: '#F9FAFB',
                    borderRadius: '12px',
                    border: '2px dashed #D1D5DB'
                  }}>
                    {cvData.personal.photo ? (
                      <>
                        <div style={{
                          width: '100px',
                          height: '100px',
                          borderRadius: customization.photoStyle === 'circle' ? '50%' : customization.photoStyle === 'rounded' ? '12px' : '0',
                          overflow: 'hidden',
                          border: '3px solid #4F46E5',
                          flexShrink: 0
                        }}>
                          <img
                            src={cvData.personal.photo}
                            alt="Profile"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
                            Photo uploaded successfully!
                          </p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <label style={{
                              padding: '6px 12px',
                              background: '#4F46E5',
                              color: '#FFFFFF',
                              borderRadius: '6px',
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'inline-block'
                            }}>
                              Change Photo
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                style={{ display: 'none' }}
                              />
                            </label>
                            <button
                              onClick={handlePhotoRemove}
                              style={{
                                padding: '6px 12px',
                                background: '#EF4444',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                cursor: 'pointer'
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{
                          width: '100px',
                          height: '100px',
                          borderRadius: customization.photoStyle === 'circle' ? '50%' : customization.photoStyle === 'rounded' ? '12px' : '0',
                          background: '#E5E7EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#9CA3AF"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px', fontWeight: '500' }}>
                            Add a profile photo (optional)
                          </p>
                          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
                            JPG, PNG or GIF • Max 5MB • Square format recommended
                          </p>
                          <label style={{
                            padding: '8px 16px',
                            background: '#4F46E5',
                            color: '#FFFFFF',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'inline-block',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#4338CA'}
                          onMouseLeave={(e) => e.target.style.background = '#4F46E5'}
                          >
                            📷 Upload Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                  {currentTemplate.features?.hasPhoto && (
                    <p style={{ fontSize: '12px', color: '#10B981', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>✓</span> This template supports photos
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={cvData.personal.fullName}
                    onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    placeholder="john.doe@example.com"
                    value={cvData.personal.email}
                    onChange={(e) => updatePersonalInfo('email', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={cvData.personal.phone}
                    onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    placeholder="New York, NY"
                    value={cvData.personal.location}
                    onChange={(e) => updatePersonalInfo('location', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>LinkedIn</label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/johndoe"
                    value={cvData.personal.linkedin}
                    onChange={(e) => updatePersonalInfo('linkedin', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Website/Portfolio</label>
                  <input
                    type="url"
                    placeholder="https://johndoe.com"
                    value={cvData.personal.website}
                    onChange={(e) => updatePersonalInfo('website', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Professional Summary</label>
                  <textarea
                    rows="4"
                    placeholder="Brief description of your professional background and career goals..."
                    value={cvData.personal.summary}
                    onChange={(e) => updatePersonalInfo('summary', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* ================================================================
                FORM TAB: WORK EXPERIENCE - CANVA STYLE
                ================================================================ */}
            {activeTab === 'experience' && (
              <div className="form-section">
                <div className="section-header">
                  <h3 className="section-title">Work Experience</h3>
                  <button className="btn-add" onClick={addExperience}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10m-5-5h10" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>Add Experience</span>
                  </button>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExperienceDragEnd}>
                  <SortableContext items={experienceIds} strategy={verticalListSortingStrategy}>
                    {cvData.experience.map((exp, index) => (
                      <SortableFormItem key={exp.id} id={exp.id}>
                        <div className="item-header">
                          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                            Experience {index + 1}
                          </h4>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn-remove"
                              onClick={() => removeExperience(exp.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                    <div className="form-group">
                      <label>Job Title *</label>
                      <input
                        type="text"
                        placeholder="Senior Software Engineer"
                        value={exp.jobTitle}
                        onChange={(e) => updateExperience(exp.id, 'jobTitle', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Company *</label>
                      <input
                        type="text"
                        placeholder="TechCorp Inc."
                        value={exp.company}
                        onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Location</label>
                      <input
                        type="text"
                        placeholder="San Francisco, CA"
                        value={exp.location}
                        onChange={(e) => updateExperience(exp.id, 'location', e.target.value)}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Start Date *</label>
                        <input
                          type="month"
                          value={exp.startDate}
                          onChange={(e) => updateExperience(exp.id, 'startDate', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>End Date</label>
                        <input
                          type="month"
                          value={exp.endDate}
                          onChange={(e) => updateExperience(exp.id, 'endDate', e.target.value)}
                          disabled={exp.current}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={exp.current}
                          onChange={(e) => updateExperience(exp.id, 'current', e.target.checked)}
                        />
                        <span>I currently work here</span>
                      </label>
                    </div>

                    {/* Achievement-Focused Section */}
                    <div style={{ marginTop: '24px', padding: '16px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                          🎯 Key Achievements & Impact
                        </h5>
                        <button
                          onClick={() => addAchievement(exp.id, '• ')}
                          style={{
                            padding: '4px 12px',
                            fontSize: '13px',
                            background: '#EEF2FF',
                            color: '#4F46E5',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          + Add Achievement
                        </button>
                      </div>
                      
                      <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
                        Use action verbs and quantify your impact with metrics (%, $, #)
                      </p>

                      {/* Action Verb Suggestions */}
                      <details style={{ marginBottom: '12px' }}>
                        <summary style={{ fontSize: '13px', color: '#4F46E5', cursor: 'pointer', fontWeight: '500' }}>
                          💡 Action Verb Suggestions
                        </summary>
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {Object.entries(ACTION_VERBS).map(([category, verbs]) => (
                            <div key={category} style={{ marginBottom: '8px', width: '100%' }}>
                              <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px', textTransform: 'capitalize' }}>
                                {category}:
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {verbs.map(verb => (
                                  <button
                                    key={verb}
                                    onClick={() => addAchievement(exp.id, `• ${verb} `)}
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '11px',
                                      background: '#F3F4F6',
                                      color: '#374151',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {verb}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>

                      {/* Achievements List */}
                      {exp.achievements && exp.achievements.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {exp.achievements.map((achievement, achIndex) => (
                            <div key={achIndex} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <textarea
                                value={achievement}
                                onChange={(e) => updateAchievement(exp.id, achIndex, e.target.value)}
                                placeholder="• Led team of 5 engineers to deliver project 30% ahead of schedule"
                                rows="2"
                                style={{
                                  flex: 1,
                                  fontSize: '13px',
                                  padding: '8px',
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '6px',
                                  resize: 'vertical'
                                }}
                              />
                              <button
                                onClick={() => removeAchievement(exp.id, achIndex)}
                                style={{
                                  padding: '4px 8px',
                                  background: '#FEE2E2',
                                  color: '#DC2626',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Examples */}
                      <details style={{ marginTop: '12px' }}>
                        <summary style={{ fontSize: '12px', color: '#6B7280', cursor: 'pointer' }}>
                          📝 See Examples
                        </summary>
                        <ul style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px', paddingLeft: '20px' }}>
                          <li>Increased sales revenue by 45% ($2M) through strategic partnership initiatives</li>
                          <li>Led cross-functional team of 12 to deliver product launch 3 months ahead of schedule</li>
                          <li>Reduced operational costs by $500K annually through process optimization</li>
                          <li>Improved customer satisfaction score from 3.2 to 4.7 out of 5</li>
                        </ul>
                      </details>
                    </div>

                    {/* Legacy Description Field */}
                    {(!exp.achievements || exp.achievements.length === 0) && (
                      <div className="form-group" style={{ marginTop: '16px' }}>
                        <label>Description (Legacy Format)</label>
                        <textarea
                          rows="4"
                          placeholder="Describe your responsibilities and achievements..."
                          value={exp.description}
                          onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                        />
                        <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                          💡 Tip: Use the Achievement section above for better impact!
                        </p>
                      </div>
                    )}
                </SortableFormItem>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

            {/* ================================================================
                FORM TAB: EDUCATION
                ================================================================ */}
            {activeTab === 'education' && (
              <div className="form-section">
                <div className="section-header">
                  <h3 className="section-title">Education</h3>
                  <button className="btn-add" onClick={addEducation}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10m-5-5h10" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>Add Education</span>
                  </button>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEducationDragEnd}>
                  <SortableContext items={educationIds} strategy={verticalListSortingStrategy}>
                    {cvData.education.map((edu, index) => (
                      <SortableFormItem key={edu.id} id={edu.id}>
                        <div className="item-header">
                          <h4>Education {index + 1}</h4>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn-remove"
                              onClick={() => removeEducation(edu.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Degree *</label>
                          <input
                            type="text"
                            placeholder="Bachelor of Science in Computer Science"
                            value={edu.degree}
                            onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                          />
                          </div>

                          <div className="form-group">
                            <label>School *</label>
                            <input
                              type="text"
                              placeholder="University of California, Berkeley"
                              value={edu.school}
                              onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label>Location</label>
                            <input
                              type="text"
                              placeholder="Berkeley, CA"
                              value={edu.location}
                              onChange={(e) => updateEducation(edu.id, 'location', e.target.value)}
                            />
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label>Start Date *</label>
                              <input
                                type="month"
                                value={edu.startDate}
                                onChange={(e) => updateEducation(edu.id, 'startDate', e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label>End Date</label>
                              <input
                                type="month"
                                value={edu.endDate}
                                onChange={(e) => updateEducation(edu.id, 'endDate', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label>GPA</label>
                            <input
                              type="text"
                              placeholder="3.8/4.0"
                              value={edu.gpa}
                              onChange={(e) => updateEducation(edu.id, 'gpa', e.target.value)}
                            />
                          </div>

                        <div className="form-group">
                          <label>Description</label>
                          <textarea
                            rows="3"
                            placeholder="Relevant coursework, honors, achievements..."
                            value={edu.description}
                            onChange={(e) => updateEducation(edu.id, 'description', e.target.value)}
                          />
                        </div>
                      </SortableFormItem>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* ================================================================
                FORM TAB: SKILLS - CANVA STYLE
                ================================================================ */}
            {activeTab === 'skills' && (
              <div className="form-section">
                <h3 className="section-title">Skills & Expertise</h3>
                <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
                  Add your skills with proficiency levels. Use the slider to rate yourself.
                </p>

                {/* Quick Add Common Skills */}
                <div style={{ marginBottom: '32px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                    Quick Add Popular Skills
                  </h4>
                  {Object.entries(COMMON_SKILLS.technical).map(([category, skills]) => (
                    <div key={category} style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#6B7280', marginBottom: '8px' }}>
                        {category}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {skills.map(skill => (
                          <button
                            key={skill}
                            onClick={() => addSkillWithProficiency(skill, 'technical', 3)}
                            disabled={cvData.skillsWithProficiency.some(s => s.name === skill)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '13px',
                              background: cvData.skillsWithProficiency.some(s => s.name === skill) ? '#E5E7EB' : '#EEF2FF',
                              color: cvData.skillsWithProficiency.some(s => s.name === skill) ? '#9CA3AF' : '#4F46E5',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: cvData.skillsWithProficiency.some(s => s.name === skill) ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {cvData.skillsWithProficiency.some(s => s.name === skill) ? '✓ ' : '+ '}{skill}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Skill Input */}
                <div className="form-group">
                  <label>Add Custom Skill</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Type skill name and press Enter..."
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newSkillInput.trim()) {
                          addSkillWithProficiency(newSkillInput.trim(), 'technical', 3);
                          setNewSkillInput('');
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                {/* Empty State */}
                {cvData.skillsWithProficiency.length === 0 && (
                  <div style={{
                    marginTop: '32px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    background: '#F9FAFB',
                    borderRadius: '12px',
                    border: '2px dashed #E5E7EB'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      No skills added yet
                    </h4>
                    <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
                      Click the buttons above to add popular skills, or type a custom skill name
                    </p>
                  </div>
                )}

                {/* Skills List with Proficiency Sliders */}
                {cvData.skillsWithProficiency.length > 0 && (
                  <div style={{ marginTop: '32px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
                      Your Skills ({cvData.skillsWithProficiency.length})
                    </h4>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSkillsDragEnd}>
                      <SortableContext items={skillsIds} strategy={verticalListSortingStrategy}>
                        {cvData.skillsWithProficiency.map(skill => (
                          <SortableFormItem key={skill.id} id={skill.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                              {skill.name}
                            </span>
                            <button
                              onClick={() => removeSkillWithProficiency(skill.id)}
                              style={{
                                padding: '4px 8px',
                                background: '#FEE2E2',
                                color: '#DC2626',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '13px', color: '#6B7280', minWidth: '80px' }}>
                              Proficiency:
                            </span>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              value={skill.proficiency}
                              onChange={(e) => updateSkillProficiency(skill.id, parseInt(e.target.value))}
                              style={{
                                flex: 1,
                                height: '8px',
                                borderRadius: '4px',
                                outline: 'none',
                                background: `linear-gradient(to right, #4F46E5 0%, #4F46E5 ${(skill.proficiency / 5) * 100}%, #E5E7EB ${(skill.proficiency / 5) * 100}%, #E5E7EB 100%)`
                              }}
                            />
                            <div style={{ display: 'flex', gap: '4px', minWidth: '100px' }}>
                              {[1, 2, 3, 4, 5].map(level => (
                                <span
                                  key={level}
                                  style={{
                                    fontSize: '16px',
                                    color: level <= skill.proficiency ? '#FBBF24' : '#E5E7EB'
                                  }}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6B7280' }}>
                            {skill.proficiency === 1 && 'Beginner - Basic knowledge'}
                            {skill.proficiency === 2 && 'Intermediate - Working knowledge'}
                            {skill.proficiency === 3 && 'Proficient - Strong skills'}
                            {skill.proficiency === 4 && 'Advanced - Expert level'}
                            {skill.proficiency === 5 && 'Master - Industry expert'}
                          </div>
                      </SortableFormItem>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}

                {/* Legacy Skills (for backward compatibility) */}
                {(cvData.skills.technical.length > 0 || cvData.skills.soft.length > 0 || cvData.skills.languages.length > 0) && (
                  <div style={{ marginTop: '32px', padding: '16px', background: '#FEF3C7', borderRadius: '12px', border: '1px solid #FCD34D' }}>
                    <p style={{ fontSize: '13px', color: '#92400E', marginBottom: '8px', fontWeight: '500' }}>
                      ⚠️ Legacy Skills Format
                    </p>
                    <p style={{ fontSize: '12px', color: '#78350F', marginBottom: '12px' }}>
                      These skills are in the old format. Consider migrating them to the new format with proficiency levels.
                    </p>
                    {cvData.skills.technical.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ fontSize: '12px' }}>Technical:</strong> {cvData.skills.technical.join(', ')}
                      </div>
                    )}
                    {cvData.skills.soft.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <strong style={{ fontSize: '12px' }}>Soft:</strong> {cvData.skills.soft.join(', ')}
                      </div>
                    )}
                    {cvData.skills.languages.length > 0 && (
                      <div>
                        <strong style={{ fontSize: '12px' }}>Languages:</strong> {cvData.skills.languages.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================
                FORM TAB: PROJECTS
                ================================================================ */}
            {activeTab === 'projects' && (
              <div className="form-section">
                <div className="section-header">
                  <h3 className="section-title">Projects</h3>
                  <button className="btn-add" onClick={addProject}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10m-5-5h10" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>Add Project</span>
                  </button>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
                  <SortableContext items={projectsIds} strategy={verticalListSortingStrategy}>
                    {cvData.projects.map((project, index) => (
                      <SortableFormItem key={project.id} id={project.id}>
                        <div className="item-header">
                          <h4>Project {index + 1}</h4>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn-remove"
                              onClick={() => removeProject(project.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Project Name *</label>
                          <input
                            type="text"
                            placeholder="E-commerce Platform"
                            value={project.name}
                            onChange={(e) => updateProject(project.id, 'name', e.target.value)}
                          />
                        </div>

                        <div className="form-group">
                            <label>Description *</label>
                            <textarea
                              rows="3"
                              placeholder="Describe what the project does and your role..."
                              value={project.description}
                              onChange={(e) => updateProject(project.id, 'description', e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label>Technologies Used</label>
                            <input
                              type="text"
                              placeholder="React, Node.js, MongoDB, AWS"
                              value={project.technologies}
                              onChange={(e) => updateProject(project.id, 'technologies', e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label>Project Link</label>
                            <input
                              type="url"
                              placeholder="https://github.com/username/project"
                              value={project.link}
                              onChange={(e) => updateProject(project.id, 'link', e.target.value)}
                            />
                          </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Start Date</label>
                            <input
                              type="month"
                              value={project.startDate}
                              onChange={(e) => updateProject(project.id, 'startDate', e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label>End Date</label>
                            <input
                              type="month"
                              value={project.endDate}
                              onChange={(e) => updateProject(project.id, 'endDate', e.target.value)}
                            />
                          </div>
                        </div>
                      </SortableFormItem>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* ================================================================
                FORM TAB: CERTIFICATES & LICENSES
                ================================================================ */}
            {activeTab === 'certificates' && (
              <div className="form-section">
                <div className="section-header">
                  <h3 className="section-title">Certificates & Licenses</h3>
                  <button className="btn-add" onClick={addCertificate}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10m-5-5h10" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>Add Certificate</span>
                  </button>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCertificateDragEnd}>
                  <SortableContext items={certificatesIds} strategy={verticalListSortingStrategy}>
                    {cvData.certificates.map((cert, index) => (
                      <SortableFormItem key={cert.id} id={cert.id}>
                        <div className="item-header">
                          <h4>Certificate {index + 1}</h4>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn-remove"
                              onClick={() => removeCertificate(cert.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Certificate Name *</label>
                          <input
                            type="text"
                            placeholder="AWS Certified Solutions Architect"
                            value={cert.name}
                            onChange={(e) => updateCertificate(cert.id, 'name', e.target.value)}
                          />
                        </div>

                        <div className="form-group">
                          <label>Issuing Organization *</label>
                          <input
                            type="text"
                            placeholder="Amazon Web Services"
                              value={cert.issuer}
                              onChange={(e) => updateCertificate(cert.id, 'issuer', e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label>Date Issued</label>
                            <input
                              type="month"
                              value={cert.date}
                              onChange={(e) => updateCertificate(cert.id, 'date', e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label>Certificate Link</label>
                            <input
                              type="url"
                              placeholder="https://www.credly.com/badges/..."
                              value={cert.link}
                              onChange={(e) => updateCertificate(cert.id, 'link', e.target.value)}
                            />
                          </div>

                        <div className="form-group">
                          <label>Description</label>
                          <textarea
                            rows="3"
                            placeholder="Brief description of what this certification covers..."
                            value={cert.description}
                            onChange={(e) => updateCertificate(cert.id, 'description', e.target.value)}
                          />
                        </div>
                      </SortableFormItem>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* ================================================================
                FORM TAB: ACTIVITIES & VOLUNTEERING
                ================================================================ */}
            {activeTab === 'activities' && (
              <div className="form-section">
                <div className="section-header">
                  <h3 className="section-title">Activities & Volunteering</h3>
                  <button className="btn-add" onClick={addActivity}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10m-5-5h10" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>Add Activity</span>
                  </button>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleActivityDragEnd}>
                  <SortableContext items={activitiesIds} strategy={verticalListSortingStrategy}>
                    {cvData.activities.map((activity, index) => (
                      <SortableFormItem key={activity.id} id={activity.id}>
                        <div className="item-header">
                          <h4>Activity {index + 1}</h4>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn-remove"
                              onClick={() => removeActivity(activity.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Title/Role *</label>
                          <input
                            type="text"
                            placeholder="Volunteer Coordinator"
                            value={activity.title}
                            onChange={(e) => updateActivity(activity.id, 'title', e.target.value)}
                          />
                        </div>

                        <div className="form-group">
                          <label>Organization *</label>
                          <input
                            type="text"
                              placeholder="Red Cross"
                              value={activity.organization}
                              onChange={(e) => updateActivity(activity.id, 'organization', e.target.value)}
                            />
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label>Start Date</label>
                              <input
                                type="month"
                                value={activity.startDate}
                                onChange={(e) => updateActivity(activity.id, 'startDate', e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label>End Date</label>
                              <input
                                type="month"
                                value={activity.endDate}
                                onChange={(e) => updateActivity(activity.id, 'endDate', e.target.value)}
                              />
                            </div>
                          </div>

                        <div className="form-group">
                          <label>Description</label>
                          <textarea
                            rows="3"
                            placeholder="Describe your role and contributions..."
                            value={activity.description}
                            onChange={(e) => updateActivity(activity.id, 'description', e.target.value)}
                          />
                        </div>
                      </SortableFormItem>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Preview */}
        <div className="editor-preview">
          <div className="preview-header">
            <div>
              <h3>Live Preview - {currentTemplate.name}</h3>
              <div className="progress-indicator">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${calculateProgress()}%` }}
                  />
                </div>
                <span className="progress-text">{calculateProgress()}% Complete</span>
              </div>
            </div>
            <div className="preview-actions">
              <TemplateSwitcher
                currentTemplateId={currentTemplate._id}
                onTemplateChange={handleTemplateChange}
              />
              <button className="btn-zoom">100%</button>
            </div>
          </div>

          <div className="preview-content">
            <div className="resume-preview-wrapper">
              <ResumePreview
                cvData={cvData}
                customization={customization}
                template={{
                  ...currentTemplate,
                  sections: {
                    ...currentTemplate.sections,
                    order: sectionOrder
                  }
                }}
                editable={true}
                onReorderSections={handlePreviewSectionReorder}
                onReorderExperience={handlePreviewExperienceReorder}
                onReorderEducation={handlePreviewEducationReorder}
                onReorderProjects={handlePreviewProjectsReorder}
                onReorderCertificates={handlePreviewCertificatesReorder}
                onReorderActivities={handlePreviewActivitiesReorder}
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Customization Panel */}
    {showCustomization && (
      <div className="customization-overlay" onClick={() => setShowCustomization(false)}>
        <div className="customization-panel" onClick={(e) => e.stopPropagation()}>
          <div className="panel-header">
            <h3>Customize Your CV</h3>
            <button className="btn-close" onClick={() => setShowCustomization(false)}>×</button>
          </div>
          <div className="panel-body">
            <div className="customization-group">
              <label>Current Template</label>
              <div style={{
                padding: '12px',
                background: currentTemplate.gradient,
                borderRadius: '8px',
                color: '#FFFFFF',
                fontWeight: '600',
                textAlign: 'center',
                marginBottom: '12px'
              }}>
                {currentTemplate.name}
              </div>
              <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
                Layout: <strong>{currentTemplate.layout?.type || 'single-column'}</strong>
              </p>
              
              {/* Template Switcher */}
              <TemplateSwitcher
                currentTemplateId={currentTemplate._id}
                onTemplateChange={handleTemplateChange}
                inline={true}
              />
            </div>

            <div className="customization-group">
              <label>Font Family</label>
              <select value={customization.font} onChange={(e) => updateCustomization('font', e.target.value)}>
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Lato">Lato</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Poppins">Poppins</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Merriweather">Merriweather</option>
              </select>
            </div>

            <div className="customization-group">
              <label>Primary Color</label>
              <input
                type="color"
                value={customization.primaryColor}
                onChange={(e) => updateCustomization('primaryColor', e.target.value)}
              />
            </div>

            <div className="customization-group">
              <label>Accent Color</label>
              <input
                type="color"
                value={customization.accentColor}
                onChange={(e) => updateCustomization('accentColor', e.target.value)}
              />
            </div>

            <div className="customization-group">
              <label>Font Size</label>
              <input
                type="range"
                min="12"
                max="18"
                value={customization.fontSize}
                onChange={(e) => updateCustomization('fontSize', parseInt(e.target.value))}
              />
              <span>{customization.fontSize}px</span>
            </div>

            <div className="customization-group">
              <label>Line Height</label>
              <input
                type="range"
                min="1.3"
                max="2"
                step="0.1"
                value={customization.lineHeight}
                onChange={(e) => updateCustomization('lineHeight', parseFloat(e.target.value))}
              />
              <span>{customization.lineHeight}</span>
            </div>

            <div className="customization-group">
              <label>Spacing</label>
              <input
                type="range"
                min="0"
                max="40"
                value={customization.spacing}
                onChange={(e) => updateCustomization('spacing', parseInt(e.target.value))}
              />
              <span>{customization.spacing}px</span>
            </div>

            <div className="customization-group">
              <label>Page Margins</label>
              <input
                type="range"
                min="10"
                max="60"
                value={customization.margins}
                onChange={(e) => updateCustomization('margins', parseInt(e.target.value))}
              />
              <span>{customization.margins}px</span>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Realtime Preview Modal */}
    {showRealtimePreview && (
      <div className="realtime-preview-overlay" onClick={() => setShowRealtimePreview(false)}>
        <div className="realtime-preview-modal" onClick={(e) => e.stopPropagation()}>
          <div className="realtime-preview-header">
            <h3>Realtime Preview - {currentTemplate.name}</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="progress-indicator">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${calculateProgress()}%` }}
                  />
                </div>
                <span className="progress-text">{calculateProgress()}% Complete</span>
              </div>
              <button className="btn-close-preview" onClick={() => setShowRealtimePreview(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="realtime-preview-content">
            <div className="resume-preview-wrapper">
              <ResumePreview
                cvData={cvData}
                customization={customization}
                template={{
                  ...currentTemplate,
                  sections: {
                    ...currentTemplate.sections,
                    order: sectionOrder,
                    visible: sectionVisibility
                  }
                }}
                editable={false}
              />
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Hidden Preview for PDF Export - Always rendered but hidden */}
    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden' }}>
      <ResumePreview
        ref={previewRef}
        cvData={cvData}
        customization={customization}
        template={{
          ...currentTemplate,
          sections: {
            ...currentTemplate.sections,
            order: sectionOrder,
            visible: sectionVisibility
          }
        }}
        editable={false}
      />
    </div>

    {/* Share Modal */}
    {showShareModal && (
      <div className="share-modal-overlay" onClick={() => setShowShareModal(false)}>
        <div className="share-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Share Your CV</h3>
            <button className="btn-close" onClick={() => setShowShareModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <p className="modal-description">
              Anyone with this link will be able to view your CV
            </p>
            <div className="share-link-container">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="share-link-input"
              />
              <button className="btn-copy" onClick={copyShareLink}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M11 2H4a2 2 0 00-2 2v7m4-5h7a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Copy
              </button>
            </div>
            <div className="share-options">
              <h4>Share via:</h4>
              <div className="share-buttons">
                <button className="btn-share-social">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M20 10c0-5.523-4.477-10-10-10S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z" fill="#1877F2"/>
                  </svg>
                  Facebook
                </button>
                <button className="btn-share-social">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M19.59 3.07a8.15 8.15 0 01-2.36.65 4.12 4.12 0 001.8-2.27c-.79.47-1.66.81-2.59 1A4.08 4.08 0 0013.55 1c-2.26 0-4.1 1.84-4.1 4.1 0 .32.04.63.1.93A11.64 11.64 0 011.64 1.9a4.08 4.08 0 001.27 5.47c-.68-.02-1.32-.21-1.88-.52v.05c0 1.99 1.42 3.65 3.3 4.03-.34.09-.71.14-1.08.14-.26 0-.52-.02-.77-.07.52 1.63 2.03 2.82 3.83 2.85A8.21 8.21 0 010 15.54a11.57 11.57 0 006.29 1.85c7.55 0 11.68-6.25 11.68-11.67 0-.18 0-.36-.01-.53A8.35 8.35 0 0020 3.07h-.41z" fill="#1DA1F2"/>
                  </svg>
                  Twitter
                </button>
                <button className="btn-share-social">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M18.52 0H1.476C.66 0 0 .645 0 1.44v17.12C0 19.355.66 20 1.476 20h17.044c.816 0 1.48-.645 1.48-1.44V1.44C20 .645 19.336 0 18.52 0zM5.934 17.04H2.967V7.5h2.97v9.54h-.003zM4.45 6.195c-.952 0-1.723-.775-1.723-1.73 0-.954.771-1.73 1.723-1.73.95 0 1.72.776 1.72 1.73 0 .955-.77 1.73-1.72 1.73zM17.04 17.04h-2.963v-4.64c0-1.105-.02-2.526-1.54-2.526-1.54 0-1.776 1.202-1.776 2.444v4.722H7.8V7.5h2.844v1.305h.04c.396-.75 1.364-1.54 2.808-1.54 3.003 0 3.557 1.977 3.557 4.547v5.228h-.008z" fill="#0077B5"/>
                  </svg>
                  LinkedIn
                </button>
              </div>
            </div>
            <div className="share-settings">
              <label className="share-setting-item">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={togglePrivateStatus}
                />
                <span style={{ fontWeight: isPrivate ? '600' : '400', color: isPrivate ? '#EF4444' : 'inherit' }}>
                  🔒 Make Private {isPrivate && '(Link is currently inaccessible)'}
                </span>
              </label>
              <label className="share-setting-item">
                <input type="checkbox" defaultChecked />
                <span>Allow viewers to download CV</span>
              </label>
              <label className="share-setting-item">
                <input type="checkbox" />
                <span>Require password to view</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default Editor;