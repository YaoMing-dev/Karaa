const { generatePdfFromHtml } = require('./src/utils/htmlToPdf');
const fs = require('fs');
const path = require('path');

async function testDirectPdf() {
  console.log('🧪 Testing Direct PDF Generation (Same as Export)...\n');

  // Tạo HTML/CSS giống như từ frontend
  const testHtml = `
    <div class="resume-preview-page layout-single-column">
      <div class="resume-header">
        <h1 style="color: #3B82F6; font-size: 32px; margin-bottom: 8px;">Hong Thanh</h1>
        <p style="color: #6B7280; font-size: 16px;">thanhmeo@gmail.com | +84 123 456 789</p>
      </div>

      <div class="resume-section">
        <h2 style="color: #1F2937; font-size: 20px; border-bottom: 2px solid #3B82F6; padding-bottom: 8px; margin: 20px 0 12px;">
          WORK EXPERIENCE
        </h2>
        <div class="experience-item">
          <h3 style="color: #111827; font-size: 16px; font-weight: 600;">Senior Software Engineer</h3>
          <p style="color: #6B7280; font-size: 14px; font-style: italic;">Tech Company Inc. | Ho Chi Minh City</p>
          <p style="color: #9CA3AF; font-size: 13px;">Jan 2020 - Present</p>
          <ul style="margin: 8px 0 0 20px; color: #374151;">
            <li>Led development of microservices architecture</li>
            <li>Improved system performance by 40%</li>
            <li>Mentored team of 5 junior developers</li>
          </ul>
        </div>
      </div>

      <div class="resume-section">
        <h2 style="color: #1F2937; font-size: 20px; border-bottom: 2px solid #3B82F6; padding-bottom: 8px; margin: 20px 0 12px;">
          EDUCATION
        </h2>
        <div class="education-item">
          <h3 style="color: #111827; font-size: 16px; font-weight: 600;">Bachelor of Computer Science</h3>
          <p style="color: #6B7280; font-size: 14px; font-style: italic;">University of Technology</p>
          <p style="color: #9CA3AF; font-size: 13px;">2016 - 2020</p>
        </div>
      </div>

      <div class="resume-section">
        <h2 style="color: #1F2937; font-size: 20px; border-bottom: 2px solid #3B82F6; padding-bottom: 8px; margin: 20px 0 12px;">
          SKILLS
        </h2>
        <p style="color: #374151; font-size: 14px;">
          <strong>Technical:</strong> JavaScript, TypeScript, React, Node.js, MongoDB, PostgreSQL, Docker, Kubernetes
        </p>
      </div>
    </div>
  `;

  const testCss = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .resume-preview-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 20mm;
      background: white;
      box-sizing: border-box;
    }
    .resume-preview-page * {
      box-sizing: border-box;
    }
    @page {
      size: A4;
      margin: 0;
    }
    @media print {
      .resume-preview-page {
        margin: 0;
        padding: 20mm;
      }
    }
  `;

  try {
    console.log('📄 Generating PDF...\n');

    const pdfBuffer = await generatePdfFromHtml({
      html: testHtml,
      css: testCss
    });

    const outputPath = path.join(__dirname, 'test-export-output.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);

    console.log('\n✅✅✅ PDF GENERATED! ✅✅✅');
    console.log(`\n📁 Saved to: ${outputPath}`);
    console.log(`📊 Size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

    // Validate PDF header
    const header = pdfBuffer.slice(0, 5).toString();
    console.log(`\n🔍 PDF Header: "${header}"`);

    if (header === '%PDF-') {
      console.log('✅ PDF header is valid!');
    } else {
      console.log('❌ WARNING: PDF header is INVALID!');
      console.log(`   Expected: "%PDF-"`);
      console.log(`   Got: "${header}"`);
    }

    // Check if buffer is actually a Buffer
    console.log(`\n🔍 Buffer type: ${Buffer.isBuffer(pdfBuffer) ? 'Buffer' : typeof pdfBuffer}`);
    console.log(`🔍 First 10 bytes: ${pdfBuffer.slice(0, 10).toString('hex')}`);

    console.log('\n🎯 Please try to open: test-export-output.pdf');
    console.log('   If this PDF opens correctly, the issue is in the HTTP response or frontend download logic.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ FAILED!');
    console.error('❌ Error:', error.message);
    console.error('\n📋 Stack:', error.stack);
    process.exit(1);
  }
}

testDirectPdf();
