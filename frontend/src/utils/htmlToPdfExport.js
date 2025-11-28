export const captureResumePreviewHtml = (previewRef) => {
  if (!previewRef || !previewRef.current) {
    throw new Error('Preview ref not available');
  }

  const previewElement = previewRef.current;
  
  const styles = Array.from(document.styleSheets)
    .map(styleSheet => {
      try {
        return Array.from(styleSheet.cssRules)
          .map(rule => rule.cssText)
          .join('\n');
      } catch (e) {
        console.warn('Could not access stylesheet:', e);
        return '';
      }
    })
    .join('\n');

  const inlineStyles = `
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

  const html = previewElement.outerHTML;
  const css = styles + '\n' + inlineStyles;

  return { html, css };
};

export const exportResumeAsHtmlPdf = async (resumeId, previewRef, authToken) => {
  try {
    console.log('📥 Starting PDF export...');
    console.log(`  Resume ID: ${resumeId}`);
    console.log(`  Auth token present: ${!!authToken}`);

    const { html, css } = captureResumePreviewHtml(previewRef);
    console.log(`  HTML captured: ${html.length} chars`);
    console.log(`  CSS captured: ${css.length} chars`);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';
    const endpoint = `${apiUrl}/resumes/${resumeId}/export/pdf-html`;
    console.log(`  API endpoint: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      credentials: 'include',
      body: JSON.stringify({ html, css })
    });

    console.log(`  Response status: ${response.status}`);
    console.log(`  Response ok: ${response.ok}`);

    if (!response.ok) {
      let errorMessage = 'Failed to export PDF';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
        console.error('❌ Server error response:', error);
      } catch (e) {
        console.error('❌ Could not parse error response');
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    console.log(`  PDF blob size: ${blob.size} bytes`);
    console.log(`  PDF blob type: ${blob.type}`);

    // Validate blob
    if (blob.size === 0) {
      throw new Error('Received empty PDF file');
    }

    // Ensure blob is of correct type
    const pdfBlob = blob.type === 'application/pdf'
      ? blob
      : new Blob([blob], { type: 'application/pdf' });

    console.log(`  Final blob type: ${pdfBlob.type}, size: ${pdfBlob.size}`);

    // Check first few bytes to ensure it's a valid PDF
    const arrayBuffer = await pdfBlob.slice(0, 5).arrayBuffer();
    const header = new TextDecoder().decode(arrayBuffer);
    console.log(`  PDF header check: "${header}"`);

    if (!header.startsWith('%PDF-')) {
      console.error('❌ Invalid PDF header!');
      console.error('   This may indicate a corrupted download or server error.');
      throw new Error('Downloaded file is not a valid PDF');
    }

    const url = window.URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume_${Date.now()}.pdf`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Cleanup after a short delay to ensure download starts
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);

    console.log('✅ PDF exported successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Export error:', error.message);
    console.error('❌ Full error:', error);
    throw error;
  }
};
