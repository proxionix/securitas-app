// app.js - Logique principale de l'application
document.addEventListener('DOMContentLoaded', init);

// État global de l'application
const appState = {
    isAuthenticated: false,
    emails: [],
    currentFile: null,
    config: {
        targetEmail: 'fortistech.brussels@securitas.com',
        filePrefix: 'WS-',
        rememberCredentials: false
    }
};

// Éléments DOM
const elements = {};

// URL de base de l'API
const apiBaseUrl = window.location.origin + '/api';

// Initialisation de l'application
function init() {
    // Vérification de l'authentification pour l'accès à l'application
    checkAppAuth();

    // Récupération des éléments DOM
    cacheElements();
    
    // Chargement de la configuration
    loadConfig();
    
    // Gestion des onglets
    setupTabNavigation();
    
    // Mise en place des écouteurs d'événements
    setupEventListeners();
    
    // Vérification de l'authentification utilisateur
    checkUserAuth();
}

// Vérification de l'authentification pour l'accès à l'application
function checkAppAuth() {
    const isAuthenticated = sessionStorage.getItem('appAuthenticated') === 'true';
    if (!isAuthenticated && window.location.pathname !== '/login') {
        window.location.href = '/login';
        return;
    }
}

// Mise en cache des éléments DOM
function cacheElements() {
    // En-tête et notifications
    elements.btnConnect = document.getElementById('btnConnect');
    elements.btnRefresh = document.getElementById('btnRefresh');
    elements.connectedUser = document.getElementById('connectedUser');
    elements.alertContainer = document.getElementById('alertContainer');
    
    // Emails
    elements.emailList = document.getElementById('emailList');
    elements.emailLoader = document.getElementById('emailLoader');
    
    // Intervention
    elements.interventionDetails = document.getElementById('interventionDetails');
    elements.interventionForm = document.getElementById('interventionForm');
    elements.extractedDetails = document.getElementById('extractedDetails');
    elements.sinoffCode = document.getElementById('sinoffCode');
    elements.startDateTime = document.getElementById('startDateTime');
    elements.endDateTime = document.getElementById('endDateTime');
    elements.btnStartNow = document.getElementById('btnStartNow');
    elements.btnEndNow = document.getElementById('btnEndNow');
    elements.interventionSolution = document.getElementById('interventionSolution');
    elements.btnSendMail = document.getElementById('btnSendMail');
    elements.btnSaveIntervention = document.getElementById('btnSaveIntervention');
    elements.btnCancelIntervention = document.getElementById('btnCancelIntervention');
    
    // Configuration
    elements.targetEmail = document.getElementById('targetEmail');
    elements.filePrefix = document.getElementById('filePrefix');
    elements.rememberCredentials = document.getElementById('rememberCredentials');
    elements.btnSaveConfig = document.getElementById('btnSaveConfig');
    
    // Navigation
    elements.tabEmails = document.getElementById('tabEmails');
    elements.tabIntervention = document.getElementById('tabIntervention');
    elements.tabConfig = document.getElementById('tabConfig');
    elements.contentEmails = document.getElementById('contentEmails');
    elements.contentIntervention = document.getElementById('contentIntervention');
    elements.contentConfig = document.getElementById('contentConfig');
    
    // Conteneur mailto
    elements.mailtoContainer = document.getElementById('mailtoContainer');
}

// Chargement de la configuration
function loadConfig() {
    const savedConfig = localStorage.getItem('appConfig');
    if (savedConfig) {
        appState.config = {...appState.config, ...JSON.parse(savedConfig)};
        elements.targetEmail.value = appState.config.targetEmail;
        elements.filePrefix.value = appState.config.filePrefix;
        if (elements.rememberCredentials) {
            elements.rememberCredentials.checked = appState.config.rememberCredentials;
        }
    }
}

// Configuration de la navigation par onglets
function setupTabNavigation() {
    elements.tabEmails.addEventListener('click', () => switchTab('Emails'));
    elements.tabIntervention.addEventListener('click', () => switchTab('Intervention'));
    elements.tabConfig.addEventListener('click', () => switchTab('Config'));
}

