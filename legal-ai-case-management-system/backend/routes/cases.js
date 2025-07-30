// backend/routes/cases.js
const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `case-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

router.post('/upload', auth(), upload.single('document'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No document file uploaded.' });
    }

    const filePath = req.file.path; // The physical path to the temporarily stored file
    const pythonScriptPath = path.join(__dirname, '../ai_scripts/ai_processor.py');

    try {
        const pythonProcess = spawn('python', [pythonScriptPath, filePath]);
        let pythonOutput = '';
        let pythonError = '';

        pythonProcess.stdout.on('data', (data) => { pythonOutput += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { pythonError += data.toString(); });

        pythonProcess.on('close', async (code) => {
            if (pythonError) console.error(`[PYTHON STDERR]:\n${pythonError}`);

            // **THE CRITICAL FIX IS HERE:**
            // We NO LONGER delete the file after processing. It must be kept.
            // The fs.unlink call has been completely removed from this block.

            if (code !== 0) {
                // If the script fails, we should delete the uploaded file to prevent orphans.
                fs.unlink(filePath, (err) => { if (err) console.error('Error deleting failed upload:', err); });
                return res.status(500).json({ message: 'AI analysis script failed.', error: pythonError });
            }

            try {
                const aiData = JSON.parse(pythonOutput);
                if (aiData.error) {
                    fs.unlink(filePath, (err) => { if (err) console.error('Error deleting failed upload:', err); });
                    return res.status(500).json({ message: `AI processing error: ${aiData.error}` });
                }

                const isSummaryValid = aiData.summary && !aiData.summary.includes("failed") && !aiData.summary.includes("not available") && !aiData.summary.includes("could not be generated");
                const caseTitle = isSummaryValid ? aiData.summary.substring(0, 200) : req.file.originalname;
                const documentUrlPath = `/uploads/${req.file.filename}`;

                const newCase = new Case({
                    user: req.user.id,
                    caseTitle: caseTitle,
                    description: aiData.summary,
                    caseType: aiData.predictedCaseType,
                    documentName: req.file.originalname,
                    documentPath: documentUrlPath,
                    fileMimeType: req.file.mimetype,
                    summary: aiData.summary,
                    predictedOutcome: aiData.predictedOutcome,
                    parties: aiData.parties,
                    sections: aiData.sections,
                    winningPartyPrediction: aiData.winningPartyPrediction,
                });

                await newCase.save();
                res.status(201).json({ message: 'Case processed successfully!', case: newCase });

            } catch (dbError) {
                console.error('[Node.js LOG] DB Error:', dbError);
                fs.unlink(filePath, (err) => { if (err) console.error('Error deleting failed upload:', err); });
                res.status(500).json({ message: 'Failed to save processed data.' });
            }
        });

        pythonProcess.on('error', (spawnError) => {
            fs.unlink(filePath, (err) => { if (err) console.error('Error deleting failed upload:', err); });
            res.status(500).json({ message: 'Could not start AI engine.' });
        });

    } catch (serverError) {
        fs.unlink(filePath, (err) => { if (err) console.error('Error deleting failed upload:', err); });
        res.status(500).json({ message: 'Unexpected server error.' });
    }
});

// GET and PUT routes remain the same
router.get('/my-cases', auth(), async (req, res) => {
    try {
        const cases = await Case.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(cases);
    } catch (error) { res.status(500).json({ message: 'Server error fetching cases.' }); }
});

router.get('/:id', auth(), async (req, res) => {
    try {
        const legalCase = await Case.findOne({ _id: req.params.id, user: req.user.id });
        if (!legalCase) return res.status(404).json({ message: 'Case not found.' });
        res.json(legalCase);
    } catch (error) { res.status(500).json({ message: 'Server error fetching case details.' }); }
});

router.put('/:id', auth(), async (req, res) => {
    // ... code for updating text fields
});

// --- THE SECOND CRITICAL FIX IS HERE ---
router.delete('/:id', auth(), async (req, res) => {
    try {
        // First, find the case in the database to get its document path
        const legalCase = await Case.findOne({ _id: req.params.id, user: req.user.id });
        if (!legalCase) {
            return res.status(404).json({ message: 'Case not found or unauthorized to delete.' });
        }

        // Now, delete the case entry from the database
        await Case.findByIdAndDelete(req.params.id);
        
        // Finally, delete the associated file from the 'uploads' folder
        if (legalCase.documentPath) {
            // Construct the full physical path from the web URL
            const physicalPath = path.join(__dirname, '..', legalCase.documentPath);
            fs.unlink(physicalPath, (err) => {
                if (err) {
                    // Log an error but don't stop the success response,
                    // as the database entry is already gone.
                    console.error(`Error deleting file ${physicalPath}:`, err);
                } else {
                    console.log(`Successfully deleted file: ${physicalPath}`);
                }
            });
        }
        
        res.json({ message: 'Case deleted successfully!' });
    } catch (error) {
        console.error('Error deleting case:', error);
        res.status(500).json({ message: 'Server error deleting case.' });
    }
});

module.exports = router;