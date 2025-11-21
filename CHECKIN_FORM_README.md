# Vehicle/Rig Check-In Form - Documentation

## Overview
This HTML form generates professional inspection reports for vehicles and drill rigs in the **Certerra format**, with full support for Outlook email and Word document exports with embedded images.

## Key Features

### ✅ Outlook Image Compatibility
- **Inline Images**: All photos are embedded directly in the email body using CID (Content-ID) references
- **Microsoft Word Rendering Engine Support**: Uses MSO-specific VML tags for perfect rendering in Outlook 2007+
- **Automatic Image Optimization**: Images are resized and compressed to optimal dimensions (800x600px max)
- **Fixed Dimensions**: Explicit width/height attributes ensure consistent display across all Outlook versions

### ✅ Word Document Generation
- **Embedded Photos**: All images are properly embedded in the .docx file with correct sizing
- **Professional Layout**: Structured sections with headers, notes, and captioned photos
- **Proper Image Scaling**: Images maintain aspect ratio and are sized appropriately for print/digital viewing
- **EMU Conversion**: Correctly converts pixel dimensions to EMUs (English Metric Units) for Word

### ✅ Certerra Format Standards
- **Professional Styling**: Clean, corporate design with Certerra branding
- **Structured Sections**: 4 inspection categories (Fluids, Exterior, Interior, Rig)
- **Metadata Tracking**: Date, inspector, vehicle ID automatically included
- **Compliance Ready**: Suitable for regulatory and insurance documentation

## How to Use

### 1. Open the Form
Simply open `vehicle-checkin.html` in any modern web browser (Chrome, Edge, Firefox, Safari).

### 2. Fill in Required Fields
- **Email To**: Recipient email addresses (semicolon-separated)
- **Inspection Date**: Date of inspection
- **Inspector Name**: Full name of technician
- **Vehicle/Rig ID**: Identifier (e.g., "Truck #12", "Rig #3")

### 3. Add Inspection Notes
Fill in observations for each of the 4 sections:
- Fluids & Levels
- Exterior / Tires
- Interior / Safety
- Rig / Hydraulics & Deck

### 4. Upload Photos
- Select photos for each section using the file inputs
- Photos will be automatically prefixed (fluids_, exterior_, etc.)
- Supported formats: JPG, PNG, GIF, WebP
- Multiple photos per section are supported

### 5. Add Optional Attachments
Upload any additional files (PDFs, Excel files, etc.) that should be attached to the email.

### 6. Generate Output

#### Option A: Email Draft
Click **"📧 Generate Email Draft (.eml)"** to:
1. Process and optimize all images
2. Generate a Word report with embedded photos
3. Create an .eml file with inline images and attachments
4. Download the .eml file

**To Send**: Open the downloaded .eml file in Outlook, review, and click Send.

#### Option B: Word Report Only
Click **"📄 Export Word Report (.docx)"** to generate just the Word document without creating an email.

## Technical Improvements

### Image Processing
```javascript
// Images are automatically:
- Resized to max 800x600px (maintaining aspect ratio)
- Converted to JPEG format (85% quality)
- Optimized for Outlook rendering
- Embedded with proper dimensions in both email and Word
```

### Outlook Compatibility Features
1. **VML Support**: Uses Vector Markup Language for MSO-specific rendering
2. **Conditional Comments**: `<!--[if mso]>` tags for Outlook-specific code
3. **Table-Based Layout**: Uses HTML tables for consistent rendering
4. **Explicit Dimensions**: Width/height attributes on all images
5. **Inline CSS**: All styling is inline for maximum compatibility

### Word Document Features
1. **EMU Calculations**: Proper conversion of pixel dimensions to EMUs (9525 EMUs per pixel at 96 DPI)
2. **ImageRun API**: Uses docx library's ImageRun for embedded images
3. **Proper Margins**: 1-inch margins on all sides
4. **Structured Content**: Headings, paragraphs, and images properly formatted

## Browser Requirements
- **Minimum**: Any modern browser with ES6+ support
- **Recommended**: Chrome 90+, Edge 90+, Firefox 88+, Safari 14+
- **Required APIs**: FileReader, Canvas, Blob, URL.createObjectURL

## File Output

### Email (.eml file)
```
Structure:
├── multipart/mixed
│   ├── multipart/related (HTML + inline images)
│   │   ├── text/html (email body)
│   │   ├── image/jpeg (CID: fluids_1)
│   │   ├── image/jpeg (CID: exterior_1)
│   │   └── ... (more inline images)
│   ├── application/vnd...docx (Word report)
│   └── ... (additional attachments)
```

### Word Document (.docx file)
```
Structure:
├── Title & Metadata
├── Section 1: Fluids & Levels
│   ├── Notes
│   └── Photos (embedded)
├── Section 2: Exterior / Tires
│   ├── Notes
│   └── Photos (embedded)
├── Section 3: Interior / Safety
│   ├── Notes
│   └── Photos (embedded)
└── Section 4: Rig / Hydraulics & Deck
    ├── Notes
    └── Photos (embedded)
```

## Troubleshooting

### Images not showing in Outlook
- **Check file size**: Large images may be blocked by Outlook security settings
- **Verify format**: Ensure images are JPG, PNG, or GIF
- **Security settings**: Check Outlook's "Download Pictures" settings

### Word document images too large/small
- Adjust `CONFIG.DOCX_IMAGE_WIDTH` in the script (default: 600px)
- Images maintain aspect ratio automatically

### Email file too large
- Reduce number of photos
- Images are already optimized to 85% JPEG quality
- Consider uploading photos to cloud storage and linking instead

## Configuration Options

Edit these constants in the script to customize behavior:

```javascript
const CONFIG = {
  MAX_IMAGE_WIDTH: 800,   // Max width for email images (px)
  MAX_IMAGE_HEIGHT: 600,  // Max height for email images (px)
  DOCX_IMAGE_WIDTH: 600,  // Width for Word doc images (px)
  EMAIL_IMG_WIDTH: 480,   // Display width in email (px)
  EMAIL_IMG_HEIGHT: 360,  // Display height in email (px)
  JPEG_QUALITY: 0.85,     // JPEG compression (0.0-1.0)
};
```

## Support
For issues or questions, contact your system administrator or refer to the Certerra technical documentation.

---

**Version**: 1.0
**Last Updated**: 2025-11-21
**Compatibility**: Outlook 2007+, Word 2007+, All modern browsers
