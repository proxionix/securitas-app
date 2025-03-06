// server.js - Serveur principal pour l'application de gestion d'interventions
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
const nodemailer = require('nodemailer');
const xlsx = require('xlsx-js-style');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
require('dotenv').config();

// Configuration du logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Variables globales
const TEMP_FOLDER = process.env.TEMP_FOLDER || path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_FOLDER)) {
    fs.mkdirSync(TEMP_FOLDER, { recursive: true });
}

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
}

// Créer le dossier logs s'il n'existe pas
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs', { recursive: true });
}

// Configuration IMAP pour Microsoft Exchange
const getImapConfig = (credentials) => {
    return {
        imap: {
            user: credentials.email,
            password: credentials.password,
            host: credentials.host || 'outlook.office365.com',
            port: credentials.port || 993,
            tls: true,
            authTimeout: 10000,
            tlsOptions: { rejectUnauthorized: false }
        }
    };
};

// Configuration SMTP pour l'envoi d'emails
const getSmtpConfig = (credentials) => {
    return {
        host: credentials.smtpHost || 'smtp.office365.com',
        port: credentials.smtpPort || 587,
        secure: false,
        auth: {
            user: credentials.email,
            pass: credentials.password
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false
        }
    };
};

// Routes API
app.post('/api/authenticate', (req, res) => {
    // Validation des paramètres d'entrée
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    logger.info(`Tentative d'authentification pour ${email}`);

    // Tester la connexion IMAP
    const config = getImapConfig({ email, password });
    
    imaps.connect(config)
        .then(connection => {
            connection.end();
            logger.info(`Authentification réussie pour ${email}`);
            res.json({ success: true, message: 'Authentification réussie' });
        })
        .catch(err => {
            logger.error(`Échec de l'authentification pour ${email}: ${err.message}`);
            res.status(401).json({ error: 'Échec de l\'authentification', details: err.message });
        });
});

app.post('/api/fetch-emails', async (req, res) => {
    const { email, password, filePrefix } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Paramètres manquants' });
    }

    logger.info(`Récupération des emails pour ${email}`);

    const config = getImapConfig({ email, password });
    
    try {
        const connection = await imaps.connect(config);
        
        // Ouvrir la boîte de réception
        await connection.openBox('INBOX');
        
        // Rechercher les emails non lus
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: false,
            struct: true
        };
        
        const messages = await connection.search(searchCriteria, fetchOptions);
        logger.info(`${messages.length} emails non lus trouvés pour ${email}`);
        
        const emailsWithAttachments = [];
        
        for (const message of messages) {
            const parts = imaps.getParts(message.attributes.struct);
            const attachments = parts.filter(part => {
                return (part.disposition && 
                        part.disposition.type.toLowerCase() === 'attachment') || 
                        (part.subtype && part.subtype.toLowerCase() === 'octet-stream');
            });
            
            // Vérifier si des pièces jointes commencent par le préfixe et sont des fichiers Excel
            const relevantAttachments = attachments.filter(attachment => {
                const fileName = attachment.params?.name || attachment.disposition?.params?.filename;
                return fileName && 
                       fileName.toLowerCase().startsWith(filePrefix.toLowerCase()) && 
                       fileName.toLowerCase().endsWith('.xls');
            });
            
            if (relevantAttachments.length > 0) {
                const header = message.parts.find(part => part.which === 'HEADER');
                const parsed = await simpleParser(message.parts.find(part => part.which === '').body);
                
                emailsWithAttachments.push({
                    id: message.attributes.uid,
                    subject: parsed.subject,
                    from: parsed.from.text,
                    date: parsed.date,
                    attachments: relevantAttachments.map(att => ({
                        filename: att.params?.name || att.disposition?.params?.filename,
                        contentType: att.type + '/' + att.subtype,
                        partID: att.partID,
                        size: att.size || 0
                    }))
                });
            }
        }
        
        connection.end();
        res.json({ success: true, emails: emailsWithAttachments });
    } catch (err) {
        logger.error(`Erreur lors de la récupération des emails pour ${email}: ${err.message}`);
        res.status(500).json({ error: 'Échec de la récupération des emails', details: err.message });
    }
});

app.post('/api/download-attachment', async (req, res) => {
    const { email, password, emailId, partId, filename } = req.body;
    if (!email || !password || !emailId || !partId || !filename) {
        return res.status(400).json({ error: 'Paramètres manquants' });
    }

    logger.info(`Téléchargement de la pièce jointe ${filename} depuis l'email ${emailId}`);

    const config = getImapConfig({ email, password });
    
    try {
        const connection = await imaps.connect(config);
        
        await connection.openBox('INBOX');
        
        const searchCriteria = [['UID', emailId]];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT'],
            struct: true
        };
        
        const messages = await connection.search(searchCriteria, fetchOptions);
        if (messages.length === 0) {
            connection.end();
            logger.warn(`Email ${emailId} non trouvé`);
            return res.status(404).json({ error: 'Email non trouvé' });
        }
        
        // Télécharger la pièce jointe
        const parts = imaps.getParts(messages[0].attributes.struct);
        const attachmentPart = parts.find(part => part.partID === partId);
        
        if (!attachmentPart) {
            connection.end();
            logger.warn(`Pièce jointe ${partId} non trouvée dans l'email ${emailId}`);
            return res.status(404).json({ error: 'Pièce jointe non trouvée' });
        }
        
        const attachmentData = await connection.getPartData(messages[0], attachmentPart);
        
        // Enregistrer temporairement le fichier
        const tempFilePath = path.join(TEMP_FOLDER, `${uuidv4()}_${filename}`);
        fs.writeFileSync(tempFilePath, attachmentData);
        
        connection.end();
        logger.info(`Pièce jointe ${filename} téléchargée avec succès vers ${tempFilePath}`);
        
        res.json({ 
            success: true, 
            filePath: tempFilePath,
            message: 'Pièce jointe téléchargée avec succès'
        });
    } catch (err) {
        logger.error(`Erreur lors du téléchargement de la pièce jointe ${filename}: ${err.message}`);
        res.status(500).json({ error: 'Échec du téléchargement', details: err.message });
    }
});

