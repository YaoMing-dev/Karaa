const Resume = require('../models/Resume');
const Notification = require('../models/Notification');
const { cache } = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');
const { ErrorResponse } = require('../middleware/errorHandler');
const { encryptResumePersonalData, decryptResumePersonalData } = require('../utils/encryption');

// Helper: Create notification
const createNotification = async (userId, type, title, message) => {
  try {
    await Notification.create({
      user: userId,
      type,
      title,
      message
    });
    // Clear notification cache
    await cache.del(`notifications:user:${userId}:*`);
    await cache.del(`notifications:unread:user:${userId}`);
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

// @desc    Get all resumes for logged in user
// @route   GET /api/v1/resumes
// @access  Private
exports.getResumes = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, sort = 'updatedAt', order = 'DESC', search = '' } = req.query;
  const skip = (page - 1) * limit;

  // Cache key
  const cacheKey = `resumes:user:${req.user.id}:page:${page}:limit:${limit}:sort:${sort}:order:${order}:search:${search}`;

  // Check cache
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      cached: true,
      ...cachedData
    });
  }

  // Build query
  const query = {
    user: req.user.id,
    deletedAt: null
  };

  if (search) {
    query.title = { $regex: search, $options: 'i' };
  }

  // Get total count
  const total = await Resume.countDocuments(query);

  // Get resumes
  const sortOrder = order.toLowerCase() === 'desc' ? -1 : 1;
  const sortField = sort === 'updated_at' ? 'updatedAt' : sort === 'created_at' ? 'createdAt' : sort;

  const resumes = await Resume.find(query)
    .populate('template', 'name gradient color category')
    .sort({ [sortField]: sortOrder })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();

  // Transform to match original format
  const transformedResumes = resumes.map(resume => ({
    ...resume,
    id: resume._id,
    user_id: resume.user,
    template_id: resume.template?._id || null,
    template_name: resume.template?.name || null,
    created_at: resume.createdAt,
    updated_at: resume.updatedAt,
    deleted_at: resume.deletedAt
  }));

  const response = {
    data: transformedResumes,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, response, 300);

  res.status(200).json({
    success: true,
    ...response
  });
});

// @desc    Get single resume
// @route   GET /api/v1/resumes/:id
// @access  Private
exports.getResume = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Cache key
  const cacheKey = `resume:${id}:user:${req.user.id}`;

  // Check cache
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      cached: true,
      data: cachedData
    });
  }

  const resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  })
    .populate('template', 'name gradient color category config')
    .lean();

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  // FR-7.1: Decrypt personal data before sending
  const decryptedContent = decryptResumePersonalData(resume.content);

  // Transform to match original format
  const transformedResume = {
    ...resume,
    content: decryptedContent,
    id: resume._id,
    user_id: resume.user,
    template_id: resume.template?._id || null,
    template_name: resume.template?.name || null,
    template_config: resume.template?.config || null,
    created_at: resume.createdAt,
    updated_at: resume.updatedAt,
    deleted_at: resume.deletedAt
  };

  // Cache for 10 minutes
  await cache.set(cacheKey, transformedResume, 600);

  res.status(200).json({
    success: true,
    data: transformedResume
  });
});

