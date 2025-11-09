// Clés de localStorage & Global Variables
const workersKey='workers'; const presenceKey='presence'; const plannedAbsenceKey='plannedAbsence'; const holidaysKey='holidays'; 
const today = new Date().toISOString().slice(0, 10); 
let editingIndex=null; let chart=null; let profileChart = null; 
let currentMonth = new Date().getMonth(); let currentYear = new Date().getFullYear();
const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// Variables de Filtrage du Tableau
let currentFilter = 'all'; // 'today', 'week', 'month', 'all'
let selectedTableWorkers = [];

// Variables de Tri (Mises à jour pour le tri par défaut)
let currentSortColumn = 'date';
let currentSortDirection = 'desc';

// --- Helper Functions (CORE FUNCTIONALITY) ---
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}
function timeDiffInMinutes(startStr, endStr) {
    if (!startStr || !endStr) return 0;
    const startMinutes = timeToMinutes(startStr);
    let endMinutes = timeToMinutes(endStr);
    if (endMinutes < startMinutes) { endMinutes += 1440; }
    return Math.max(0, endMinutes - startMinutes);
}
function calculateHours(entry, exit, breakStart, breakEnd) { 
    let totalWorkMinutes = timeDiffInMinutes(entry, exit);
    let breakMinutes = timeDiffInMinutes(breakStart, breakEnd);
    if (breakMinutes > 0) totalWorkMinutes -= breakMinutes;
    return totalWorkMinutes > 0 ? totalWorkMinutes / 60 : 0;
}
function calculateBreakMinutes(breakStart, breakEnd) { return timeDiffInMinutes(breakStart, breakEnd); }
function calculateLateness(entryTime, defaultEntryTime) {
    if (!entryTime || !defaultEntryTime) return 0;
    const entryMinutes = timeToMinutes(entryTime);
    const defaultMinutes = timeToMinutes(defaultEntryTime);
    return Math.max(0, entryMinutes - defaultMinutes); 
}
function showToast(message, duration = 3000) { 
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.style.cssText = 'visibility: visible; min-width: 250px; background-color: #333; color: #fff; text-align: center; border-radius: 6px; padding: 12px; position: fixed; z-index: 1001; left: 50%; bottom: 80px; transform: translateX(-50%); opacity: 1; transition: opacity 0.3s;';
    setTimeout(() => { toast.style.opacity = '0'; }, duration - 300);
    setTimeout(() => { toast.style.visibility = 'hidden'; }, duration);
}
function getWorkersList() { return JSON.parse(localStorage.getItem(workersKey) || '[]'); }
function isHolidayCheck(dateStr) { 
    const holidays = JSON.parse(localStorage.getItem(holidaysKey) || '[]');
    return holidays.some(h => h.date === dateStr);
}

