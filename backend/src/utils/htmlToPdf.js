const puppeteer = require('puppeteer');

let browser = null;

const getBrowser = async () => {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
  return browser;
};

const generatePdfFromHtml = async ({ html, css }) => {
  console.log('📄 Starting PDF generation from HTML...');
  console.log(`📏 HTML length: ${html ? html.length : 0} chars`);
  console.log(`🎨 CSS length: ${css ? css.length : 0} chars`);

  let browserInstance;
  let page;

  try {
    browserInstance = await getBrowser();
    console.log('✅ Browser instance acquired');

    page = await browserInstance.newPage();
    console.log('✅ New page created');

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
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
          ${css}
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    console.log('📝 Setting page content...');
    await page.setContent(fullHtml, {
      waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
      timeout: 30000
    });
    console.log('✅ Content set successfully');

    console.log('⏳ Waiting for fonts to load...');
    // Wait for fonts using Promise (evaluateHandle returns a promise)
    await page.evaluate(() => document.fonts.ready);
    console.log('✅ Fonts loaded');

    // Additional wait for complete rendering and layout calculation
    // waitForTimeout is deprecated in Puppeteer v21+, use Promise instead
    console.log('⏳ Waiting for layout stabilization...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Layout ready');

    console.log('🖨️  Generating PDF...');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      timeout: 60000 // 60 second timeout for PDF generation
    });

    // Puppeteer v23+ returns Uint8Array, convert to Buffer for Node.js compatibility
    const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    console.log(`✅ PDF generated successfully! Size: ${pdfBuffer.length} bytes`);
    console.log(`🔍 Buffer validation: ${Buffer.isBuffer(pdfBuffer) ? 'OK' : 'FAILED'}`);
    console.log(`🔍 PDF Header: ${pdfBuffer.slice(0, 5).toString()}`);

    await page.close();
    console.log('✅ Page closed');

    return pdfBuffer;
  } catch (error) {
    console.error('❌ PDF generation error:', error.message);
    console.error('❌ Error stack:', error.stack);

    if (page) {
      try {
        await page.close();
        console.log('✅ Page closed after error');
      } catch (closeError) {
        console.error('❌ Error closing page:', closeError.message);
      }
    }

    throw error;
  }
};

process.on('exit', async () => {
  if (browser) {
    await browser.close();
  }
});

module.exports = { generatePdfFromHtml };