// Mise en place des écouteurs d'événements
function setupEventListeners() {
    // Connexion et emails
    elements.btnConnect.addEventListener('click', authenticateUser);
    elements.btnRefresh.addEventListener('click', fetchEmails);
    
    // Intervention
    elements.btnStartNow.addEventListener('click', setCurrentTimeStart);
    elements.btnEndNow.addEventListener('click', setCurrentTimeEnd);
    elements.btnSendMail.addEventListener('click', prepareMailtoLink);
    elements.btnSaveIntervention.addEventListener('click', saveIntervention);
    elements.btnCancelIntervention.addEventListener('click', cancelIntervention);
    
    // Configuration
    elements.btnSaveConfig.addEventListener('click', saveConfiguration);
}

// Vérification de l'authentification utilisateur
function checkUserAuth() {
    // Vérifier les identifiants stockés en local
    const savedCredentials = localStorage.getItem('emailCredentialsSaved');
    if (savedCredentials && appState.config.rememberCredentials) {
        const credentials = JSON.parse(savedCredentials);
        sessionStorage.setItem('emailCredentials', JSON.stringify(credentials));
        appState.isAuthenticated = true;
        updateAuthUI(credentials.email);
        fetchEmails();
        return;
    }
    
    // Vérifier les identifiants de session
    const sessionCredentials = sessionStorage.getItem('emailCredentials');
    if (sessionCredentials) {
        const credentials = JSON.parse(sessionCredentials);
        appState.isAuthenticated = true;
        updateAuthUI(credentials.email);
        fetchEmails();
    }
}

// Mise à jour de l'interface après authentification
function updateAuthUI(email) {
    elements.btnConnect.classList.add('hide');
    elements.btnRefresh.classList.remove('hide');
    elements.connectedUser.textContent = `Connecté: ${email}`;
    elements.connectedUser.classList.remove('hide');
}

// Gestion de l'authentification utilisateur
async function authenticateUser() {
    showAlert('Connexion au serveur de messagerie...', 'info');
    elements.emailLoader.classList.remove('hide');
    
    // Demander les identifiants
    const email = prompt('Adresse email:');
    const password = prompt('Mot de passe ou mot de passe d\'application:');
    
    if (!email || !password) {
        elements.emailLoader.classList.add('hide');
        showAlert('Authentification annulée.', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${apiBaseUrl}/authenticate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Stocker les identifiants dans sessionStorage
            sessionStorage.setItem('emailCredentials', JSON.stringify({ email, password }));
            
            // Si l'option "se souvenir" est activée, stocker dans localStorage
            if (appState.config.rememberCredentials) {
                localStorage.setItem('emailCredentialsSaved', JSON.stringify({ email, password }));
            }
            
            appState.isAuthenticated = true;
            updateAuthUI(email);
            
            showAlert('Connexion réussie!', 'success');
            fetchEmails();
        } else {
            showAlert(`Échec de l'authentification: ${data.error || 'Erreur inconnue'}`, 'danger');
        }
    } catch (error) {
        console.error('Erreur lors de l\'authentification:', error);
        showAlert('Erreur de connexion au serveur', 'danger');
    } finally {
        elements.emailLoader.classList.add('hide');
    }
}