// --- Modal Handlers (Mise à jour pour un affichage "fixe") ---
function showDayDetails(dateStr) {
    const presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    const holidays = JSON.parse(localStorage.getItem(holidaysKey) || '[]');
    const isHoliday = holidays.find(h => h.date === dateStr);
    
    const dayRecords = presence.filter(p => p.date === dateStr);
    
    const modal = document.getElementById('dayDetailsModal');
    const title = document.getElementById('modalDateTitle');
    const holidayInfo = document.getElementById('modalHolidayInfo');
    const detailsList = document.getElementById('modalDetailsList');

    detailsList.innerHTML = '';
    
    const dateObj = new Date(dateStr + 'T00:00:00'); 
    const dayName = dayNames[dateObj.getDay()];
    
    let totalNetHoursDay = 0;
    dayRecords.forEach(p => {
        if (p.entry && p.exit) {
            totalNetHoursDay += calculateHours(p.entry, p.exit, p.breakStart, p.breakEnd);
        }
    });

    title.innerHTML = `📅 **${dayName} ${dateStr}**`;
    if (dayRecords.length > 0) {
        title.innerHTML += `<br><small style="color:#007bff; font-weight:normal;">Total Net: **${totalNetHoursDay.toFixed(2)}h**</small>`;
    }
    
    if (isHoliday) {
        holidayInfo.textContent = `🎉 Jour Férié: ${isHoliday.name}`;
        holidayInfo.style.color = '#D62828'; 
    } else {
        holidayInfo.textContent = 'Jour Ouvré Normal.';
        holidayInfo.style.color = 'inherit';
    }

    if (dayRecords.length === 0) {
        if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
            detailsList.innerHTML = '<li style="color: #6c757d;"><i class="fas fa-mug-hot"></i> Aucune entrée. (Weekend)</li>';
        } else {
            detailsList.innerHTML = '<li style="color: #6c757d;"><i class="fas fa-info-circle"></i> Aucune entrée de présence/absence enregistrée pour cette date.</li>';
        }
    } else {
        dayRecords.forEach(p => {
            const li = document.createElement('li');
            li.style.padding = '10px 0';
            li.style.borderBottom = '1px dotted #ccc';
            
            let statusText = '';
            let color = 'inherit';
            let icons = '';
            
            if (p.absence) {
                statusText = `❌ Absent: ${p.absence}`;
                color = '#dc3545';
                icons += `<i class="fas fa-calendar-times"></i>`;
            } else if (p.entry && p.exit) {
                const hours = calculateHours(p.entry, p.exit, p.breakStart, p.breakEnd).toFixed(2);
                const breakMins = calculateBreakMinutes(p.breakStart, p.breakEnd);
                statusText = `✅ Présent: ${p.entry} - ${p.exit}`;
                color = '#4CAF50'; 
                icons += `<span style="color:${color};"><i class="fas fa-clock"></i> Net: ${hours}h</span> | <span style="color:#6c757d;"><i class="fas fa-coffee"></i> Pause: ${breakMins}m</span>`;
            } else if (p.entry && !p.exit) {
                statusText = `🟡 Actif: Entré à ${p.entry} (Pas de sortie)`;
                color = '#FFC107'; 
                icons += `<i class="fas fa-running"></i>`;
            } else {
                statusText = `❓ Statut Indéterminé`;
            }
            
            const noteContent = p.note ? `<br><small style="color:#777; margin-top: 5px;"><i class="fas fa-sticky-note"></i> **Note:** ${p.note}</small>` : '';
            
            li.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px;">${p.name}</div>
                <div style="color: ${color}; font-size: 0.95rem;">${statusText}</div>
                <div style="font-size: 0.85rem; margin-top: 5px;">${icons}</div>
                ${noteContent}
            `;
            detailsList.appendChild(li);
        });
    }

    modal.style.display = 'block'; // Afficher la modale au premier plan
}

function closeModal() {
    document.getElementById('dayDetailsModal').style.display = 'none'; // Masquer la modale
}
// --- End Modal Handlers ---

// --- Core Tab Navigation & Initial Load ---
function openTab(evt, tabName) {
    let i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content-card");
    for (i = 0; i < tabcontent.length; i++) { tabcontent[i].classList.add('hidden'); }
    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) { tablinks[i].classList.remove("active"); }
    document.getElementById(tabName).classList.remove('hidden');
    evt.currentTarget.classList.add("active");
    
    if(tabName === 'reports') { loadWorkersIntoSelects(); calculateKPIs(); drawChart(); } 
    if(tabName === 'table') { loadWorkersIntoSelects(); loadPresence(); updatePeriodFilterButtonLabel(); updateSortButtonLabel(); } 
    if(tabName === 'calendar') { loadWorkersIntoSelects(); drawCalendar(currentYear, currentMonth); } 
    if(tabName === 'employees') { loadWorkers(); loadHoliday(); loadDashboardSummary(); loadPendingActions(); } // NOUVEAU: Appel des fonctions du Dashboard
    if(tabName === 'register') { loadWorkersIntoSelects(); loadQuickSummary(); loadPlannedAbsence(); } 
    if(tabName === 'profile') { loadWorkersIntoSelects(); loadWorkerProfile(); } 
}

// ------------------------------------
// NOUVEAU: Dashboard Logic 
// ------------------------------------
function loadDashboardSummary() {
    const workers = getWorkersList();
    const presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    const totalWorkers = workers.length;
    
    document.getElementById('currentDateDisplay').textContent = `(Aujourd'hui: ${today})`;
    document.getElementById('kpiTotalWorkers').textContent = totalWorkers;

    if (totalWorkers === 0) {
        document.getElementById('kpiPresentNow').textContent = 0;
        document.getElementById('kpiAbsencesToday').textContent = 0;
        document.getElementById('presenceNowList').innerHTML = '<li style="background-color: #f7f7f7; color: #777; border: 1px dashed #ccc;">Aucun employé enregistré.</li>';
        return;
    }

    const todayEntries = presence.filter(p => p.date === today);
    const presentWorkers = new Set();
    const absentWorkers = new Set();
    
    // Identifier les présents actifs et les absents confirmés
    todayEntries.forEach(p => {
        if (p.absence) {
            absentWorkers.add(p.name);
        } else if (p.entry && !p.exit) {
            presentWorkers.add(p.name);
        }
    });

    // Liste des présents actifs
    const presenceNowList = document.getElementById('presenceNowList');
    presenceNowList.innerHTML = '';
    
    if (presentWorkers.size === 0) {
        presenceNowList.innerHTML = '<li style="background-color: #f0f0f0; color: #777; border: 1px dashed #ccc;">Personne n\'a "Punch In" pour l\'instant.</li>';
    } else {
        presentWorkers.forEach(name => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fas fa-check-circle"></i> ${name}`;
            presenceNowList.appendChild(li);
        });
    }

    // Calcul des KPI pour le résumé
    const totalAbsent = Array.from(absentWorkers).filter(name => !presentWorkers.has(name)).length;
    
    document.getElementById('kpiPresentNow').textContent = presentWorkers.size;
    document.getElementById('kpiAbsencesToday').textContent = totalAbsent;
}

function loadPendingActions() {
    const presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    const pendingActionsList = document.getElementById('pendingActionsList');
    pendingActionsList.innerHTML = '';
    
    const pendingEntries = presence.filter(p => 
        p.date !== today && // Seulement les jours précédents
        p.entry && // Doit avoir une entrée
        !p.exit && // Ne doit pas avoir de sortie
        !p.absence // Ne doit pas être une absence confirmée
    ).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (pendingEntries.length === 0) {
        pendingActionsList.innerHTML = '<li style="background-color: #f7f7f7; color: #777; border: 1px dashed #ccc;">Aucune action en attente. Toutes les saisies précédentes sont clôturées.</li>';
        return;
    }

    pendingEntries.forEach(p => {
        const originalPresenceList = JSON.parse(localStorage.getItem(presenceKey) || '[]');
        const originalIndex = originalPresenceList.findIndex((item) => 
            item.date === p.date && item.name === p.name && item.entry === p.entry && !item.exit
        );
        
        const li = document.createElement('li');
        li.innerHTML = `
            <span>
                <i class="fas fa-exclamation-triangle"></i> 
                **${p.name}** : Entrée à ${p.entry} le **${p.date}**. Sortie manquante!
            </span>
            <button onclick="resolvePendingAction(${originalIndex})" style="background-color: #007bff;"><i class="fas fa-pencil-alt"></i> Résoudre</button>
        `;
        pendingActionsList.appendChild(li);
    });
}

function resolvePendingAction(originalIndex) {
     if (originalIndex === null || originalIndex < 0) return showToast('Erreur: Index invalide.', 3000);

     // Récupérer les données de la ligne concernée
     let presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
     const entry = presence[originalIndex];

     if (!entry) return showToast('Erreur: Entrée introuvable.', 3000);
     
     // Remplir le formulaire de saisie manuelle avec les données et le mode édition
     document.getElementById('workerSelect').value = entry.name;
     document.getElementById('dateSelect').value = entry.date;
     document.getElementById('entryTime').value = entry.entry;
     document.getElementById('exitTime').value = entry.exit || getWorkersList().find(w => w.name === entry.name)?.defaultExit || '17:00'; // Proposer l'heure de sortie par défaut
     document.getElementById('breakStart').value = entry.breakStart || '';
     document.getElementById('breakEnd').value = entry.breakEnd || '';
     document.getElementById('manualNote').value = entry.note || '';

     editingIndex = originalIndex; 
     document.getElementById('registerButton').textContent = 'Mettre à Jour la Saisie (Corriger Sortie)';
     document.getElementById('registerButton').style.backgroundColor = '#007bff';
     
     showToast(`Correction de la saisie de ${entry.name} du ${entry.date}.`, 4000);
     
     // Basculer vers l'onglet de Saisie
     const registerTabButton = document.querySelector('.tab-navigation button[onclick*="openTab(event, \'register\')"]');
     if (registerTabButton) registerTabButton.click(); 

     window.scrollTo(0, 0); // Faire défiler vers le haut pour voir le formulaire
}

// ------------------------------------
// 1. Worker Management 
// ------------------------------------
function addWorker() {
    const name = document.getElementById('workerName').value.trim();
    const dept = document.getElementById('workerDepartment').value.trim();
    const entry = document.getElementById('defaultEntry').value;
    const exit = document.getElementById('defaultExit').value;

    if (!name) return showToast('Veuillez entrer le nom de l\'employé.', 3000);

    let workers = getWorkersList();
    if (workers.some(w => w.name === name)) return showToast('Cet employé existe déjà.', 3000);

    workers.push({ 
        name, department: dept, defaultEntry: entry, defaultExit: exit, 
        image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>"
    }); 
    localStorage.setItem(workersKey, JSON.stringify(workers));
    showToast(`${name} ajouté avec succès!`, 3000);
    
    document.getElementById('workerName').value = '';
    document.getElementById('workerDepartment').value = '';
    loadWorkers();
    loadWorkersIntoSelects();
    loadDashboardSummary(); // Mettre à jour le tableau de bord
}

function loadWorkers(){
  const ul=document.getElementById('workerList'); ul.innerHTML='';
  const workers=getWorkersList();
  if (workers.length === 0) { ul.innerHTML = '<li style="color: #777; border-left: none; background-color: transparent;">Aucun employé enregistré.</li>'; return; }
  workers.forEach((w,i)=>{
    const name = w.name;
    const shift = ` (${w.defaultEntry} - ${w.defaultExit})`;
    const dept = w.department ? ` [${w.department}]` : ''; 

    const li=document.createElement('li'); 
    li.style.cssText = 'padding: 5px 0; border-bottom: 1px dotted #eee;';
    li.textContent=`${name}${dept}${shift}`;
    li.innerHTML += ` <button onclick="deleteWorker('${name}')" class="delete-btn" title="Supprimer"><i class="fas fa-trash-alt"></i></button>`;
    ul.appendChild(li);
  });
}

function deleteWorker(name) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${name} et ses données de présence?`)) {
        let workers = getWorkersList().filter(w => w.name !== name);
        let presence = JSON.parse(localStorage.getItem(presenceKey) || '[]').filter(p => p.name !== name);
        let plannedAbsence = JSON.parse(localStorage.getItem(plannedAbsenceKey) || '[]').filter(a => a.name !== name); 
        
        localStorage.setItem(workersKey, JSON.stringify(workers));
        localStorage.setItem(presenceKey, JSON.stringify(presence));
        localStorage.setItem(plannedAbsenceKey, JSON.stringify(plannedAbsence)); 
        
        showToast(`${name} a été supprimé.`, 3000);
        loadWorkers();
        loadWorkersIntoSelects();
        loadPresence(); 
        loadDashboardSummary(); // Mettre à jour le tableau de bord
    }
}

// --- Holiday Management ---
function addHoliday() {
    const date = document.getElementById('holidayDate').value;
    const name = document.getElementById('holidayName').value.trim();
    if (!date || !name) return showToast('Veuillez entrer la date et le nom du jour férié.', 3000);

    let holidays = JSON.parse(localStorage.getItem(holidaysKey) || '[]');
    holidays.push({ date, name });
    localStorage.setItem(holidaysKey, JSON.stringify(holidays));
    showToast(`Jour férié '${name}' ajouté.`, 3000);
    loadHoliday();
    drawCalendar(currentYear, currentMonth); 
    loadDashboardSummary(); // Mettre à jour le tableau de bord
}

function loadHoliday() {
    const ul = document.getElementById('holidayList'); ul.innerHTML = '';
    const holidays = JSON.parse(localStorage.getItem(holidaysKey) || '[]').sort((a, b) => new Date(a.date) - new Date(b.date));
    if (holidays.length === 0) { ul.innerHTML = '<li style="color: #777; border-left: none; background-color: transparent;">Aucun jour férié enregistré.</li>'; return; }

    holidays.forEach(h => {
        const li = document.createElement('li');
        li.textContent = `${h.date} - ${h.name}`;
        li.innerHTML += ` <button onclick="deleteHoliday('${h.date}')" class="delete-btn" title="Supprimer"><i class="fas fa-trash-alt"></i></button>`;
        ul.appendChild(li);
    });
}
function deleteHoliday(date) {
     if (confirm(`Êtes-vous sûr de vouloir supprimer le jour férié du ${date}?`)) {
        let holidays = JSON.parse(localStorage.getItem(holidaysKey) || '[]').filter(h => h.date !== date);
        localStorage.setItem(holidaysKey, JSON.stringify(holidays));
        showToast(`Jour férié du ${date} supprimé.`, 3000);
        loadHoliday();
        drawCalendar(currentYear, currentMonth); 
        loadDashboardSummary(); // Mettre à jour لوحة التحكم
     }
}


// --- Presence/Absence Management (LOAD SELECTS & NEW CUSTOM SELECT) ---
function loadWorkersIntoSelects() {
    const workers = getWorkersList().sort((a, b) => a.name.localeCompare(b.name));
    
    const selectIds = [
        'workerSelect', 'absenceWorker', 
        'calendarWorker', 'profileWorkerSelect', 'reportsWorkerSelect'
    ];
    
    // 1. Charger les selects simples (WorkerSelect, AbsenceWorker, etc.)
    selectIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return; 
        
        const selectedValue = select.value;
        select.innerHTML = '';
        
        const isDefaultAll = (id === 'calendarWorker' || id === 'reportsWorkerSelect');
        
        const defaultOption = document.createElement('option');
        if (isDefaultAll) {
             defaultOption.value = 'all';
             defaultOption.textContent = 'Tous les employés';
        } else {
            defaultOption.value = '';
            defaultOption.disabled = true;
            defaultOption.textContent = '-- Sélectionner --';
        }
        defaultOption.selected = true; 
        select.appendChild(defaultOption);

        workers.forEach(worker => {
            const option = document.createElement('option');
            option.value = worker.name;
            option.textContent = worker.name;
            select.appendChild(option);
        });

        if (select.querySelector(`option[value="${selectedValue}"]`)) {
            select.value = selectedValue;
        } else if (isDefaultAll) {
            select.value = 'all'; 
        }
    });
    
    // 2. Créer le Custom Dropdown pour Quick Punch
    createCustomDropdown('quick', workers, [], updateCustomSelectButton);
    
    // 3. Créer le Custom Dropdown pour le Tableau (Multi-sélection de filtre)
    createCustomDropdown('table', workers, selectedTableWorkers, updateTableCustomSelectButton);
}

function createCustomDropdown(type, workers, initialSelection, updateFunction) {
    const dropdownId = `custom${type.charAt(0).toUpperCase() + type.slice(1)}WorkerSelectDropdown`;
    const dropdown = document.getElementById(dropdownId);
    
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    
    if (workers.length === 0) {
        dropdown.innerHTML = '<div style="padding: 10px; color: #777;">Aucun employé enregistré.</div>';
        updateFunction(type);
        return;
    }

    // Ajout de l'option "Tout sélectionner/Désélectionner" pour le filtre de table
    if (type === 'table') {
        const toggleAllLabel = document.createElement('label');
        toggleAllLabel.className = 'dropdown-item-label';
        toggleAllLabel.style.fontWeight = 'bold';
        
        const toggleAllCheckbox = document.createElement('input');
        toggleAllCheckbox.type = 'checkbox';
        toggleAllCheckbox.id = 'toggle-all-workers';
        
        // Initialiser la case "Tout sélectionner"
        if (initialSelection.length === workers.length && workers.length > 0) {
            toggleAllCheckbox.checked = true;
            toggleAllLabel.classList.add('selected');
        }

        toggleAllCheckbox.onchange = () => {
            const isChecked = toggleAllCheckbox.checked;
            const checkboxes = document.querySelectorAll(`#${dropdownId} input[type="checkbox"]:not(#toggle-all-workers)`);
            checkboxes.forEach(cb => {
                cb.checked = isChecked;
                cb.closest('.dropdown-item-label').classList.toggle('selected', isChecked);
            });
            // Mise à jour de la liste des employés sélectionnés après l'action "Tout"
            if (isChecked) {
                selectedTableWorkers = workers.map(w => w.name);
            } else {
                selectedTableWorkers = [];
            }
            toggleAllLabel.classList.toggle('selected', isChecked);
            updateFunction(type);
            loadPresence(); 
        };
        
        toggleAllLabel.appendChild(toggleAllCheckbox);
        toggleAllLabel.appendChild(document.createTextNode('Tout Sélectionner / Désélectionner'));
        dropdown.appendChild(toggleAllLabel);
        
        dropdown.appendChild(document.createElement('hr'));
    }

    workers.forEach(worker => {
        const label = document.createElement('label');
        label.className = 'dropdown-item-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = `${type}Worker`;
        checkbox.value = worker.name;
        checkbox.id = `${type}-worker-${worker.name.replace(/\s/g, '_')}`; 
        
        const isSelected = initialSelection.includes(worker.name);
        checkbox.checked = isSelected;
        if (isSelected) label.classList.add('selected');
        
        checkbox.onchange = () => {
            if (checkbox.checked) {
                label.classList.add('selected');
                if (type === 'table' && !selectedTableWorkers.includes(worker.name)) {
                    selectedTableWorkers.push(worker.name);
                }
            } else {
                label.classList.remove('selected');
                if (type === 'table') {
                    selectedTableWorkers = selectedTableWorkers.filter(n => n !== worker.name);
                }
            }
            
            // Si le type est 'table', on doit vérifier si 'Tout' doit être décoché
            if (type === 'table') {
                const totalWorkers = workers.length;
                const checkedWorkers = selectedTableWorkers.length;
                const toggleAllCheckbox = document.getElementById('toggle-all-workers');
                const toggleAllLabel = toggleAllCheckbox ? toggleAllCheckbox.closest('.dropdown-item-label') : null;

                if (toggleAllCheckbox) {
                    toggleAllCheckbox.checked = (checkedWorkers === totalWorkers);
                    if (toggleAllLabel) toggleAllLabel.classList.toggle('selected', (checkedWorkers === totalWorkers));
                }
                loadPresence(); // Recharge le tableau après modification du filtre
            }
            
            updateFunction(type);
        };

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(worker.name));
        dropdown.appendChild(label);
    });
    
    updateFunction(type);
}


