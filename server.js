// Ajouter ces routes avant la route par défaut
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Ajouter cette route pour le logo
app.get('/images/securitas-technology-logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'images', 'securitas-technology-logo.png'));
});

// Modifier la route /api/process-excel pour ne pas écraser A40
app.post('/api/process-excel', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    const { sinoffCode, startDay, startMonth, startHour, startMinute,
            endDay, endMonth, endHour, endMinute, solution } = req.body;
    
    logger.info(`Traitement du fichier Excel ${req.file.originalname}`);
    
    try {
        // Lire le fichier Excel
        const workbook = xlsx.readFile(req.file.path);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Mise à jour des cellules
        // SinoffCode
        worksheet['Y3'] = { v: parseInt(sinoffCode), t: 'n' };
        
        // Début d'intervention
        worksheet['K8'] = { v: parseInt(startDay), t: 'n' };
        worksheet['M8'] = { v: parseInt(startMonth), t: 'n' };
        worksheet['P8'] = { v: parseInt(startHour), t: 'n' };
        worksheet['R8'] = { v: parseInt(startMinute), t: 'n' };
        
        // Fin d'intervention
        worksheet['T8'] = { v: parseInt(endDay), t: 'n' };
        worksheet['V8'] = { v: parseInt(endMonth), t: 'n' };
        worksheet['X8'] = { v: parseInt(endHour), t: 'n' };
        worksheet['AA8'] = { v: parseInt(endMinute), t: 'n' };
        
        // Solution uniquement - ne pas modifier A40
        worksheet['P40'] = { v: solution, t: 's' };
        
        // Enregistrer le fichier modifié
        const outputPath = path.join(TEMP_FOLDER, `processed_${req.file.originalname}`);
        xlsx.writeFile(workbook, outputPath);
        
        // Supprimer le fichier temporaire d'origine
        fs.unlinkSync(req.file.path);
        
        logger.info(`Fichier Excel traité avec succès: ${outputPath}`);
        
        res.json({ 
            success: true, 
            filePath: outputPath,
            message: 'Fichier Excel traité avec succès'
        });
    } catch (err) {
        logger.error(`Erreur lors du traitement du fichier Excel ${req.file.originalname}: ${err.message}`);
        // Nettoyage en cas d'erreur
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Échec du traitement Excel', details: err.message });
    }
});
