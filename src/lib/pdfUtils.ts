import type jsPDF from 'jspdf';

/**
 * Adds the OpticompBharat logo and branding text to the footer of every page 
 * in a provided jsPDF document.
 */
export const addOpticompBharatFooter = async (doc: jsPDF) => {
  try {
    const totalPages = doc.internal.getNumberOfPages();
    
    // Fetch and convert logo to base64
    const response = await fetch('/favicon.png');
    if (!response.ok) return;
    const blob = await response.blob();
    const reader = new FileReader();
    
    const base64data = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Add text branding
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("Powered by OpticompBharat", pageWidth / 2, pageHeight - 8, { align: "center" });

        // Add logo in the bottom right corner
        const imgSize = 8;
        doc.addImage(base64data, "PNG", pageWidth - 15, pageHeight - 12, imgSize, imgSize); 
    }
  } catch (error) {
    console.warn("Failed to add OpticompBharat footer to PDF:", error);
  }
};