// --- Custom Dropdown Handlers ---
function toggleWorkerDropdown(type) {
    const dropdownId = `custom${type.charAt(0).toUpperCase() + type.slice(1)}WorkerSelectDropdown`;
    const buttonId = `custom${type.charAt(0).toUpperCase() + type.slice(1)}SelectButton`;
    
    const dropdown = document.getElementById(dropdownId);
    const button = document.getElementById(buttonId);
    
    if (!dropdown || !button) return;
    
    const isHidden = dropdown.classList.contains('hidden');
    
    // Fermer les autres dropdowns ouverts si besoin
    if (type === 'quick') closeWorkerDropdown('table');
    if (type === 'table') closeWorkerDropdown('quick');
    closePeriodDropdown(); // Fermer le dropdown de période si ouvert
    closeSortDropdown(); // Fermer le dropdown de tri si ouvert
    
    if (isHidden) {
        dropdown.classList.remove('hidden');
        button.classList.add('active');
    } else {
        dropdown.classList.add('hidden');
        button.classList.remove('active');
    }
}

function closeWorkerDropdown(type) {
    const dropdownId = `custom${type.charAt(0).toUpperCase() + type.slice(1)}WorkerSelectDropdown`;
    const buttonId = `custom${type.charAt(0).toUpperCase() + type.slice(1)}SelectButton`;
    
    const dropdown = document.getElementById(dropdownId);
    const button = document.getElementById(buttonId);
    
    if (!dropdown || !button) return;
    
    if (!dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
        button.classList.remove('active');
    }
}

function updateCustomSelectButton(type) {
    const dropdownId = `custom${type.charAt(0).toUpperCase() + type.slice(1)}WorkerSelectDropdown`;
    const buttonTextId = (type === 'quick') ? 'selectedWorkerCount' : 'selectedTableWorkerCount';
    const buttonId = `custom${type.charAt(0).toUpperCase() + type.slice(1)}SelectButton`;
    
    const selector = (type === 'table') ? `#${dropdownId} input[type="checkbox"]:checked:not(#toggle-all-workers)` : `#${dropdownId} input[type="checkbox"]:checked`;
    const checkboxes = document.querySelectorAll(selector);
    const count = checkboxes.length;
    const buttonText = document.getElementById(buttonTextId);
    const workersCount = getWorkersList().length;

    if (!buttonText) return;

    if (type === 'table') {
        if (count === 0 || count === workersCount) {
             buttonText.innerHTML = `-- Tous les employés (${workersCount}) --`;
        } else if (count === 1) {
            buttonText.innerHTML = `**${checkboxes[0].value}**`;
        } else {
            buttonText.innerHTML = `**${count} Employé(s)** sélectionné(s)`;
        }
    } else if (type === 'quick') {
        if (count === 0) {
             buttonText.innerHTML = `-- Sélectionner 0 Employé(s) --`;
        } else if (count === 1) {
            buttonText.innerHTML = `**${checkboxes[0].value}**`;
        } else {
            buttonText.innerHTML = `**${count} Employé(s)** sélectionné(s)`;
        }
    }

    buttonText.style.color = 'white'; 
    const button = document.getElementById(buttonId);
    if (button) {
        button.style.backgroundColor = '#D62828';
        button.style.borderColor = '#D62828';
        button.style.color = 'white'; 
        const icon = button.querySelector('i');
        if (icon) icon.style.color = 'white';
    }
}

