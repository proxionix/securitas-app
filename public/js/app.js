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
    elements.btnLogout = document.getElementById('btnLogout');
    
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
    elements.btnLogout.addEventListener('click', logout);
    
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
    elements.btnLogout.classList.remove('hide');
    elements.connectedUser.textContent = `Connecté: ${email}`;
    elements.connectedUser.classList.remove('hide');
}

// Déconnexion de l'utilisateur
function logout() {
    // Effacer les données d'authentification
    sessionStorage.removeItem('emailCredentials');
    sessionStorage.removeItem('appAuthenticated');
    
    // Rediriger vers la page de connexion
    window.location.href = '/login';
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
            
            // Tenter d'extraire les détails du fichier Excel
            try {
                // Lecture du fichier Excel - cette partie nécessite normalement XLSX.js
                // Pour l'exemple, on simule des données extraites
                const extractedInfo = {
                    client: "Banque Centrale Bruxelles",
                    details: "Alarme incendie déclenchée. Vérification requise."
                };
                
                // Dans une implémentation réelle, vous utiliseriez XLSX.js pour lire le contenu de A40
                // const workbook = XLSX.readFile(data.filePath);
                // const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                // const cellA40Value = worksheet['A40'] ? worksheet['A40'].v : '';
                // extractedInfo.details = cellA40Value;
                
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
            } catch (error) {
                console.error('Erreur lors de l\'extraction des données Excel:', error);
                elements.extractedDetails.innerHTML = '<p>Impossible d\'extraire les détails du fichier.</p>';
            }
            
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
            const response = await fetch(`${apiBaseUrl}/mark-as-read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: credentials.email,
                    password: credentials.password,
                    emailId
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showAlert(`Intervention rejetée avec succès.`, 'success');
                
                // Supprimer l'email de la liste
                appState.emails = appState.emails.filter(email => email.id !== emailId);
                renderEmailList();
            } else {
                showAlert(`Échec du rejet: ${data.error || 'Erreur inconnue'}`, 'danger');
            }
        } catch (error) {
            console.error('Erreur lors du rejet:', error);
            showAlert('Erreur de connexion au serveur', 'danger');
        }
    }
}

// Fonctions pour gérer les interventions et le calendrier
function setCurrentTimeStart() {
    const now = new Date();
    const formattedNow = now.toISOString().slice(0, 16);
    elements.startDateTime.value = formattedNow;
    showAlert('Heure de début définie à l\'heure actuelle.', 'info');
}

function setCurrentTimeEnd() {
    const now = new Date();
    const formattedNow = now.toISOString().slice(0, 16);
    elements.endDateTime.value = formattedNow;
    showAlert('Heure de fin définie à l\'heure actuelle.', 'info');
}

// Préparation du lien mailto pour envoyer par email
function prepareMailtoLink() {
    if (!appState.currentFile) {
        showAlert('Aucune intervention en cours.', 'warning');
        return;
    }

    // Vérifier et traiter d'abord le fichier Excel
    saveIntervention(true);
}

// Génération du lien mailto
function generateMailtoLink(filePath) {
    const recipient = appState.config.targetEmail;
    const subject = `Intervention complétée - ${appState.currentFile.name}`;
    const body = `Intervention complétée.\n\nSolution: ${elements.interventionSolution.value}`;
    
    // Préparer l'URL mailto
    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Créer un lien pour télécharger la pièce jointe
    const attachmentUrl = `/download?file=${encodeURIComponent(filePath)}`;
    const attachmentName = filePath.split('/').pop().substring(37); // Enlever l'UUID
    
    // Afficher les instructions et les liens
    const instructionHtml = `
        <h3>Envoi de l'intervention par email</h3>
        <p>Suivez ces étapes :</p>
        <ol class="mailto-steps">
            <li>Téléchargez d'abord la pièce jointe
                <div>
                    <a href="${attachmentUrl}" class="btn btn-primary mailto-btn" target="_blank">Télécharger la pièce jointe</a>
                </div>
            </li>
            <li>Composez ensuite votre email
                <div>
                    <a href="${mailtoUrl}" class="btn btn-mail mailto-btn">Ouvrir Mail</a>
                </div>
            </li>
        </ol>
        <p>N'oubliez pas d'attacher le fichier Excel que vous venez de télécharger au mail.</p>
    `;
    
    // Afficher le conteneur
    elements.mailtoContainer.innerHTML = instructionHtml;
    elements.mailtoContainer.classList.remove('hide');
    
    // Marquer l'email comme lu
    markEmailAsRead(appState.currentFile.emailId);
}

// Marquer un email comme lu
async function markEmailAsRead(emailId) {
    const credentials = JSON.parse(sessionStorage.getItem('emailCredentials'));
    if (!credentials) return;
    
    try {
        await fetch(`${apiBaseUrl}/mark-as-read`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
                emailId
            })
        });
        
        // Mettre à jour la liste des emails
        appState.emails = appState.emails.filter(email => email.id !== emailId);
        
        // Si on est dans l'onglet Emails, mettre à jour l'affichage
        if (elements.contentEmails.classList.contains('active')) {
            renderEmailList();
        }
    } catch (error) {
        console.error('Erreur lors du marquage de l\'email comme lu:', error);
    }
}

// Enregistrement de l'intervention
async function saveIntervention(forMail = false) {
    if (!appState.currentFile) {
        showAlert('Aucune intervention en cours.', 'warning');
        return;
    }
    
    // Validation des données
    const sinoffCode = elements.sinoffCode.value;
    if (!sinoffCode || sinoffCode < 0 || sinoffCode > 999) {
        showAlert('Le SinoffCode doit être un nombre entre 000 et 999.', 'warning');
        return;
    }
    
    // Récupérer les dates/heures du format ISO
    const startDateTime = new Date(elements.startDateTime.value);
    const endDateTime = new Date(elements.endDateTime.value);
    
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        showAlert('Les dates et heures doivent être correctement définies.', 'warning');
        return;
    }
    
    // Extraction jour, mois, heure, minute
    const startDay = startDateTime.getDate();
    const startMonth = startDateTime.getMonth() + 1; // getMonth() retourne 0-11
    const startHour = startDateTime.getHours();
    const startMinute = startDateTime.getMinutes();
    
    const endDay = endDateTime.getDate();
    const endMonth = endDateTime.getMonth() + 1;
    const endHour = endDateTime.getHours();
    const endMinute = endDateTime.getMinutes();
    
    const solution = elements.interventionSolution.value;
    
    if (!solution.trim()) {
        showAlert('Veuillez décrire la solution apportée.', 'warning');
        return;
    }
    
    // Préparation du formulaire
    const formData = new FormData();
    formData.append('file', appState.currentFile.path);
    formData.append('sinoffCode', sinoffCode);
    formData.append('startDay', startDay);
    formData.append('startMonth', startMonth);
    formData.append('startHour', startHour);
    formData.append('startMinute', startMinute);
    formData.append('endDay', endDay);
    formData.append('endMonth', endMonth);
    formData.append('endHour', endHour);
    formData.append('endMinute', endMinute);
    formData.append('solution', solution);

    showAlert('Traitement du fichier Excel...', 'info');
    
    try {
        const response = await fetch(`${apiBaseUrl}/process-excel`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (forMail) {
                // Si appelé pour préparer un email, générer le lien mailto
                generateMailtoLink(data.filePath);
            } else {
                // Sinon, afficher un message de succès
                showAlert('Intervention enregistrée avec succès.', 'success');
                
                // Marquer l'email comme lu
                await markEmailAsRead(appState.currentFile.emailId);
                
                // Réinitialiser le formulaire
                resetInterventionForm();
            }
        } else {
            throw new Error(data.error || 'Erreur lors du traitement du fichier');
        }
    } catch (error) {
        console.error('Erreur lors du traitement:', error);
        showAlert('Erreur: ' + error.message, 'danger');
    }
}

// Réinitialisation du formulaire d'intervention
function resetInterventionForm() {
    // Masquer le formulaire et afficher le message par défaut
    elements.interventionForm.classList.add('hide');
    elements.interventionDetails.classList.remove('hide');
    elements.interventionDetails.innerHTML = '<p>Aucune intervention en cours. Sélectionnez un fichier d\'intervention depuis l\'onglet Emails.</p>';
    
    // Masquer le conteneur mailto s'il est visible
    elements.mailtoContainer.classList.add('hide');
    
    // Réinitialiser l'état
    appState.currentFile = null;
    
    // Rediriger vers l'onglet Emails
    switchTab('Emails');
}

// Annulation d'une intervention
function cancelIntervention() {
    if (confirm('Êtes-vous sûr de vouloir annuler cette intervention?')) {
        resetInterventionForm();
        showAlert('Intervention annulée.', 'info');
    }
}

// Enregistrement de la configuration
function saveConfiguration() {
    appState.config.targetEmail = elements.targetEmail.value;
    appState.config.filePrefix = elements.filePrefix.value;
    appState.config.rememberCredentials = elements.rememberCredentials.checked;
    
    localStorage.setItem('appConfig', JSON.stringify(appState.config));
    
    showAlert('Configuration enregistrée.', 'success');
}

// Navigation entre les onglets
function switchTab(tabName) {
    // Masquer tous les contenus
    elements.contentEmails.classList.remove('active');
    elements.contentIntervention.classList.remove('active');
    elements.contentConfig.classList.remove('active');
    
    // Désactiver tous les onglets
    elements.tabEmails.classList.remove('active');
    elements.tabIntervention.classList.remove('active');
    elements.tabConfig.classList.remove('active');
    
    // Activer l'onglet et le contenu sélectionnés
    elements[`tab${tabName}`].classList.add('active');
    elements[`content${tabName}`].classList.add('active');
}

// Affichage des alertes
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    elements.alertContainer.innerHTML = '';
    elements.alertContainer.appendChild(alertDiv);
    
    // Auto-disparition après 5 secondes
    setTimeout(() => {
        if (alertDiv.parentNode === elements.alertContainer) {
            alertDiv.remove();
        }
    }, 5000);
}

// Mise en œuvre des fonctions globales pour les appels depuis le HTML
window.downloadAttachment = downloadAttachment;
window.acceptIntervention = acceptIntervention;
window.rejectIntervention = rejectIntervention;
