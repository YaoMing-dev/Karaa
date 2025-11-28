const Resume = require('../models/Resume');
const asyncHandler = require('../utils/asyncHandler');
const { ErrorResponse } = require('../middleware/errorHandler');
const { decryptResumePersonalData } = require('../utils/encryption');
const { generatePdf } = require('../utils/pdfGenerator');
const { generatePdfFromHtml } = require('../utils/htmlToPdf');

// @desc    Export resume as PDF (HTML-to-PDF for exact layout)
// @route   POST /api/v1/resumes/:id/export/pdf-html
// @access  Private
exports.exportPdfFromHtml = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { html, css } = req.body;

  console.log('📥 PDF Export Request received');
  console.log(`  Resume ID: ${id}`);
  console.log(`  User ID: ${req.user?.id}`);
  console.log(`  HTML provided: ${!!html}`);
  console.log(`  CSS provided: ${!!css}`);

  if (!html || !css) {
    console.error('❌ Missing HTML or CSS in request');
    return next(new ErrorResponse('HTML and CSS are required', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    user: req.user.id,
    deletedAt: null
  });

  if (!resume) {
    console.error('❌ Resume not found');
    return next(new ErrorResponse('Resume not found', 404));
  }

  console.log(`✅ Resume found: ${resume.title}`);

  try {
    const decryptedContent = decryptResumePersonalData(resume.content);
    console.log('✅ Content decrypted');

    const buffer = await generatePdfFromHtml({ html, css });
    console.log(`✅ PDF buffer generated: ${buffer.length} bytes`);
    console.log(`🔍 Buffer check: ${Buffer.isBuffer(buffer) ? 'OK' : 'WARNING - not a Buffer!'}`);

    const fileName = `${decryptedContent.personal?.fullName || 'Resume'}_${resume.title}.pdf`.replace(/\s+/g, '_');

    // Set proper headers for PDF download with CORS
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');

    console.log(`✅ Headers set for: ${fileName}`);
    console.log(`📤 Sending buffer as binary...`);

    // Send as binary - Express will handle Buffer correctly
    res.end(buffer, 'binary');
    console.log(`✅ PDF sent successfully!`);
  } catch (error) {
    console.error('❌ HTML-to-PDF generation error:', error.message);
    console.error('❌ Full error:', error);
    return next(new ErrorResponse(`Failed to generate PDF file: ${error.message}`, 500));
  }
});

// @desc    Export resume as PDF
// @route   GET /api/v1/resumes/:id/export/pdf
// @access  Private
exports.exportPdf = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

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

    // Generate PDF buffer with template info
    const buffer = await generatePdf({
      content: decryptedContent,
      customization: resume.customization,
      template: template
    });

    // Set response headers with CORS
    const fileName = `${decryptedContent.personal?.fullName || 'Resume'}_${resume.title}.pdf`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Send buffer
    res.send(buffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    return next(new ErrorResponse('Failed to generate PDF file', 500));
  }
});

// @desc    Export shared resume as PDF (public)
// @route   GET /api/v1/resumes/share/:shareId/export/pdf
// @access  Public
exports.exportSharedPdf = asyncHandler(async (req, res, next) => {
  const { shareId } = req.params;
  const { password } = req.query;

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

    // Load template if exists
    let template = null;
    if (resume.template) {
      const Template = require('../models/Template');
      template = await Template.findById(resume.template);
    }

    // Generate PDF buffer with template info
    const buffer = await generatePdf({
      content: decryptedContent,
      customization: resume.customization,
      template: template
    });

    // Set response headers with CORS
    const fileName = `${decryptedContent.personal?.fullName || 'Resume'}_${resume.title}.pdf`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Send buffer
    res.send(buffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    return next(new ErrorResponse('Failed to generate PDF file', 500));
  }
});