// @desc    Create new resume
// @route   POST /api/v1/resumes
// @access  Private
exports.createResume = asyncHandler(async (req, res, next) => {
  const { title, template_id, content, customization } = req.body;

  console.log('=== CREATE RESUME REQUEST ===');
  console.log('User ID:', req.user.id);
  console.log('Template ID:', template_id);
  console.log('Title:', title);
  console.log('Content keys:', content ? Object.keys(content) : 'none');
  console.log('Customization:', customization);

  // Validate template exists if provided
  if (template_id) {
    const Template = require('../models/Template');
    try {
      const templateExists = await Template.findById(template_id);
      if (!templateExists) {
        console.error('❌ Template not found:', template_id);
        return next(new ErrorResponse('Template not found', 404));
      }
      console.log('✅ Template found:', templateExists.name);
    } catch (err) {
      console.error('❌ Invalid template ID format:', template_id);
      return next(new ErrorResponse('Invalid template ID format', 400));
    }
  }

  // FR-7.1: Encrypt personal data before saving
  const encryptedContent = content ? encryptResumePersonalData(content) : {};

  // Create resume
  const resume = await Resume.create({
    user: req.user.id,
    template: template_id || null,
    title: title || 'Untitled Resume',
    content: encryptedContent,
    customization: customization || {}
  });

  console.log('Resume created successfully:', resume._id);

  // Create notification
  await createNotification(
    req.user.id,
    'success',
    '🎉 CV mới đã được tạo!',
    `CV "${title || 'Untitled Resume'}" đã được tạo thành công. Bạn có thể chỉnh sửa và tải xuống ngay bây giờ.`
  );

  // Populate template
  await resume.populate('template', 'name gradient color category');

  // FR-7.1: Decrypt personal data before sending
  const resumeObj = resume.toObject();
  resumeObj.content = decryptResumePersonalData(resumeObj.content);

  // Transform to match original format
  const transformedResume = {
    ...resumeObj,
    id: resume._id,
    user_id: resume.user,
    template_id: resume.template?._id || null,
    template_name: resume.template?.name || null,
    created_at: resume.createdAt,
    updated_at: resume.updatedAt,
    deleted_at: resume.deletedAt
  };

  // Clear user's resumes cache AND template cache to ensure fresh data
  await cache.delPattern(`resumes:user:${req.user.id}:*`);
  if (template_id) {
    await cache.del(`template:${template_id}`);
  }

  res.status(201).json({
    success: true,
    data: transformedResume
  });
});

// @desc    Update resume
// @route   PUT /api/v1/resumes/:id
// @access  Private
exports.updateResume = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { title, template_id, content, customization } = req.body;

  // Check if resume exists and belongs to user
  let resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  });

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  // Build update object
  const updates = {};

  if (title !== undefined) {
    updates.title = title;
  }
  if (template_id !== undefined) {
    updates.template = template_id;
  }
  if (content !== undefined) {
    // FR-7.1: Encrypt personal data before saving
    updates.content = encryptResumePersonalData(content);
  }
  if (customization !== undefined) {
    updates.customization = customization;
  }

  if (Object.keys(updates).length === 0) {
    return next(new ErrorResponse('No fields to update', 400));
  }

  // Update resume
  // Note: runValidators disabled to allow backward compatibility with old string values
  // Getters/setters in schema will handle conversion automatically
  resume = await Resume.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: false }
  ).populate('template', 'name gradient color category');

  // FR-7.1: Decrypt personal data before sending
  const resumeObj = resume.toObject();
  resumeObj.content = decryptResumePersonalData(resumeObj.content);

  // Transform to match original format
  const transformedResume = {
    ...resumeObj,
    id: resume._id,
    user_id: resume.user,
    template_id: resume.template?._id || null,
    template_name: resume.template?.name || null,
    created_at: resume.createdAt,
    updated_at: resume.updatedAt,
    deleted_at: resume.deletedAt
  };

  // Clear cache
  await cache.del(`resume:${id}:user:${req.user.id}`);
  await cache.delPattern(`resumes:user:${req.user.id}:*`);

  res.status(200).json({
    success: true,
    data: transformedResume
  });
});

// @desc    Delete resume (soft delete)
// @route   DELETE /api/v1/resumes/:id
// @access  Private
exports.deleteResume = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Check if resume exists and belongs to user
  const resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  });

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  // Soft delete
  resume.deletedAt = new Date();
  await resume.save();

  // Clear cache
  await cache.del(`resume:${id}:user:${req.user.id}`);
  await cache.delPattern(`resumes:user:${req.user.id}:*`);

  res.status(200).json({
    success: true,
    message: 'Resume deleted successfully'
  });
});

