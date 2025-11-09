// =========================================================
// === SCRIPT.JS - كود JavaScript الكامل لنظام الحضور ===
// === مُحدَّث ليشمل حلول المشاكل ومنطق الوضع الداكن ===
// =========================================================

// ==================== 1. المُتغيرات والثوابت ====================
const workersKey = 'workers';
const presenceKey = 'presence';
const holidaysKey = 'holidays';
const absencesKey = 'absences';
const themeKey = 'themePreference'; // مفتاح حفظ تفضيل السمة

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let currentFilter = 'all'; 
let selectedTableWorkers = [];
let currentSort = { column: 'date', direction: 'desc' }; 

// ==================== 2. دوال المساعدة الأساسية ====================

// إدارة الإشعارات (Toast)
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `show ${type}`; 
    
    setTimeout(() => {
        toast.className = '';
    }, 3000);
}

// جلب قوائم البيانات من Local Storage
function getWorkersList() {
    const workersData = localStorage.getItem(workersKey);
    return workersData ? JSON.parse(workersData) : [];
}

function getPresenceList() {
    const presenceData = localStorage.getItem(presenceKey);
    return presenceData ? JSON.parse(presenceData) : [];
}

// الدوال المفقودة سابقاً (تمت إضافتها كدوال وهمية لتشغيل الكود)
// يجب بناء منطق هذه الدوال ليعمل التطبيق بكامل وظائفه
function loadDashboardSummary() { /* ... */ }
function loadPendingActions() { /* ... */ }
function loadHolidayList() { /* ... */ }
function loadQuickSummary() { /* ... */ }
function loadPlannedAbsenceList() { /* ... */ }
function loadPresence() { /* ... */ }
function updatePeriodFilterButtonLabel() { /* ... */ }
function updateSortButtonLabel() { /* ... */ }
function drawCalendar(year, month) { /* ... */ }
function calculateKPIs() { /* ... */ }
function drawChart() { /* ... */ }
function removeWorker(id) { /* ... */ }
function addHoliday() { /* ... */ }
function quickPunch(type) { /* ... */ }
function registerPresence() { /* ... */ }
function clearForm() { /* ... */ }
function registerPlannedAbsence() { /* ... */ }
function togglePeriodDropdown() { /* ... */ }
function selectPeriodFilter(filter) { /* ... */ }
function toggleSortDropdown() { /* ... */ }
function selectSortOption(col, dir, label) { /* ... */ }
function loadWorkerProfile() { /* ... */ }
function saveWorkerProfile() { /* ... */ }
function exportDataToExcel(filter) { /* ... */ }
function backupData() { /* ... */ }
function restoreData() { /* ... */ }
function prevMonth() { /* ... */ }
function nextMonth() { /* ... */ }
function closeModal() { /* ... */ }
function toggleWorkerDropdown(type) { /* ... */ }
function closeWorkerDropdown(type) { /* ... */ }
// ==========================================================

// تحويل الوقت: حساب الفرق بين وقتين بالدقائق
function timeDiffInMinutes(start, end) {
    if (!start || !end) return 0;
    const startTime = new Date(`1970/01/01 ${start}`);
    const endTime = new Date(`1970/01/01 ${end}`);
    
    if (endTime < startTime) {
        endTime.setDate(endTime.getDate() + 1);
    }
    return (endTime - startTime) / (1000 * 60);
}

// تنسيق الدقائق إلى ساعات
function formatHours(minutes) {
    if (isNaN(minutes) || minutes < 0) return '0.00';
    const hours = minutes / 60;
    return hours.toFixed(2);
}

// ==================== 3. إدارة الموظفين (Employees) ====================

// إضافة موظف جديد
function addWorker() {
    const name = document.getElementById('workerName').value.trim();
    const department = document.getElementById('workerDepartment').value.trim();
    const defaultEntry = document.getElementById('defaultEntry').value;
    const defaultExit = document.getElementById('defaultExit').value;

    if (!name || !department) {
        showToast("الرجاء إدخال اسم الموظف والقسم.", "error");
        return;
    }

    let workers = getWorkersList();
    const newWorker = {
        id: Date.now(), 
        name: name,
        department: department,
        defaultEntry: defaultEntry,
        defaultExit: defaultExit
    };

    workers.push(newWorker);
    localStorage.setItem(workersKey, JSON.stringify(workers));

    showToast(`تمت إضافة الموظف "${name}" بنجاح.`, "success");
    loadWorkersList(); 
    loadWorkersIntoSelects(); 
    
    document.getElementById('workerName').value = '';
    document.getElementById('workerDepartment').value = '';
}