// Récupération des emails non lus
async function fetchEmails() {
    if (!appState.isAuthenticated) {
        showAlert('Veuillez vous connecter d\'abord', 'warning');
        return;
    }

    const credentials = JSON.parse(sessionStorage.getItem('emailCredentials'));
    if (!credentials) {
        showAlert('Session expirée, veuillez vous reconnecter', 'warning');
        return;
    }

    showAlert('Recherche des emails non lus avec fichiers d\'intervention...', 'info');
    elements.emailLoader.classList.remove('hide');
    elements.emailList.innerHTML = '';

    try {
        const response = await fetch(`${apiBaseUrl}/fetch-emails`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
                filePrefix: appState.config.filePrefix
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            appState.emails = data.emails;
            renderEmailList();
            showAlert(`${data.emails.length} email(s) trouvé(s)`, 'success');
        } else {
            showAlert(`Échec de la récupération des emails: ${data.error || 'Erreur inconnue'}`, 'danger');
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des emails:', error);
        showAlert('Erreur de connexion au serveur', 'danger');
    } finally {
        elements.emailLoader.classList.add('hide');
    }
}

// Affichage de la liste des emails
function renderEmailList() {
    if (appState.emails.length === 0) {
        elements.emailList.innerHTML = '<div class="no-emails">Aucun email avec fichier d\'intervention trouvé.</div>';
        return;
    }

    let html = '';
    appState.emails.forEach(email => {
        const date = new Date(email.date);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        html += `
            <div class="email-item" data-id="${email.id}">
                <div class="email-header">
                    <h3 class="email-subject">${email.subject}</h3>
                    <div class="email-meta">
                        De: ${email.from} - Reçu: ${formattedDate}
                    </div>
                </div>
                <div class="email-body">
                    <p>Pièces jointes: ${email.attachments.map(a => a.filename).join(', ')}</p>
                </div>
                <div class="email-actions">
                    ${email.attachments.map(att => `
                        <button class="btn btn-light" onclick="downloadAttachment('${email.id}', '${att.partID}', '${att.filename}')">Télécharger</button>
                        <button class="btn btn-mail" onclick="acceptIntervention('${email.id}', '${att.partID}', '${att.filename}')">Traiter</button>
                    `).join('')}
                    <button class="btn btn-secondary" onclick="rejectIntervention('${email.id}')">Rejeter</button>
                </div>
            </div>
        `;
    });

    elements.emailList.innerHTML = html;
}

// Téléchargement d'une pièce jointe
async function downloadAttachment(emailId, partId, filename) {
    showAlert(`Téléchargement de ${filename}...`, 'info');
    
    const credentials = JSON.parse(sessionStorage.getItem('emailCredentials'));
    if (!credentials) {
        showAlert('Session expirée, veuillez vous reconnecter', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${apiBaseUrl}/download-attachment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
                emailId,
                partId,
                filename
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Créer un lien de téléchargement
            const link = document.createElement('a');
            link.href = `/download?file=${encodeURIComponent(data.filePath)}`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showAlert('Téléchargement réussi', 'success');
        } else {
            showAlert(`Échec du téléchargement: ${data.error || 'Erreur inconnue'}`, 'danger');
        }
    } catch (error) {
        console.error('Erreur lors du téléchargement:', error);
        showAlert('Erreur de connexion au serveur', 'danger');
    }
}

// Acceptation d'une intervention
async function acceptIntervention(emailId, partId, filename) {
    showAlert(`Acceptation de l'intervention ${filename}...`, 'info');
    
    const credentials = JSON.parse(sessionStorage.getItem('emailCredentials'));
    if (!credentials) {
        showAlert('Session expirée, veuillez vous reconnecter', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${apiBaseUrl}/download-attachment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
                emailId,
                partId,
                filename
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            appState.currentFile = {
                name: filename,
                emailId: emailId,
                partId: partId,
                path: data.filePath
            };
            
            showAlert(`Intervention ${filename} acceptée. Veuillez compléter les détails.`, 'success');
            switchTab('Intervention');
            
            // Extraction des informations depuis le fichier Excel (simulation pour l'exemple)
            // Dans une implémentation complète, utiliser la bibliothèque XLSX pour lire le contenu
            // de la cellule A40 et d'autres informations pertinentes
            const extractedInfo = {
                client: "Banque Centrale Bruxelles",
                details: "Alarme incendie déclenchée. Vérification requise."
            };
            
            // Afficher les détails extraits en lecture seule
            elements.extractedDetails.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">Client:</span>
                    <span>${extractedInfo.client}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Détails:</span>
                    <span>${extractedInfo.details}</span>
                </div>
            `;
            
            // Préremplir avec la date actuelle
            const now = new Date();
            const formattedNow = now.toISOString().slice(0, 16); // Format YYYY-MM-DDTHH:MM
            
            elements.startDateTime.value = formattedNow;
            
            // Préremplir heure de fin (par défaut +30 minutes)
            const end = new Date(now.getTime() + 30 * 60000);
            const formattedEnd = end.toISOString().slice(0, 16);
            elements.endDateTime.value = formattedEnd;
            
            // Afficher le formulaire d'intervention
            elements.interventionDetails.classList.add('hide');
            elements.interventionForm.classList.remove('hide');
        } else {
            showAlert(`Échec de l'acceptation: ${data.error || 'Erreur inconnue'}`, 'danger');
        }
    } catch (error) {
        console.error('Erreur lors de l\'acceptation:', error);
        showAlert('Erreur de connexion au serveur', 'danger');
    }
}

// Rejet d'une intervention
async function rejectIntervention(emailId) {
    if (confirm('Êtes-vous sûr de vouloir rejeter cette intervention?')) {
        showAlert(`Rejet de l'intervention...`, 'info');
        
        const credentials = JSON.parse(sessionStorage.getItem('emailCredentials'));
        if (!credentials) {
            showAlert('Session expirée, veuillez vous reconnecter', 'warning');
            return;
        }
        
        try {