// @desc    Duplicate resume
// @route   POST /api/v1/resumes/:id/duplicate
// @access  Private
exports.duplicateResume = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Get original resume
  const original = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  }).lean();

  if (!original) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  // Create duplicate
  const resume = await Resume.create({
    user: req.user.id,
    template: original.template,
    title: `${original.title} (Copy)`,
    content: original.content,
    customization: original.customization
  });

  // Populate template
  await resume.populate('template', 'name gradient color category');

  const decryptedContent = decryptResumePersonalData(resume.content);

  // Transform to match original format
  const transformedResume = {
    ...resume.toObject(),
    content: decryptedContent,
    id: resume._id,
    user_id: resume.user,
    template_id: resume.template?._id || null,
    template_name: resume.template?.name || null,
    created_at: resume.createdAt,
    updated_at: resume.updatedAt,
    deleted_at: resume.deletedAt
  };

  // Clear cache
  await cache.delPattern(`resumes:user:${req.user.id}:*`);

  res.status(201).json({
    success: true,
    data: transformedResume
  });
});

// @desc    Get resume statistics
// @route   GET /api/v1/resumes/stats
// @access  Private
exports.getResumeStats = asyncHandler(async (req, res, next) => {
  const cacheKey = `resume:stats:user:${req.user.id}`;

  // Check cache
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    return res.status(200).json({
      success: true,
      cached: true,
      data: cachedData
    });
  }

  // Get total resumes
  const total = await Resume.countDocuments({
    user: req.user.id,
    deletedAt: null
  });

  // Get recent updates (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentUpdates = await Resume.countDocuments({
    user: req.user.id,
    deletedAt: null,
    updatedAt: { $gte: sevenDaysAgo }
  });

  // Get downloads count (if you have a ResumeDownload model)
  // For now, setting to 0 as the model doesn't exist yet
  let downloads = 0;

  // If you have a ResumeDownload model, uncomment this:
  // const ResumeDownload = require('../models/ResumeDownload');
  // downloads = await ResumeDownload.countDocuments({ user: req.user.id });

  const stats = {
    total,
    recentUpdates,
    downloads
  };

  // Cache for 5 minutes
  await cache.set(cacheKey, stats, 300);

  res.status(200).json({
    success: true,
    data: stats
  });
});

// @desc    Generate share link for resume
// @route   POST /api/v1/resumes/:id/share
// @access  Private
exports.generateShareLink = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { allowDownload = true, password = null, expiresIn = null, consent = false } = req.body;
  const { v4: uuidv4 } = require('uuid');

  const resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  });

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  // FR-7.3: Require explicit consent to make resume public
  if (!consent) {
    return next(new ErrorResponse('You must provide explicit consent to make your resume public. Please confirm you understand your resume will be publicly accessible.', 400));
  }

  // Generate unique share ID if not exists
  if (!resume.shareId) {
    resume.shareId = uuidv4();
  }

  // Update sharing settings
  resume.isPublic = true;

  // Record privacy consent
  resume.privacyConsent = {
    given: true,
    givenAt: new Date(),
    ipAddress: req.ip || req.connection.remoteAddress
  };

  resume.shareSettings = {
    allowDownload,
    password: password || null,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null,
    viewCount: resume.shareSettings?.viewCount || 0
  };

  await resume.save();

  // Clear cache
  await cache.del(`resume:${id}:user:${req.user.id}`);

  const shareUrl = `${process.env.CLIENT_URL}/share/${resume.shareId}`;

  res.status(200).json({
    success: true,
    data: {
      shareId: resume.shareId,
      shareUrl,
      isPublic: resume.isPublic,
      settings: resume.shareSettings,
      privacyConsent: resume.privacyConsent
    }
  });
});