// Route pour télécharger un fichier temporaire
app.get('/download', (req, res) => {
    const filePath = req.query.file;
    
    if (!filePath || !fs.existsSync(filePath)) {
        logger.warn(`Tentative de téléchargement d'un fichier inexistant: ${filePath}`);
        return res.status(404).send('Fichier non trouvé');
    }
    
    res.download(filePath, path.basename(filePath).substring(37)); // Enlève l'UUID du nom du fichier
});

app.post('/api/process-excel', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    const { sinoffCode, startDay, startMonth, startHour, startMinute,
            endDay, endMonth, endHour, endMinute, details, solution } = req.body;
    
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
        
        // Détails et solution
        worksheet['A40'] = { v: details, t: 's' };
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

app.post('/api/send-email', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    const { email, password, recipient, subject, body } = req.body;
    if (!email || !password || !recipient) {
        return res.status(400).json({ error: 'Paramètres manquants' });
    }
    
    logger.info(`Envoi d'email à ${recipient} avec la pièce jointe ${req.file.originalname}`);
    
    try {
        const smtpConfig = getSmtpConfig({ email, password });
        const transporter = nodemailer.createTransport(smtpConfig);
        
        // Préparer l'email
        const mailOptions = {
            from: email,
            to: recipient,
            subject: subject || 'Intervention complétée',
            text: body || 'Veuillez trouver ci-joint le fichier d\'intervention complété.',
            attachments: [
                {
                    filename: path.basename(req.file.originalname),
                    path: req.file.path
                }
            ]
        };
        
        // Envoyer l'email
        await transporter.sendMail(mailOptions);
        
        // Nettoyer le fichier temporaire
        fs.unlinkSync(req.file.path);
        
        logger.info(`Email envoyé avec succès à ${recipient}`);
        
        res.json({ 
            success: true, 
            message: 'Email envoyé avec succès'
        });
    } catch (err) {
        logger.error(`Erreur lors de l'envoi de l'email à ${recipient}: ${err.message}`);
        // Nettoyage en cas d'erreur
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Échec de l\'envoi de l\'email', details: err.message });
    }
});

app.post('/api/mark-as-read', async (req, res) => {
    const { email, password, emailId } = req.body;
    if (!email || !password || !emailId) {
        return res.status(400).json({ error: 'Paramètres manquants' });
    }

    logger.info(`Marquage de l'email ${emailId} comme lu`);

    const config = getImapConfig({ email, password });
    
    try {
        const connection = await imaps.connect(config);
        
        await connection.openBox('INBOX');
        
        // Marquer l'email comme lu
        await connection.addFlags(emailId, ['\\Seen']);
        
        connection.end();
        
        logger.info(`Email ${emailId} marqué comme lu avec succès`);
        
        res.json({ 
            success: true, 
            message: 'Email marqué comme lu'
        });
    } catch (err) {
        logger.error(`Erreur lors du marquage de l'email ${emailId} comme lu: ${err.message}`);
        res.status(500).json({ error: 'Échec du marquage de l\'email', details: err.message });
    }
});

// Route par défaut pour servir l'application front-end
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Nettoyage périodique des fichiers temporaires
const cleanupTempFiles = () => {
    const now = new Date().getTime();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    fs.readdir(TEMP_FOLDER, (err, files) => {
        if (err) {
            logger.error(`Erreur lors de la lecture du dossier temporaire: ${err.message}`);
            return;
        }
        
        files.forEach(file => {
            const filePath = path.join(TEMP_FOLDER, file);
            fs.stat(filePath, (statErr, stats) => {
                if (statErr) {
                    logger.error(`Erreur lors de la vérification du fichier ${file}: ${statErr.message}`);
                    return;
                }
                
                if (stats.isFile() && stats.mtimeMs < oneHourAgo) {
                    fs.unlink(filePath, unlinkErr => {
                        if (unlinkErr) {
                            logger.error(`Erreur lors de la suppression du fichier ${file}: ${unlinkErr.message}`);
                        } else {
                            logger.info(`Fichier temporaire ${file} supprimé`);
                        }
                    });
                }
            });
        });
    });
};

// Nettoyer les fichiers temporaires toutes les heures
setInterval(cleanupTempFiles, 60 * 60 * 1000);

// Démarrer le serveur
app.listen(PORT, () => {
    logger.info(`Serveur démarré sur le port ${PORT}`);
});
