const { generatePdfFromHtml } = require('./src/utils/htmlToPdf');
const fs = require('fs');
const path = require('path');

async function testPdfGeneration() {
  console.log('🧪 Testing PDF Generation with HTML/CSS...\n');

  const testHtml = `
    <div class="resume-preview-page">
      <div class="header">
        <h1>John Doe</h1>
        <p>Software Engineer</p>
      </div>
      <div class="section">
        <h2>Work Experience</h2>
        <div class="item">
          <h3>Senior Developer</h3>
          <p>ABC Company | 2020 - Present</p>
          <ul>
            <li>Developed responsive web applications</li>
            <li>Led team of 5 developers</li>
            <li>Improved performance by 40%</li>
          </ul>
        </div>
      </div>
      <div class="section">
        <h2>Education</h2>
        <div class="item">
          <h3>Bachelor of Computer Science</h3>
          <p>University of Example | 2016 - 2020</p>
        </div>
      </div>
    </div>
  `;

  const testCss = `
    .resume-preview-page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      background: white;
      font-family: 'Arial', sans-serif;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #3B82F6;
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 32px;
      color: #3B82F6;
      margin-bottom: 5px;
    }
    .header p {
      font-size: 18px;
      color: #6B7280;
    }
    .section {
      margin-bottom: 25px;
    }
    .section h2 {
      font-size: 20px;
      color: #1F2937;
      border-bottom: 1px solid #E5E7EB;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    .item {
      margin-bottom: 15px;
    }
    .item h3 {
      font-size: 16px;
      color: #111827;
      margin-bottom: 5px;
    }
    .item p {
      font-size: 14px;
      color: #6B7280;
      margin-bottom: 8px;
    }
    .item ul {
      margin-left: 20px;
      font-size: 14px;
      color: #374151;
    }
    .item li {
      margin-bottom: 4px;
    }
  `;

  try {
    console.log('📄 Generating PDF from test HTML/CSS...\n');

    const pdfBuffer = await generatePdfFromHtml({
      html: testHtml,
      css: testCss
    });

    const outputPath = path.join(__dirname, 'test-resume-output.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);

    console.log('\n✅✅✅ SUCCESS! ✅✅✅');
    console.log(`\n📁 PDF saved to: ${outputPath}`);
    console.log(`📊 File size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
    console.log('\n🎉 PDF generation is working correctly!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌❌❌ FAILED! ❌❌❌');
    console.error('\n❌ Error:', error.message);
    console.error('\n📋 Full error:');
    console.error(error);
    process.exit(1);
  }
}

testPdfGeneration();