// @desc    Update share settings
// @route   PUT /api/v1/resumes/:id/share
// @access  Private
exports.updateShareSettings = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { isPublic, allowDownload, password, expiresIn, consent } = req.body;

  const resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  });

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  // FR-7.3: If changing from private to public, require explicit consent
  if (isPublic === true && !resume.isPublic && !consent) {
    return next(new ErrorResponse('You must provide explicit consent to make your resume public. Please confirm you understand your resume will be publicly accessible.', 400));
  }

  // Update settings
  if (isPublic !== undefined) {
    resume.isPublic = isPublic;

    // Record consent if making public
    if (isPublic === true) {
      resume.privacyConsent = {
        given: true,
        givenAt: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress
      };
    } else {
      // Revoke consent if making private
      resume.privacyConsent = {
        given: false,
        givenAt: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress
      };
    }
  }

  if (allowDownload !== undefined) {
    resume.shareSettings.allowDownload = allowDownload;
  }

  if (password !== undefined) {
    resume.shareSettings.password = password || null;
  }

  if (expiresIn !== undefined) {
    resume.shareSettings.expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : null;
  }

  await resume.save();

  // Clear cache
  await cache.del(`resume:${id}:user:${req.user.id}`);

  res.status(200).json({
    success: true,
    data: {
      shareId: resume.shareId,
      isPublic: resume.isPublic,
      settings: resume.shareSettings,
      privacyConsent: resume.privacyConsent
    }
  });
});

// @desc    Get shared resume by shareId (public)
// @route   GET /api/v1/resumes/share/:shareId
// @access  Public
exports.getSharedResume = asyncHandler(async (req, res, next) => {
  const { shareId } = req.params;
  const { password } = req.query;

  const resume = await Resume.findOne({
    shareId,
    isPublic: true,
    deletedAt: null
  }).populate('template', 'name gradient color category');

  if (!resume) {
    return next(new ErrorResponse('Resume not found or not public', 404));
  }

  // Check if link expired
  if (resume.shareSettings.expiresAt && new Date() > resume.shareSettings.expiresAt) {
    return next(new ErrorResponse('This share link has expired', 410));
  }

  // Check password if required
  if (resume.shareSettings.password && resume.shareSettings.password !== password) {
    return next(new ErrorResponse('Invalid password', 401));
  }

  // Increment view count
  resume.shareSettings.viewCount += 1;
  await resume.save();

  const decryptedContent = decryptResumePersonalData(resume.content);

  // Transform response
  const responseData = {
    title: resume.title,
    content: decryptedContent,
    customization: resume.customization,
    template: resume.template,
    allowDownload: resume.shareSettings.allowDownload,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt
  };

  res.status(200).json({
    success: true,
    data: responseData
  });
});

// @desc    Save version of resume
// @route   POST /api/v1/resumes/:id/version
// @access  Private
exports.saveVersion = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { comment } = req.body;

  const resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  });

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  // Add current state to version history
  resume.versionHistory.push({
    version: resume.version,
    content: resume.content,
    customization: resume.customization,
    createdAt: new Date(),
    comment: comment || `Version ${resume.version}`
  });

  // Increment version
  resume.version += 1;

  await resume.save();

  res.status(200).json({
    success: true,
    message: 'Version saved successfully',
    data: {
      currentVersion: resume.version,
      totalVersions: resume.versionHistory.length
    }
  });
});

// @desc    Get version history
// @route   GET /api/v1/resumes/:id/versions
// @access  Private
exports.getVersionHistory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  }).select('versionHistory version');

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      currentVersion: resume.version,
      versions: resume.versionHistory
    }
  });
});

// @desc    Restore specific version
// @route   POST /api/v1/resumes/:id/restore/:version
// @access  Private
exports.restoreVersion = asyncHandler(async (req, res, next) => {
  const { id, version } = req.params;

  const resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  });

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  const versionData = resume.versionHistory.find(v => v.version === parseInt(version));

  if (!versionData) {
    return next(new ErrorResponse('Version not found', 404));
  }

  // Save current state before restoring
  resume.versionHistory.push({
    version: resume.version,
    content: resume.content,
    customization: resume.customization,
    createdAt: new Date(),
    comment: `Auto-save before restoring to v${version}`
  });

  // Restore version data
  resume.content = versionData.content;
  resume.customization = versionData.customization;
  resume.version += 1;

  await resume.save();

  const decryptedContent = decryptResumePersonalData(resume.content);

  res.status(200).json({
    success: true,
    message: `Restored to version ${version}`,
    data: {
      currentVersion: resume.version,
      content: decryptedContent,
      customization: resume.customization
    }
  });
});