// Pour le select du tableau, on s'assure que le 0 employé signifie "tous"
function updateTableCustomSelectButton() {
    const checkboxes = document.querySelectorAll('#customTableWorkerSelectDropdown input[type="checkbox"]:checked:not(#toggle-all-workers)');
    selectedTableWorkers = Array.from(checkboxes).map(cb => cb.value);
    
    updateCustomSelectButton('table');
}

// --- NEW PERIOD FILTER LOGIC ---
function togglePeriodDropdown() {
    const dropdown = document.getElementById('periodFilterDropdown');
    const button = document.getElementById('periodFilterButton');
    
    // Fermer les autres dropdowns
    closeWorkerDropdown('quick');
    closeWorkerDropdown('table');
    closeSortDropdown();
    
    if (dropdown.classList.contains('hidden')) {
        dropdown.classList.remove('hidden');
        button.classList.add('active');
    } else {
        dropdown.classList.add('hidden');
        button.classList.remove('active');
    }
}

function closePeriodDropdown() {
    const dropdown = document.getElementById('periodFilterDropdown');
    const button = document.getElementById('periodFilterButton');
    if (dropdown && button) {
        dropdown.classList.add('hidden');
        button.classList.remove('active');
    }
}

function selectPeriodFilter(filterType) {
    applyDateFilter(filterType);
    updatePeriodFilterButtonLabel(filterType);
    closePeriodDropdown(); 
}

function updatePeriodFilterButtonLabel(filterType = currentFilter) {
    const labelSpan = document.getElementById('currentPeriodLabel');
    const options = document.querySelectorAll('.period-filter-option');
    
    if (!labelSpan) return;
    
    let label = '';
    options.forEach(opt => {
        opt.classList.remove('active');
        if (opt.getAttribute('data-filter') === filterType) {
            label = opt.textContent.trim();
            opt.classList.add('active');
        }
    });
    
    labelSpan.textContent = label || 'Toute la Période';
    currentFilter = filterType;
}

// --- NEW SORT DROPDOWN LOGIC ---
function toggleSortDropdown() {
    const dropdown = document.getElementById('sortFilterDropdown');
    const button = document.getElementById('sortFilterButton');
    
    // Fermer les autres dropdowns
    closeWorkerDropdown('quick');
    closeWorkerDropdown('table');
    closePeriodDropdown();
    
    if (dropdown.classList.contains('hidden')) {
        dropdown.classList.remove('hidden');
        button.classList.add('active');
    } else {
        dropdown.classList.add('hidden');
        button.classList.remove('active');
    }
}

function closeSortDropdown() {
    const dropdown = document.getElementById('sortFilterDropdown');
    const button = document.getElementById('sortFilterButton');
    if (dropdown && button) {
        dropdown.classList.add('hidden');
        button.classList.remove('active');
    }
}

function selectSortOption(column, direction, label) {
    currentSortColumn = column;
    currentSortDirection = direction;
    loadPresence();
    
    // Mise à jour de l'interface
    updateSortButtonLabel(label);
    closeSortDropdown();
    
    // Mettre à jour la classe "active" dans le dropdown
    const options = document.querySelectorAll('.sort-filter-option');
    options.forEach(opt => {
        opt.classList.remove('active');
        if (opt.getAttribute('data-column') === column && opt.getAttribute('data-direction') === direction) {
            opt.classList.add('active');
        }
    });
}

function updateSortButtonLabel(label = null) {
    const labelSpan = document.getElementById('currentSortLabel');
    if (label) {
        labelSpan.textContent = label;
        showToast(`Tri appliqué: ${label}.`, 3000);
    } else {
        // Au chargement, définir le label par défaut si non spécifié
        const defaultOption = document.querySelector(`.sort-filter-option[data-column="${currentSortColumn}"][data-direction="${currentSortDirection}"]`);
        if (defaultOption) {
            labelSpan.textContent = defaultOption.textContent.trim();
        } else {
             labelSpan.textContent = 'Date (Récents)'; // Fallback
        }
    }
}

// NOTE: L'ancienne fonction sortPresenceTable n'est plus appelée directement par les boutons, 
// mais elle est conservée ici pour la lisibilité de loadPresence (même si le corps est fusionné dans selectSortOption)
function sortPresenceTable(column, direction) {
    // Cette fonction est désormais un alias de selectSortOption pour l'appel de loadPresence().
    // Le tri réel et la mise à jour des variables globales se font dans selectSortOption().
    // Nous appelons ici pour maintenir la compatibilité si d'autres parties du code l'utilisent.
    const label = document.querySelector(`.sort-filter-option[data-column="${column}"][data-direction="${direction}"]`)?.textContent.trim() || 'Tri Personnalisé';
    selectSortOption(column, direction, label);
}
// --- END NEW SORT DROPDOWN LOGIC ---


// --- Quick Punch In/Out (UPDATED TO READ CHECKBOXES) ---
function quickPunch(type) {
    const checkboxes = document.querySelectorAll('#customQuickWorkerSelectDropdown input[type="checkbox"]:checked');
    const selectedNames = Array.from(checkboxes).map(cb => cb.value);

    const note = document.getElementById('taskNoteQuick').value.trim();
    if (selectedNames.length === 0) return showToast('Veuillez sélectionner au moins un nom.', 3000);

    let presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    const currentTime = new Date().toTimeString().slice(0, 5); // HH:MM
    let successCount = 0;
    let failedNames = [];

    selectedNames.forEach(name => {
        if (type === 'in') {
            const existingEntry = presence.find(p => p.name === name && p.date === today && !p.exit);
            if (existingEntry) {
                failedNames.push(name);
                return;
            }

            presence.push({
                date: today, name, entry: currentTime, exit: null, breakStart: null, breakEnd: null, note: note, absence: null
            });
            successCount++;

        } else if (type === 'out') {
            const index = presence.findIndex(p => p.name === name && p.date === today && !p.exit);
            if (index === -1) {
                failedNames.push(name);
                return;
            }

            presence[index].exit = currentTime;
            if (note) presence[index].note = presence[index].note ? `${presence[index].note} / Sortie: ${note}` : `Sortie: ${note}`;
            
            if (timeToMinutes(presence[index].entry) >= timeToMinutes(currentTime)) {
                 presence[index].exit = null; 
                 failedNames.push(name + " (Heure invalide)");
                 return;
            }
            successCount++;
        }
    });
    
    localStorage.setItem(presenceKey, JSON.stringify(presence));
    document.getElementById('taskNoteQuick').value = '';
    
    let message = '';
    if (successCount > 0) {
        message += `${successCount} enregistrement(s) ${type === 'in' ? 'ENTRÉE' : 'SORTIE'} réussi(s) à ${currentTime}.`;
    }
    if (failedNames.length > 0) {
        message += (message ? ' | ' : '') + `${failedNames.length} échec(s) (${failedNames.join(', ')}) (Déjà Punché/Non Punché).`;
    }
    
    showToast(message || 'Aucune action effectuée.', 4000);

    checkboxes.forEach(cb => {
        cb.checked = false;
        cb.closest('.dropdown-item-label').classList.remove('selected');
    });
    updateCustomSelectButton('quick');
    
    loadQuickSummary();
    loadPresence(); 
    drawCalendar(currentYear, currentMonth); 
    loadDashboardSummary(); // Mettre à jour لوحة التحكم
}