// عرض قائمة الموظفين
function loadWorkersList() {
    const workerListElement = document.getElementById('workerList');
    if (!workerListElement) return;
    
    const workers = getWorkersList();
    workerListElement.innerHTML = ''; 

    if (workers.length === 0) {
        workerListElement.innerHTML = '<li style="color: var(--secondary-color); justify-content: center;">لا يوجد موظفون مسجلون حالياً.</li>';
    } else {
        workers.forEach(worker => {
            const li = document.createElement('li');
            li.className = 'worker-item';
            li.innerHTML = `
                <span>${worker.name} (${worker.department})</span>
                <small>دخول: ${worker.defaultEntry} / خروج: ${worker.defaultExit}</small>
                <button onclick="removeWorker(${worker.id})" style="background-color: var(--danger-color); margin-left: 10px; padding: 5px 10px;">حذف</button>
            `;
            workerListElement.appendChild(li);
        });
    }
    document.getElementById('kpiTotalWorkers').textContent = workers.length;
}

// تحديث قوائم الاختيار (Selects)
function loadWorkersIntoSelects() {
    const workers = getWorkersList();
    
    const simpleSelects = ['workerSelect', 'absenceWorker', 'calendarWorker', 'reportsWorkerSelect', 'profileWorkerSelect'];
    simpleSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '';
            
            if (selectId === 'calendarWorker' || selectId === 'reportsWorkerSelect') {
                 const allOption = document.createElement('option');
                 allOption.value = 'all';
                 allOption.textContent = 'جميع الموظفين';
                 select.appendChild(allOption);
            } else {
                 const defaultOption = document.createElement('option');
                 defaultOption.value = '';
                 defaultOption.textContent = '-- اختر --';
                 defaultOption.disabled = true;
                 defaultOption.selected = true;
                 select.appendChild(defaultOption);
            }
            
            workers.forEach(worker => {
                const option = document.createElement('option');
                option.value = worker.id;
                option.textContent = `${worker.name} (${worker.department})`;
                select.appendChild(option);
            });
            select.value = currentValue;
        }
    });
}

// ==================== 4. إدارة التبويبات (openTab) ====================

function openTab(evt, tabName) {
    let i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tab-content-card");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.add("hidden");
    }

    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }

    document.getElementById(tabName).classList.remove("hidden");
    evt.currentTarget.classList.add("active");
    
    // استدعاء وظائف التحميل عند فتح التبويب
    if(tabName === 'employees') { 
        loadWorkersList(); 
        loadDashboardSummary(); 
    }
    if(tabName === 'reports') { 
        loadWorkersIntoSelects(); 
        calculateKPIs(); 
        drawChart(); 
    } 
    if(tabName === 'table') { 
        loadWorkersIntoSelects(); 
        loadPresence(); 
        updatePeriodFilterButtonLabel(); 
        updateSortButtonLabel(); 
    } 
    if(tabName === 'calendar') { 
        loadWorkersIntoSelects(); 
        drawCalendar(currentYear, currentMonth); 
    } 
    if(tabName === 'register') { 
        loadWorkersIntoSelects(); 
        loadQuickSummary();
    }
    if(tabName === 'profile') {
        loadWorkersIntoSelects();
    }
}

// ==================== 5. دوال الوضع الداكن (Dark Mode) ====================

// دالة التبديل بين الوضع الفاتح والداكن
function toggleDarkMode() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // تطبيق السمة الجديدة على وسم body
    document.body.setAttribute('data-theme', newTheme);
    
    // حفظ التفضيل
    localStorage.setItem(themeKey, newTheme);
    
    showToast(`تم التبديل إلى الوضع ${newTheme === 'dark' ? 'الداكن' : 'الفاتح'}.`, 'info');
}

// تطبيق السمة المحفوظة عند تحميل الصفحة
function applySavedTheme() {
    // جلب التفضيل المحفوظ أو استخدام 'light' كافتراضي
    const savedTheme = localStorage.getItem(themeKey) || 'light'; 
    document.body.setAttribute('data-theme', savedTheme);
}


// ==================== 6. التهيئة (Initialization) ====================

function openDefaultTab() {
    const employeesTab = document.getElementById('employees');
    const defaultButton = document.querySelector('.tab-navigation .tab-button');
    
    if (employeesTab) employeesTab.classList.remove('hidden');
    if (defaultButton) defaultButton.classList.add('active');
    
    loadWorkersList();
    loadDashboardSummary();
}

window.onload = function() {
    applySavedTheme(); // *الأهم*: تطبيق السمة المحفوظة أولاً
    openDefaultTab();
    loadWorkersIntoSelects(); 
};