// @desc    Compare two versions
// @route   GET /api/v1/resumes/:id/compare/:v1/:v2
// @access  Private
exports.compareVersions = asyncHandler(async (req, res, next) => {
  const { id, v1, v2 } = req.params;

  const resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  }).populate('template');

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  const version1 = v1 === 'current'
    ? { version: resume.version, content: resume.content, customization: resume.customization }
    : resume.versionHistory.find(v => v.version === parseInt(v1));

  const version2 = v2 === 'current'
    ? { version: resume.version, content: resume.content, customization: resume.customization }
    : resume.versionHistory.find(v => v.version === parseInt(v2));

  if (!version1 || !version2) {
    return next(new ErrorResponse('One or both versions not found', 404));
  }

  const decryptedVersion1Content = decryptResumePersonalData(version1.content);
  const decryptedVersion2Content = decryptResumePersonalData(version2.content);

  res.status(200).json({
    success: true,
    data: {
      version1: {
        version: version1.version,
        content: decryptedVersion1Content,
        customization: version1.customization,
        createdAt: version1.createdAt
      },
      version2: {
        version: version2.version,
        content: decryptedVersion2Content,
        customization: version2.customization,
        createdAt: version2.createdAt
      },
      template: resume.template
    }
  });
});

// @desc    Export resume as DOCX
// @route   GET /api/v1/resumes/:id/export/docx
// @access  Private
exports.exportDocx = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { generateDocx } = require('../utils/docxGenerator');

  const resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  });

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }

  try {
    // Decrypt personal data before exporting
    const decryptedContent = decryptResumePersonalData(resume.content);

    // Load template if exists
    let template = null;
    if (resume.template) {
      const Template = require('../models/Template');
      template = await Template.findById(resume.template);
    }

    // Generate DOCX buffer with template info
    const buffer = await generateDocx({
      content: decryptedContent,
      customization: resume.customization,
      template: template
    });

    // Set response headers
    const fileName = `${decryptedContent.personal?.fullName || 'Resume'}_${resume.title}.docx`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);

    // Send buffer
    res.send(buffer);
  } catch (error) {
    console.error('DOCX generation error:', error);
    return next(new ErrorResponse('Failed to generate DOCX file', 500));
  }
});

// @desc    Export shared resume as DOCX (public)
// @route   GET /api/v1/resumes/share/:shareId/export/docx
// @access  Public
exports.exportSharedDocx = asyncHandler(async (req, res, next) => {
  const { shareId } = req.params;
  const { password } = req.query;
  const { generateDocx } = require('../utils/docxGenerator');

  const resume = await Resume.findOne({
    shareId,
    isPublic: true,
    deletedAt: null
  });

  if (!resume) {
    return next(new ErrorResponse('Shared resume not found or is private', 404));
  }

  // Check if expired
  if (resume.shareSettings.expiresAt && new Date() > resume.shareSettings.expiresAt) {
    return next(new ErrorResponse('This shared link has expired', 410));
  }

  // Check password if set
  if (resume.shareSettings.password && resume.shareSettings.password !== password) {
    return next(new ErrorResponse('Incorrect password', 401));
  }

  // Check if download is allowed
  if (!resume.shareSettings.allowDownload) {
    return next(new ErrorResponse('Download is not allowed for this resume', 403));
  }

  try {
    // Decrypt personal data before exporting
    const decryptedContent = decryptResumePersonalData(resume.content);

    // Generate DOCX buffer
    const buffer = await generateDocx({
      content: decryptedContent,
      customization: resume.customization
    });

    // Set response headers
    const fileName = `${decryptedContent.personal?.fullName || 'Resume'}_${resume.title}.docx`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);

    // Send buffer
    res.send(buffer);
  } catch (error) {
    console.error('DOCX generation error:', error);
    return next(new ErrorResponse('Failed to generate DOCX file', 500));
  }
});