function loadQuickSummary() {
    const ul = document.getElementById('quickSummaryList'); ul.innerHTML = '';
    const presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    const todayEntries = presence.filter(p => p.date === today && !p.absence).reverse(); 
    
    if (todayEntries.length === 0) {
        ul.innerHTML = '<li style="color: #777; border-left: none; background-color: transparent;">Aucun enregistrement aujourd\'hui.</li>';
        return;
    }

    todayEntries.forEach(p => {
        const li = document.createElement('li');
        const status = p.exit ? 'Sortie' : 'Entrée (Actif)';
        const time = p.exit || p.entry;
        const color = p.exit ? '#4CAF50' : '#FFC107'; 
        
        li.style.cssText = `padding: 5px 0; border-bottom: 1px dotted #eee; color: ${color}; border-left: 5px solid ${color}; background-color: #f9f9f9; padding-left: 10px;`;
        
        li.textContent = `${p.name} - ${status} à ${time} (${p.note || 'Pas de note'})`;
        ul.appendChild(li);
    });
}


// --- Manual/Retroactive Registration ---
function registerPresence() {
    const name = document.getElementById('workerSelect').value;
    const date = document.getElementById('dateSelect').value;
    const entry = document.getElementById('entryTime').value;
    const exit = document.getElementById('exitTime').value;
    const breakStart = document.getElementById('breakStart').value;
    const breakEnd = document.getElementById('breakEnd').value;
    const note = document.getElementById('manualNote').value.trim();

    if (!name || !date || !entry || !exit) return showToast('Veuillez remplir le nom، la date، ل\'entrée et la sortie.', 3000);
    
    if (timeToMinutes(entry) >= timeToMinutes(exit)) return showToast('ل\'heure d\'entrée doit être antérieure à l\'heure de sortie pour le même jour.', 3000);
    
    if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) return showToast('Veuillez spécifier à la fois le début ET la fin de la pause، ou laisser les deux vides.', 4000);
    if (breakStart && timeToMinutes(breakStart) >= timeToMinutes(breakEnd)) return showToast('Le début de la pause doit être antérieur à la fin de la pause.', 3000);
    if (breakStart && (timeToMinutes(breakStart) < timeToMinutes(entry) || timeToMinutes(breakEnd) > timeToMinutes(exit))) return showToast('La pause doit être comprise dans la période d\'entrée et de sortie.', 4000);


    let presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');

    const newEntry = { date, name, entry, exit, breakStart, breakEnd, note, absence: null };

    if (editingIndex !== null) {
        if (editingIndex >= 0 && editingIndex < presence.length) {
            if (presence[editingIndex].name !== name) {
                 const existingIndexCheck = presence.findIndex(p => p.name === name && p.date === date && !p.absence);
                 if (existingIndexCheck !== -1) return showToast(`Impossible de changer le nom: ${name} a déjà une saisie le ${date}.`, 5000);
            }
            
            presence[editingIndex] = newEntry;
            showToast('Saisie mise à jour avec succès.', 3000);
            exitEditMode();
        } else {
            presence.push(newEntry);
            showToast('Saisie ajoutée (Erreur d\'édition ou index introuvable).', 3000);
        }
    } else {
        const existingIndex = presence.findIndex(p => p.name === name && p.date === date && !p.absence);
        if (existingIndex !== -1) return showToast('Une saisie existe déjà pour cet employé et cette date. Veuillez éditer l\'entrée existante dans le Tableau.', 5000);

        presence.push(newEntry);
        showToast('Présence enregistrée avec succès.', 3000);
    }

    localStorage.setItem(presenceKey, JSON.stringify(presence));
    clearForm();
    loadPresence();
    drawCalendar(currentYear, currentMonth);
    loadDashboardSummary(); // Mettre à jour لوحة التحكم
    loadPendingActions(); // قد يغير هذا الإجراء قائمة الإجراءات المعلقة
}


function editEntry(originalIndex) {
    let presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    
    if (originalIndex < 0 || originalIndex >= presence.length) {
        return showToast('Erreur: Index de saisie invalide pour l\'édition.', 3000);
    }
    
    const entry = presence[originalIndex];
    
    document.getElementById('workerSelect').value = entry.name;
    document.getElementById('dateSelect').value = entry.date;
    document.getElementById('entryTime').value = entry.entry || '';
    document.getElementById('exitTime').value = entry.exit || '';
    document.getElementById('breakStart').value = entry.breakStart || '';
    document.getElementById('breakEnd').value = entry.breakEnd || '';
    document.getElementById('manualNote').value = entry.note || '';

    editingIndex = originalIndex; 
    document.getElementById('registerButton').textContent = 'Mettre à Jour la Saisie';
    document.getElementById('registerButton').style.backgroundColor = '#007bff';
    
    showToast(`Édition de la saisie du ${entry.date} pour ${entry.name}.`, 3000);
    
    openTab(new Event('click'), 'register');
    window.scrollTo(0, 0);
}

function clearForm() {
    document.getElementById('workerSelect').value = '';
    document.getElementById('dateSelect').value = today;
    document.getElementById('entryTime').value = '';
    document.getElementById('exitTime').value = '';
    document.getElementById('breakStart').value = '';
    document.getElementById('breakEnd').value = '';
    document.getElementById('manualNote').value = '';
    exitEditMode();
}

function exitEditMode() {
    editingIndex = null;
    document.getElementById('registerButton').textContent = 'Enregistrer la Présence';
    document.getElementById('registerButton').style.backgroundColor = '#D62828'; 
}


// --- Absence Management ---
function registerPlannedAbsence() {
    const name = document.getElementById('absenceWorker').value;
    const reason = document.getElementById('absenceReason').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!name || !startDate || !endDate) return showToast('Veuillez sélectionner l\'employé et les dates.', 3000);
    if (new Date(startDate) > new Date(endDate)) return showToast('La date de début ne peut être postérieure à la date de fin.', 3000);

    let plannedAbsence = JSON.parse(localStorage.getItem(plannedAbsenceKey) || '[]');
    let presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');

    const newAbsence = { name, reason, startDate, endDate };
    plannedAbsence.push(newAbsence);
    localStorage.setItem(plannedAbsenceKey, JSON.stringify(plannedAbsence));

    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
        const dateStr = currentDate.toISOString().slice(0, 10);
        
        presence = presence.filter(p => !(p.name === name && p.date === dateStr && !p.absence));

        const existingAbsenceIndex = presence.findIndex(p => p.name === name && p.date === dateStr && p.absence);
        const absenceNote = `Absence planifiée: ${reason}`;
        
        if (existingAbsenceIndex === -1) {
             presence.push({
                date: dateStr, name: name, entry: null, exit: null, breakStart: null, breakEnd: null,
                note: absenceNote, absence: reason
            });
        } else {
            presence[existingAbsenceIndex].absence = reason;
            presence[existingAbsenceIndex].note = absenceNote;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    localStorage.setItem(presenceKey, JSON.stringify(presence));

    showToast(`Absence planifiée pour ${name} (${startDate} à ${endDate}) enregistrée.`, 3000);
    loadPlannedAbsence();
    drawCalendar(currentYear, currentMonth);
    loadDashboardSummary(); // Mettre à jour لوحة التحكم
}

function loadPlannedAbsence() {
    const ul = document.getElementById('plannedAbsenceList'); ul.innerHTML = '';
    const plannedAbsence = JSON.parse(localStorage.getItem(plannedAbsenceKey) || '[]')
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    if (plannedAbsence.length === 0) {
        ul.innerHTML = '<li style="color: #777; border-left: none; background-color: transparent;">Aucune absence planifiée.</li>';
        return;
    }
    
    plannedAbsence.forEach((a, index) => {
        const li = document.createElement('li');
        li.textContent = `${a.name} - ${a.reason} du ${a.startDate} au ${a.endDate}`;
        li.innerHTML += ` <button onclick="deletePlannedAbsence(${index})" class="delete-btn" title="Supprimer"><i class="fas fa-trash-alt"></i></button>`;
        ul.appendChild(li);
    });
}

function deletePlannedAbsence(index) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette absence planifiée et toutes les entrées d'absence associées?")) {
        let plannedAbsence = JSON.parse(localStorage.getItem(plannedAbsenceKey) || '[]');
        const absenceToDelete = plannedAbsence[index];
        if (!absenceToDelete) return;

        plannedAbsence.splice(index, 1);
        localStorage.setItem(plannedAbsenceKey, JSON.stringify(plannedAbsence));

        let presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
        presence = presence.filter(p => !(
            p.name === absenceToDelete.name && 
            p.date >= absenceToDelete.startDate && 
            p.date <= absenceToDelete.endDate &&
            p.absence === absenceToDelete.reason 
        ));
        localStorage.setItem(presenceKey, JSON.stringify(presence));

        showToast('Absence planifiée supprimée.', 3000);
        loadPlannedAbsence();
        loadPresence();
        drawCalendar(currentYear, currentMonth);
        loadDashboardSummary(); // Mettre à jour لوحة التحكم
    }
}


// ------------------------------------
// 2. Tab Table (Tableau - Sort, Filter & Load) 
// ------------------------------------
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour le lundi (1)
    return new Date(d.setDate(diff));
}

function applyDateFilter(filterType) {
    currentFilter = filterType;
    loadPresence();
    // updatePeriodFilterButtonLabel(filterType); // Appelé depuis selectPeriodFilter
    // showToast(`Filtre de période appliqué: ${filterType}.`, 3000); // Déplacé dans updateSortButtonLabel
}

function filterPresenceData(data) {
    let filteredData = data;
    const currentDate = new Date(today + 'T00:00:00'); 
    
    // 1. Filtrage par Période
    if (currentFilter === 'today') {
        filteredData = filteredData.filter(p => p.date === today);
    } else if (currentFilter === 'week') {
        const weekStart = getWeekStart(currentDate);
        // La fin de la semaine est le dimanche
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6); 

        filteredData = filteredData.filter(p => {
            const entryDate = new Date(p.date + 'T00:00:00');
            return entryDate >= weekStart && entryDate <= weekEnd;
        });
    } else if (currentFilter === 'month') {
        const currentMonthStr = today.slice(0, 7); // YYYY-MM
        filteredData = filteredData.filter(p => p.date.startsWith(currentMonthStr));
    }

    // 2. Filtrage par Employés (Multi-sélection)
    // Si selectedTableWorkers est vide، cela signifie "tous" (pas de filtre appliqué)
    if (selectedTableWorkers.length > 0) {
        filteredData = filteredData.filter(p => selectedTableWorkers.includes(p.name));
    }

    return filteredData;
}

function loadPresence() {
    const tableBody = document.querySelector('#presenceTable tbody');
    tableBody.innerHTML = '';
    
    let presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    
    // 1. Application des Filtres
    let filteredPresence = filterPresenceData(presence);

    // 2. Application du Tri
    filteredPresence.sort((a, b) => {
        let valA, valB;

        if (currentSortColumn === 'date') {
            valA = new Date(a.date);
            valB = new Date(b.date);
        } else if (currentSortColumn === 'hours') {
            valA = calculateHours(a.entry, a.exit, a.breakStart, a.breakEnd);
            valB = calculateHours(b.entry, b.exit, b.breakStart, b.breakEnd);
        }
        
        if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    const workersList = getWorkersList();

    if (filteredPresence.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #777; padding: 20px;">Aucune saisie de présence enregistrée pour les filtres actuels.</td></tr>';
        return;
    }

    filteredPresence.forEach((p, index) => { 
        const worker = workersList.find(w => w.name === p.name) || {};
        const netHours = calculateHours(p.entry, p.exit, p.breakStart, p.breakEnd).toFixed(2);
        const breakMinutes = calculateBreakMinutes(p.breakStart, p.breakEnd);

        const status = p.absence ? 'Absent - ' + p.absence : (p.exit ? 'Présent' : 'Punch In Actif');
        
        let rowClass = '';
        if (p.absence) {
            rowClass = 'row-absence';
        } else if (!p.exit && p.entry) {
            rowClass = 'row-active-punch';
        }

        const row = tableBody.insertRow();
        row.className = rowClass; 
        
        row.insertCell().textContent = p.date;
        row.insertCell().textContent = p.name;
        row.insertCell().textContent = worker.department || '--';
        row.insertCell().textContent = p.entry || '--';
        row.insertCell().textContent = p.exit || '--';
        row.insertCell().textContent = breakMinutes > 0 ? breakMinutes : '0'; 
        
        const netHoursCell = row.insertCell();
        netHoursCell.textContent = netHours;
        netHoursCell.style.fontWeight = 'bold'; // Mise en évidence
        netHoursCell.style.color = netHours > 0 ? '#4CAF50' : '#dc3545';
        
        const statusCell = row.insertCell();
        statusCell.textContent = status;
        statusCell.style.fontWeight = 'bold';
        
        row.insertCell().textContent = p.note || '';
        
        // Trouver l'index dans la liste *originale* pour l'édition/suppression
        const originalPresenceList = JSON.parse(localStorage.getItem(presenceKey) || '[]');
        // NOTE: Cette méthode de recherche d'index par valeur est lente mais nécessaire car l'index de 'filteredPresence' change.
        const originalIndex = originalPresenceList.findIndex((item, idx) => 
            item.date === p.date && 
            item.name === p.name && 
            item.entry === p.entry && 
            item.exit === p.exit &&
            JSON.stringify(item) === JSON.stringify(p) // S'assurer que c'est la bonne entrée
        );

        row.insertCell().innerHTML = `
            <button onclick="editEntry(${originalIndex})" style="width: auto; padding: 3px 8px; background-color: #007bff; margin-bottom: 3px;" title="Éditer"><i class="fas fa-edit"></i></button>
            <button onclick="deleteEntry(${originalIndex})" class="delete-btn" title="Supprimer"><i class="fas fa-trash-alt"></i></button>
        `;
    });
}

function deleteEntry(originalIndex) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette entrée?")) {
        let presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
        
        if (originalIndex >= 0 && originalIndex < presence.length) {
            presence.splice(originalIndex, 1);
            localStorage.setItem(presenceKey, JSON.stringify(presence));
            showToast('Entrée supprimée.', 3000);
            loadPresence(); 
            drawCalendar(currentYear, currentMonth); 
            loadDashboardSummary(); // Mettre à jour لوحة التحكم
            loadPendingActions(); // قد يؤثر الحذف على الإجراءات المعلقة
        } else {
             showToast('Erreur: Index de suppression invalide.', 3000);
        }
    }
}


// ------------------------------------
// 3. Tab Calendar 
// ------------------------------------
function drawCalendar(year, month){
    const display = document.getElementById('calendarDisplay');
    const monthYearDisplay = document.getElementById('monthYearDisplay');
    const selectedWorker = document.getElementById('calendarWorker').value;

    monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
    display.innerHTML = '';
    
    const presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    const firstDayOfMonth = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    weekDays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'header';
        header.textContent = day;
        display.appendChild(header);
    });

    const offset = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1; 

    for (let i = 0; i < offset; i++) {
        const empty = document.createElement('div');
        empty.className = 'day empty';
        display.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.innerHTML = `<small class="date-num">${day}</small>`;

        dayDiv.setAttribute('onclick', `showDayDetails('${dateStr}')`);

        let dayPresence = presence.filter(p => p.date === dateStr);
        if (selectedWorker !== 'all') {
            dayPresence = dayPresence.filter(p => p.name === selectedWorker);
        }

        const isHoliday = isHolidayCheck(dateStr);
        
        const isAbsent = dayPresence.some(p => p.absence);
        const isPresent = dayPresence.some(p => p.entry && p.exit);
        const isActive = dayPresence.some(p => p.entry && !p.exit);


        if (isAbsent) {
            dayDiv.classList.add('absent');
            dayDiv.title = 'Absence(s) enregistrée(s)';
        } else if (isPresent) {
            dayDiv.classList.add('present');
            dayDiv.title = 'Présence(s) enregistrée(s)';
        } else if (isHoliday) {
            dayDiv.classList.add('holiday'); 
            dayDiv.title = 'Jour Férié';
        }


        dayPresence.forEach(p => {
             const summary = document.createElement('small');
             summary.style.fontSize = '0.65rem';
             summary.style.display = 'block';
             summary.style.whiteSpace = 'nowrap';
             summary.style.overflow = 'hidden';
             summary.style.textOverflow = 'ellipsis';
             
             if (p.absence) {
                 summary.textContent = `${p.name}: X (${p.absence})`;
                 summary.style.color = '#dc3545';
             } else if (p.entry && p.exit) {
                 const hours = calculateHours(p.entry, p.exit, p.breakStart, p.breakEnd).toFixed(1);
                 summary.textContent = `${p.name}: ${hours}h Net`;
                 summary.style.color = '#4CAF50'; 
             } else if (p.entry && !p.exit) {
                  summary.textContent = `${p.name}: IN @ ${p.entry}`;
                  summary.style.color = '#FFC107'; 
             }
             
             dayDiv.appendChild(summary);
        });
        
        if (isHoliday && !isAbsent && !isPresent && !isActive) {
             const holiday = JSON.parse(localStorage.getItem(holidaysKey) || '[]').find(h => h.date === dateStr);
             if (holiday) {
                 const holidayText = document.createElement('small');
                 holidayText.style.fontSize = '0.7rem';
                 holidayText.style.display = 'block';
                 holidayText.style.color = '#FFC107'; 
                 holidayText.textContent = `Fête: ${holiday.name}`;
                 dayDiv.appendChild(holidayText);
             }
        }
        
        display.appendChild(dayDiv);
    }
}

function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    drawCalendar(currentYear, currentMonth);
}
function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    drawCalendar(currentYear, currentMonth);
}


// ------------------------------------
// 4. Tab Reports & KPIs 
// ------------------------------------
function calculateKPIs() {
    const selectedWorker = document.getElementById('reportsWorkerSelect').value;
    const allPresence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    let workersList = getWorkersList();
    
    let monthlyRecords = allPresence.filter(p => p.date.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`));
    
    if (selectedWorker !== 'all') {
        monthlyRecords = monthlyRecords.filter(p => p.name === selectedWorker);
        workersList = workersList.filter(w => w.name === selectedWorker);
    }
    
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const reportData = {};

    workersList.forEach(worker => {
        reportData[worker.name] = {
            totalHours: 0,
            absenceDays: new Set(),
            lateEntriesCount: 0,
            totalLatenessMinutes: 0,
            presentDays: new Set(),
            defaultEntry: worker.defaultEntry 
        };
    });

    monthlyRecords.forEach(p => {
        const data = reportData[p.name];
        if (!data) return; 

        if (p.absence) {
            data.absenceDays.add(p.date);
        } else if (p.entry && p.exit) {
            const hours = calculateHours(p.entry, p.exit, p.breakStart, p.breakEnd);
            data.totalHours += hours;
            data.presentDays.add(p.date); 

            const lateness = calculateLateness(p.entry, data.defaultEntry);
            if (lateness > 0) {
                data.lateEntriesCount++;
                data.totalLatenessMinutes += lateness;
            }
        }
    });

    const tableBody = document.querySelector('#monthlyReportTable tbody');
    tableBody.innerHTML = '';
    
    let globalTotalHours = 0;
    let globalAbsenceDays = 0;
    let globalPresentDays = 0;

    Object.keys(reportData).forEach(name => {
        const data = reportData[name];
        
        const finalAbsenceDays = Array.from(data.absenceDays).filter(date => !data.presentDays.has(date)).length;
        
        const avgLateness = data.lateEntriesCount > 0 
            ? Math.round(data.totalLatenessMinutes / data.lateEntriesCount) 
            : 0;
            
        const row = tableBody.insertRow();
        row.insertCell().textContent = name;
        row.insertCell().textContent = data.totalHours.toFixed(2) + 'h';
        row.insertCell().textContent = finalAbsenceDays;
        row.insertCell().textContent = avgLateness + ' min';
        
        globalTotalHours += data.totalHours;
        globalAbsenceDays += finalAbsenceDays;
        globalPresentDays += data.presentDays.size;
    });
    
    if (workersList.length === 0 || Object.keys(reportData).length === 0) {
         tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #777;">Aucune donnée de présence/absence ce mois-ci.</td></tr>`;
    }

    let totalWorkingDaysInMonth = 0;
    for (let day = 1; day <= totalDaysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dayOfWeek = date.getDay(); 
        const dateStr = date.toISOString().slice(0, 10);
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHolidayCheck(dateStr)) {
            totalWorkingDaysInMonth++;
        }
    }
    
    const totalPossibleAttendance = workersList.length * totalWorkingDaysInMonth;
    
    const absenceRate = totalPossibleAttendance > 0 ? ((globalAbsenceDays / totalPossibleAttendance) * 100).toFixed(1) : 0;
    const avgHours = globalPresentDays > 0 ? (globalTotalHours / globalPresentDays).toFixed(2) : 0;
    

    document.getElementById('kpiAbsenceRate').textContent = absenceRate + '%';
    document.getElementById('kpiAvgHours').textContent = avgHours + 'h';
    document.getElementById('kpiTotalHoursMonth').textContent = globalTotalHours.toFixed(2) + 'h';
}

function drawChart() {
    const ctx = document.getElementById('hoursChart').getContext('2d');
    const selectedWorker = document.getElementById('reportsWorkerSelect').value;
    const allPresence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    
    let monthlyRecords = allPresence.filter(p => p.date.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`));
    if (selectedWorker !== 'all') {
        monthlyRecords = monthlyRecords.filter(p => p.name === selectedWorker);
    }
    
    const workerHours = {};
    monthlyRecords.forEach(p => {
        if (p.entry && p.exit) {
            const hours = calculateHours(p.entry, p.exit, p.breakStart, p.breakEnd);
            workerHours[p.name] = (workerHours[p.name] || 0) + hours;
        }
    });

    const labels = Object.keys(workerHours);
    const data = Object.values(workerHours).map(h => h.toFixed(2));

    if (chart) chart.destroy();
    
    // Configs with standard colors (no dark mode check)
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Heures Net (Mois: ${monthNames[currentMonth]} ${currentYear})`,
                data: data,
                backgroundColor: 'rgba(214, 40, 40, 0.7)', 
                borderColor: 'rgba(214, 40, 40, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Heures Net', color: '#333' } },
                      x: { ticks: { color: '#333' } } 
            },
            plugins: {
                legend: { labels: { color: '#333' } }
            }
        }
    });
}


// ------------------------------------
// 5. Tab Profils 
// ------------------------------------
function loadWorkerProfile() {
    const name = document.getElementById('profileWorkerSelect').value;
    const detailsCard = document.getElementById('workerProfileDetails');
    
    if (!name) {
        detailsCard.classList.add('hidden');
        if (profileChart) { profileChart.destroy(); profileChart = null; } 
        return;
    }
    
    detailsCard.classList.remove('hidden');

    const worker = getWorkersList().find(w => w.name === name);
    if (!worker) return; 
    
    document.getElementById('editName').value = worker.name;
    document.getElementById('editDept').value = worker.department || '';
    document.getElementById('editEntry').value = worker.defaultEntry || '09:00';
    document.getElementById('editExit').value = worker.defaultExit || '17:00';
    document.getElementById('profileImage').src = worker.image || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
    document.getElementById('profileImageUpload').value = null; 

    const allPresence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthlyRecords = allPresence.filter(p => p.name === name && p.date.startsWith(currentMonthStr));
    
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let totalWorkHours = 0;
    let punchInCount = 0;
    let completedPunchCount = 0; 
    let latenessDaysCount = 0; 

    const uniqueDaysPresent = new Set();
    const uniqueDaysAbsent = new Set();
    const processedDates = new Set(); 

    monthlyRecords.forEach(p => {
        if (!processedDates.has(p.date)) {
            if (p.absence) {
                uniqueDaysAbsent.add(p.date);
            } else if (p.entry) {
                if (p.exit) {
                    totalWorkHours += calculateHours(p.entry, p.exit, p.breakStart, p.breakEnd);
                    completedPunchCount++;
                    uniqueDaysPresent.add(p.date);
                    
                    const lateness = calculateLateness(p.entry, worker.defaultEntry);
                    if (lateness > 0) {
                        latenessDaysCount++; 
                    }
                }
                punchInCount++;
            }
            processedDates.add(p.date); 
        }
    });
    
    const finalAbsenceDays = Array.from(uniqueDaysAbsent).filter(date => !uniqueDaysPresent.has(date)).length;
    
    let workedDays = uniqueDaysPresent.size;
    let totalDays = 0;
    let workingDaysCount = 0;
    
    for (let day = 1; day <= totalDaysInMonth; day++) {
        const date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = dateObj.getDay(); 
        
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = isHolidayCheck(date);

        if (!isWeekend && !isHoliday) {
            workingDaysCount++;
        }
        totalDays++;
    }

    const totalDaysOff = totalDays - workingDaysCount; 
    const unattendedWorkingDays = workingDaysCount - workedDays - finalAbsenceDays;
    const unaccountedDays = Math.max(0, unattendedWorkingDays); 
    
    const punchRate = punchInCount > 0 ? ((completedPunchCount / punchInCount) * 100).toFixed(0) : 0;
    
    document.getElementById('profileTotalHours').textContent = totalWorkHours.toFixed(2) + 'h';
    document.getElementById('profileAbsenceDays').textContent = finalAbsenceDays;
    document.getElementById('profilePunchRate').textContent = punchRate + '%';
    document.getElementById('profileLatenessDays').textContent = latenessDaysCount; 
    
    const chartData = {
        labels: [
            `Présence (${workedDays}j)`, 
            `Absence (${finalAbsenceDays}j)`, 
            `Jours Manqués (${unaccountedDays}j)`,
            `Jours Repos/Fériés (${totalDaysOff}j)` 
        ],
        datasets: [{
            data: [workedDays, finalAbsenceDays, unaccountedDays, totalDaysOff],
            backgroundColor: [
                '#4CAF50', 
                '#dc3545', 
                '#FFC107', 
                '#007bff'  
            ],
            hoverBackgroundColor: ['#66bb6a', '#ef5350', '#ffc107', '#2196f3'],
            borderWidth: 1
        }]
    };

    const ctx = document.getElementById('profileAttendanceChart').getContext('2d');
    
    if (profileChart) profileChart.destroy();
    
    // Configs with standard colors (no dark mode check)
    profileChart = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true, position: 'bottom', labels: { 
                     color: '#333333' 
                 } },
                title: { display: false }
            }
        }
    });
}

function previewProfileImage(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profileImage').src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        showToast('Veuillez sélectionner un fichier image valide.', 3000);
        document.getElementById('profileImage').src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
    }
}

function saveWorkerProfile() {
    const oldName = document.getElementById('profileWorkerSelect').value;
    const newName = document.getElementById('editName').value.trim();
    const newDept = document.getElementById('editDept').value.trim();
    const newEntry = document.getElementById('editEntry').value;
    const newExit = document.getElementById('editExit').value;
    const newImage = document.getElementById('profileImage').src;

    if (!newName) return showToast('Le nom de l\'employé ne peut pas être vide.', 3000);
    
    let workers = getWorkersList();
    const workerIndex = workers.findIndex(w => w.name === oldName);
    
    if (workerIndex === -1) return showToast('Erreur: Employé introuvable.', 3000);

    if (newName !== oldName && workers.some((w, i) => i !== workerIndex && w.name === newName)) {
        return showToast('Erreur: Le nouveau nom existe déjà pour un autre employé.', 5000);
    }

    workers[workerIndex].name = newName;
    workers[workerIndex].department = newDept;
    workers[workerIndex].defaultEntry = newEntry;
    workers[workerIndex].defaultExit = newExit;
    workers[workerIndex].image = newImage;
    localStorage.setItem(workersKey, JSON.stringify(workers));

    if (newName !== oldName) {
        let presence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
        presence.forEach(p => { if (p.name === oldName) p.name = newName; });
        localStorage.setItem(presenceKey, JSON.stringify(presence));

        let plannedAbsence = JSON.parse(localStorage.getItem(plannedAbsenceKey) || '[]');
        plannedAbsence.forEach(a => { if (a.name === oldName) a.name = newName; });
        localStorage.setItem(plannedAbsenceKey, JSON.stringify(plannedAbsence));
    }
    
    showToast(`Profil de ${newName} mis à jour avec succès!`, 3000);

    loadWorkers();
    loadWorkersIntoSelects();
    document.getElementById('profileWorkerSelect').value = newName;
    loadWorkerProfile(); 
    loadDashboardSummary(); // Mettre à jour لوحة التحكم
}


// --- Tab Export/Backup ---
function convertToExcelData(data) {
    const workersList = getWorkersList();

    return data.map(p => {
        const worker = workersList.find(w => w.name === p.name) || {};
        return {
            Date: p.date, 
            Employé: p.name, 
            Département: worker.department || '--', 
            Entrée: p.entry, 
            Sortie: p.exit,
            'Début Pause': p.breakStart, 
            'Fin Pause': p.breakEnd,
            'Pause (min)': calculateBreakMinutes(p.breakStart, p.breakEnd),
            'Heures Net': calculateHours(p.entry, p.exit, p.breakStart, p.breakEnd).toFixed(2),
            Statut: p.absence ? `Absent (${p.absence})` : (p.exit ? 'Présent' : 'Punch In Actif'),
            Note: p.note
        };
    });
}

function exportDataToExcel(filter) {
    const allPresence = JSON.parse(localStorage.getItem(presenceKey) || '[]');
    let dataToExport = allPresence;

    if (filter === 'month') {
        const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        dataToExport = allPresence.filter(p => p.date.startsWith(currentMonthStr));
    }

    if (dataToExport.length === 0) return showToast('Aucune donnée à exporter.', 3000);

    const worksheetData = convertToExcelData(dataToExport);
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Présence");

    const date = new Date().toISOString().slice(0, 10);
    const fileName = `Presence_Export_${date}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showToast(`Données exportées dans ${fileName}`, 3000);
}

function backupData() {
    const data = {
        workers: JSON.parse(localStorage.getItem(workersKey) || '[]'),
        presence: JSON.parse(localStorage.getItem(presenceKey) || '[]'),
        plannedAbsence: JSON.parse(localStorage.getItem(plannedAbsenceKey) || '[]'),
        holidays: JSON.parse(localStorage.getItem(holidaysKey) || '[]'),
        timestamp: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SGP_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Sauvegarde JSON téléchargée.', 3000);
}

function restoreData() {
    const fileInput = document.getElementById('restoreFile');
    const file = fileInput.files[0];

    if (!file) return showToast('Veuillez sélectionner un fichier JSON de sauvegarde.', 3000);
    if (!confirm('ATTENTION: Voulez-vous vraiment écraser les données actuelles? Cette action est irréversible.')) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);
            if (data.workers && data.presence) {
                localStorage.setItem(workersKey, JSON.stringify(data.workers));
                localStorage.setItem(presenceKey, JSON.stringify(data.presence));
                localStorage.setItem(plannedAbsenceKey, JSON.stringify(data.plannedAbsence || []));
                localStorage.setItem(holidaysKey, JSON.stringify(data.holidays || []));
                showToast('Restauration des données réussie. Veuillez recharger la page.', 5000);
                setTimeout(() => window.location.reload(), 5000);
            } else {
                showToast('Fichier JSON invalide: Manque les clés "workers" ou "presence".', 5000);
            }
        } catch (e) {
            showToast('Erreur lors du traitement du fichier JSON.', 5000);
            console.error(e);
        }
    };
    reader.readAsText(file);
}


// ------------------------------------
// Initialisation & Service Worker Setup 
// ------------------------------------
window.onload=function(){
  if (!localStorage.getItem(workersKey)) localStorage.setItem(workersKey, '[]');
  if (!localStorage.getItem(presenceKey)) localStorage.setItem(presenceKey, '[]');
  if (!localStorage.getItem(plannedAbsenceKey)) localStorage.setItem(plannedAbsenceKey, '[]');
  if (!localStorage.getItem(holidaysKey)) localStorage.setItem(holidaysKey, '[]');
  
  loadWorkers(); 
  loadHoliday(); 
  loadWorkersIntoSelects(); 
  loadPlannedAbsence(); 
  loadDashboardSummary(); // تحميل ملخص لوحة التحكم عند بدء التشغيل
  loadPendingActions();   // تحميل الإجراءات المعلقة عند بدء التشغيل
  
  document.getElementById('dateSelect').value = today;
  document.getElementById('startDate').value = today;
  document.getElementById('endDate').value = today;
  
  document.getElementById('employees').classList.remove('hidden'); 
  document.querySelector('.tab-navigation .tab-button').classList.add('active');
  
  drawCalendar(currentYear, currentMonth);
  updateSortButtonLabel(); // Assurer que le label de tri par défaut est chargé

  // Close dropdown when clicking outside
  document.addEventListener('click', (event) => {
    const quickSelectContainer = document.getElementById('quickSelectContainer');
    const tableSelectContainer = document.getElementById('tableSelectContainer');
    const periodFilterContainer = document.querySelector('.period-filter-dropdown-container'); 
    const sortFilterContainer = document.querySelector('.sort-filter-dropdown-container');
    
    // Fermer la modale si on clique en dehors
    const modal = document.getElementById('dayDetailsModal');
    if (modal.style.display === 'block' && event.target === modal) {
        closeModal();
    }
    
    // Fermer الـ dropdowns
    if (quickSelectContainer && !quickSelectContainer.contains(event.target)) {
        closeWorkerDropdown('quick');
    }
    if (tableSelectContainer && !tableSelectContainer.contains(event.target)) {
        closeWorkerDropdown('table');
    }
    if (periodFilterContainer && !periodFilterContainer.contains(event.target)) {
        closePeriodDropdown();
    }
    if (sortFilterContainer && !sortFilterContainer.contains(event.target)) {
        closeSortDropdown();
    }
  });
  
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // NOTE: Le service worker (sw.js) doit exister à la racine pour cela fonctionne
      navigator.serviceWorker.register('/sw.js') 
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
          showToast('Application prête pour une utilisation hors ligne.', 3000);
        })
        .catch(err => {
          console.log('ServiceWorker registration failed: ', err);
        });
    });
  }
};
